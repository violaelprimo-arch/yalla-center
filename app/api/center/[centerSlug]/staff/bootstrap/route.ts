import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
  type StaffMembershipRecord,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
};

function reply(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { centerSlug } = await Promise.resolve(params);
    const dal = getDataProvider();
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant?.isActive) {
      return reply({ success: false, error: 'السنتر غير موجود أو غير نشط' }, 404);
    }

    const bearer = extractBearerToken(req.headers.get('authorization'));
    if (!bearer) {
      return reply({ success: false, error: 'يلزم تسجيل الدخول بحساب Firebase' }, 401);
    }

    const verifiedToken = await verifyFirebaseIdToken(bearer);
    const { uid, email, name } = verifiedToken;

    // Use service account if available, or caller ID token
    const store = await createServerFirestoreStore({ callerIdToken: bearer });

    // Check if staff doc already exists
    const docPath = `staff_memberships/${uid}`;
    const existing = await store.getDocument<StaffMembershipRecord>(docPath);

    if (existing.exists && existing.data.isActive) {
      return reply({
        success: true,
        isNew: false,
        member: existing.data,
        message: 'تم التحقق من صلاحيات الحساب بنجاح',
      });
    }

    const VERIFIED_OWNER_EMAILS = new Set([
      'fathyelprimo@gmail.com',
      'admin@yallacenter.com',
      'owner@yallacenter.com',
    ]);

    const normalizedEmail = (email || '').toLowerCase().trim();
    const isPlatformOwner = VERIFIED_OWNER_EMAILS.has(normalizedEmail);
    const tenantAdminEmail = (tenant as { adminEmail?: string }).adminEmail?.toLowerCase().trim();
    const isTenantOwner = tenantAdminEmail ? tenantAdminEmail === normalizedEmail : false;

    // Reject arbitrary uninvited accounts
    if (!isPlatformOwner && !isTenantOwner) {
      return reply(
        {
          success: false,
          error: 'الحساب غير مسجل كعضو في إدارة هذا السنتر. يجب دعوة الحساب من إدارة السنتر أولاً.',
        },
        403
      );
    }

    // Provision authorized admin
    const newMember: StaffMembershipRecord = {
      uid,
      email: email || '',
      displayName: name || email?.split('@')[0] || (isPlatformOwner ? 'مالك المنصة' : 'مدير السنتر'),
      tenantId: tenant.id,
      role: isPlatformOwner ? 'PLATFORM_OWNER' : 'CENTER_ADMIN',
      isActive: true,
      branchIds: [],
    };

    await store.commit([
      {
        type: 'set',
        documentPath: docPath,
        data: newMember as unknown as Record<string, unknown>,
      },
    ]);

    return reply({
      success: true,
      isNew: true,
      member: newMember,
      message: 'تم تفعيل صلاحيات مدير السنتر لحسابك بنجاح',
    });
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر تهيئة صلاحيات الحساب';
    return reply({ success: false, error: message }, 500);
  }
}
