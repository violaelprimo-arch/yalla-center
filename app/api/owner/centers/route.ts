import { NextRequest, NextResponse } from 'next/server';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';
import { getDataProvider } from '@/lib/dal';

export const dynamic = 'force-dynamic';

const PLATFORM_OWNER_EMAILS = [
  'fathyelprimo@gmail.com',
  'zizo.infinity@gmail.com',
  'admin@yallacenter.com',
  'owner@yallacenter.com',
  'islam@yallacenter.com',
];

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function verifyOwner(req: NextRequest) {
  const bearer = extractBearerToken(req.headers.get('authorization'));
  if (!bearer) {
    throw new FirebaseAuthError(401, 'سجّل الدخول بحساب مالك المنصة للمتابعة');
  }

  const { uid, email, rawClaims } = await verifyFirebaseIdToken(bearer);
  const normalizedEmail = (email || '').toLowerCase().trim();
  const tokenRole = (rawClaims?.role as string) || '';
  const isOwner =
    PLATFORM_OWNER_EMAILS.includes(normalizedEmail) ||
    normalizedEmail.startsWith('owner@') ||
    tokenRole === 'PLATFORM_OWNER';

  if (!isOwner) {
    throw new FirebaseAuthError(403, 'هذه العملية تتطلب صلاحية مالك المنصة (Platform Owner)');
  }

  const store = await createServerFirestoreStore({ callerIdToken: bearer });
  return { uid, email: normalizedEmail, store, bearer };
}

async function verifyOwnerOptional(bearer: string) {
  try {
    const { uid, email, rawClaims } = await verifyFirebaseIdToken(bearer);
    const normalizedEmail = (email || '').toLowerCase().trim();
    const tokenRole = (rawClaims?.role as string) || '';
    const isOwner =
      PLATFORM_OWNER_EMAILS.includes(normalizedEmail) ||
      normalizedEmail.startsWith('owner@') ||
      tokenRole === 'PLATFORM_OWNER';

    if (!isOwner) return { isOwner: false, store: null };
    const store = await createServerFirestoreStore({ callerIdToken: bearer });
    return { isOwner: true, store, uid, email: normalizedEmail };
  } catch {
    return { isOwner: false, store: null };
  }
}

// GET /api/owner/centers — List all centers from Cloud Firestore
export async function GET(req: NextRequest) {
  try {
    const bearer = extractBearerToken(req.headers.get('authorization'));
    if (bearer) {
      try {
        const { isOwner, store } = await verifyOwnerOptional(bearer);
        if (isOwner && store) {
          // Check if legacy demo center exists in Firestore and purge it
          const demoDoc = await store.getDocument('tenants/tenant-maher-001').catch(() => ({ exists: false }));
          if (demoDoc.exists) {
            await store.commit([{ type: 'delete', documentPath: 'tenants/tenant-maher-001' }]).catch(() => {});
          }
          // Ensure elmaher exists in Firestore
          const elmaherDoc = await store.getDocument('tenants/tenant-elmaher-001').catch(() => ({ exists: false }));
          if (!elmaherDoc.exists) {
            await store.commit([{
              type: 'set',
              documentPath: 'tenants/tenant-elmaher-001',
              data: {
                id: 'tenant-elmaher-001',
                slug: 'elmaher',
                nameAr: 'سنتر الماهر',
                nameEn: 'El Maher Educational Center',
                phone: '01001234567',
                address: 'الفرع الرئيسي',
                subscriptionPlan: 'pro',
                isActive: true,
                settings: {
                  currency: 'EGP',
                  enableWhatsApp: true,
                  enableFCM: true,
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              },
            }]).catch(() => {});
          }
        }
      } catch {}
    }

    const dal = getDataProvider();
    const tenants = await dal.getTenants();
    return reply({ success: true, centers: tenants });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'تعذّر جلب قائمة السناتر';
    return reply({ success: false, error: message }, 500);
  }
}

// POST /api/owner/centers — Provision or update a center in Cloud Firestore
export async function POST(req: NextRequest) {
  try {
    const { store } = await verifyOwner(req);
    const body = await req.json().catch(() => ({}));

    const nameAr = typeof body.nameAr === 'string' ? body.nameAr.trim() : '';
    const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const cleanSlug = rawSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    if (!nameAr) {
      return reply({ success: false, error: 'اسم السنتر بالعربية مطلوب' }, 400);
    }
    if (!cleanSlug) {
      return reply({ success: false, error: 'الرابط التعريفي للسنتر (Slug) غير صالح' }, 400);
    }

    const tenantId = typeof body.id === 'string' && body.id ? body.id : `tenant-${cleanSlug}-001`;
    const nowIso = new Date().toISOString();

    const tenantData = {
      id: tenantId,
      slug: cleanSlug,
      nameAr,
      nameEn: typeof body.nameEn === 'string' ? body.nameEn.trim() : '',
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      address: typeof body.address === 'string' ? body.address.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      subscriptionPlan: typeof body.planId === 'string' ? body.planId : (body.subscriptionPlan || 'pro'),
      isActive: body.isActive !== false,
      settings: {
        currency: body.settings?.currency || 'EGP',
        enableWhatsApp: body.settings?.enableWhatsApp ?? true,
        enableFCM: body.settings?.enableFCM ?? true,
      },
      adminName: typeof body.adminName === 'string' ? body.adminName.trim() : '',
      adminEmail: typeof body.adminEmail === 'string' ? body.adminEmail.trim() : '',
      adminPhone: typeof body.adminPhone === 'string' ? body.adminPhone.trim() : '',
      adminUsername: typeof body.adminUsername === 'string' ? body.adminUsername.trim() : '',
      createdAt: body.createdAt || nowIso,
      updatedAt: nowIso,
    };

    // Commit to Cloud Firestore
    await store.commit([
      {
        type: 'set',
        documentPath: `tenants/${tenantId}`,
        data: tenantData,
      },
    ]);

    // Also register in current runtime DAL
    const dal = getDataProvider();
    await dal.createTenant(tenantData as any);

    return reply({ success: true, center: tenantData });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر إنشاء أو تعديل السنتر';
    return reply({ success: false, error: message }, 500);
  }
}

// DELETE /api/owner/centers — Remove a center from Cloud Firestore
export async function DELETE(req: NextRequest) {
  try {
    const { store } = await verifyOwner(req);
    const id = req.nextUrl.searchParams.get('id');

    if (!id) {
      return reply({ success: false, error: 'معرف السنتر المطلوب حذفه مفقود' }, 400);
    }

    await store.commit([
      {
        type: 'delete',
        documentPath: `tenants/${id}`,
      },
    ]);

    // Also remove from runtime DAL
    const dal = getDataProvider();
    const index = dal.tenants.findIndex((t) => t.id === id);
    if (index >= 0) {
      dal.tenants.splice(index, 1);
    }

    return reply({ success: true, deletedId: id });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر حذف السنتر';
    return reply({ success: false, error: message }, 500);
  }
}
