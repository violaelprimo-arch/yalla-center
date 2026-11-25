import { NextRequest, NextResponse } from 'next/server';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  hasPlatformOwnerClaim,
  verifyFirebaseIdToken,
  type StaffMembershipRecord,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function verifyOwner(req: NextRequest) {
  const bearer = extractBearerToken(req.headers.get('authorization'));
  if (!bearer) {
    throw new FirebaseAuthError(401, 'سجّل الدخول بحساب مالك المنصة للمتابعة');
  }

  const { uid, email, rawClaims } = await verifyFirebaseIdToken(bearer);
  const store = await createServerFirestoreStore({ callerIdToken: bearer });

  let isOwner = hasPlatformOwnerClaim(rawClaims);
  if (!isOwner) {
    try {
      const membership = await store.getDocument<StaffMembershipRecord>(`staff_memberships/${uid}`);
      if (
        membership.exists &&
        membership.data?.isActive &&
        membership.data.role === 'PLATFORM_OWNER'
      ) {
        isOwner = true;
      }
    } catch {
      isOwner = false;
    }
  }

  if (!isOwner) {
    throw new FirebaseAuthError(403, 'هذه العملية تتطلب صلاحية مالك المنصة (Platform Owner)');
  }

  return { uid, email: (email || '').toLowerCase().trim(), store, bearer };
}

// GET /api/owner/centers — Strictly read-only listing of all centers from Cloud Firestore
export async function GET(req: NextRequest) {
  try {
    const { store } = await verifyOwner(req);
    const rows = await store.queryCollection<Record<string, unknown>>('tenants', []);
    const centers = rows
      .map(row => ({
        ...row.data,
        id: (typeof row.data.id === 'string' && row.data.id) || row.id,
      }))
      .sort((a: Record<string, unknown>, b: Record<string, unknown>) =>
        String(b.createdAt || '').localeCompare(String(a.createdAt || ''))
      );
    return reply({ success: true, centers });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر جلب قائمة السناتر من السحابة';
    return reply({ success: false, error: message }, 500);
  }
}

// POST /api/owner/centers — Provision or update a center in Cloud Firestore
export async function POST(req: NextRequest) {
  try {
    const { store } = await verifyOwner(req);
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return reply({ success: false, error: 'بيانات الطلب غير صالحة' }, 400);
    }

    const nameAr = typeof body.nameAr === 'string' ? body.nameAr.trim() : '';
    const rawSlug = typeof body.slug === 'string' ? body.slug.trim() : '';
    const cleanSlug = rawSlug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (!nameAr) {
      return reply({ success: false, error: 'اسم السنتر بالعربية مطلوب' }, 400);
    }
    if (!cleanSlug) {
      return reply({ success: false, error: 'الرابط التعريفي للسنتر (Slug) غير صالح' }, 400);
    }

    const existingWithSlug = await store.queryCollection<Record<string, unknown>>('tenants', [
      { fieldPath: 'slug', op: 'EQUAL', value: cleanSlug },
    ]);
    const requestedId =
      typeof body.id === 'string' && body.id.trim() ? body.id.trim() : `tenant-${cleanSlug}-001`;
    if (existingWithSlug.some(row => row.id !== requestedId)) {
      return reply({ success: false, error: 'هذا الرابط التعريفي (Slug) مستخدم لسنتر آخر بالفعل' }, 409);
    }

    const nowIso = new Date().toISOString();
    const tenantData = {
      id: requestedId,
      slug: cleanSlug,
      nameAr,
      nameEn: typeof body.nameEn === 'string' ? body.nameEn.trim() : '',
      phone: typeof body.phone === 'string' ? body.phone.trim() : '',
      address: typeof body.address === 'string' ? body.address.trim() : '',
      email: typeof body.email === 'string' ? body.email.trim() : '',
      subscriptionPlan:
        typeof body.planId === 'string'
          ? body.planId.replace(/^plan-/, '')
          : body.subscriptionPlan || 'pro',
      subscriptionPlanId:
        typeof body.subscriptionPlanId === 'string'
          ? body.subscriptionPlanId
          : typeof body.planId === 'string'
            ? body.planId
            : 'plan-pro',
      subscriptionStartDate:
        typeof body.subscriptionStartDate === 'string'
          ? body.subscriptionStartDate
          : typeof body.startDate === 'string'
            ? body.startDate
            : nowIso,
      subscriptionEndDate:
        typeof body.subscriptionEndDate === 'string'
          ? body.subscriptionEndDate
          : typeof body.endDate === 'string'
            ? body.endDate
            : new Date(Date.now() + 365 * 86400000).toISOString(),
      billingAmount: typeof body.billingAmount === 'number' ? body.billingAmount : Number(body.customPrice || 3500),
      billingFrequency: body.billingFrequency === 'annual' ? 'annual' : 'monthly',
      aiBalance: typeof body.aiBalance === 'number' ? body.aiBalance : Number(body.aiAllocation ?? 250),
      enabledModules: Array.isArray(body.enabledModules)
        ? body.enabledModules
        : Array.isArray(body.modules)
          ? body.modules
          : ['attendance', 'reception', 'groups', 'exams', 'finance', 'materials'],
      isActive: body.isActive !== false && body.status !== 'suspended',
      settings: {
        currency: body.settings?.currency || 'EGP',
        enableWhatsApp: body.settings?.enableWhatsApp ?? true,
        enableFCM: body.settings?.enableFCM ?? true,
      },
      adminName: typeof body.adminName === 'string' ? body.adminName.trim() : '',
      adminEmail: typeof body.adminEmail === 'string' ? body.adminEmail.trim() : '',
      adminPhone: typeof body.adminPhone === 'string' ? body.adminPhone.trim() : '',
      adminUsername: typeof body.adminUsername === 'string' ? body.adminUsername.trim() : '',
      createdAt: typeof body.createdAt === 'string' ? body.createdAt : nowIso,
      updatedAt: nowIso,
    };

    await store.commit([
      {
        type: 'set',
        documentPath: `tenants/${requestedId}`,
        data: tenantData,
      },
    ]);

    return reply({ success: true, center: tenantData });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر إنشاء أو تعديل السنتر في السحابة';
    return reply({ success: false, error: message }, 500);
  }
}

// PATCH /api/owner/centers — Update status, AI balance, or subscription dates in Cloud Firestore
export async function PATCH(req: NextRequest) {
  try {
    const { store } = await verifyOwner(req);
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return reply({ success: false, error: 'معرف السنتر مطلوب' }, 400);
    }

    const docPath = `tenants/${id}`;
    const existing = await store.getDocument<Record<string, unknown>>(docPath);
    if (!existing.exists) {
      return reply({ success: false, error: 'السنتر غير موجود في قاعدة البيانات السحابية' }, 404);
    }

    const updated = {
      ...existing.data,
      ...(typeof body.isActive === 'boolean' ? { isActive: body.isActive } : {}),
      ...(typeof body.aiBalance === 'number' ? { aiBalance: body.aiBalance } : {}),
      ...(typeof body.subscriptionEndDate === 'string'
        ? { subscriptionEndDate: body.subscriptionEndDate }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await store.commit([
      {
        type: 'set',
        documentPath: docPath,
        data: updated,
        currentDocument: existing.updateTime ? { updateTime: existing.updateTime } : { exists: true },
      },
    ]);

    return reply({ success: true, center: updated });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر تحديث بيانات السنتر في السحابة';
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

    return reply({ success: true, deletedId: id });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر حذف السنتر';
    return reply({ success: false, error: message }, 500);
  }
}
