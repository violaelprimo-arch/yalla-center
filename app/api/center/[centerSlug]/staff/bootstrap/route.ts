import { NextRequest, NextResponse } from 'next/server';
import { getDataProvider } from '@/lib/dal/factory';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  hasPlatformOwnerClaim,
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
    const bearer = extractBearerToken(req.headers.get('authorization'));
    if (!bearer) {
      return reply({ success: false, error: 'يلزم تسجيل الدخول بحساب Firebase' }, 401);
    }

    const dal = getDataProvider(bearer);
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant?.isActive) {
      return reply({ success: false, error: 'السنتر غير موجود أو غير نشط' }, 404);
    }

    const verifiedToken = await verifyFirebaseIdToken(bearer);
    const { uid, email, name, rawClaims } = verifiedToken;

    const store = await createServerFirestoreStore({ callerIdToken: bearer });
    const docPath = `staff_memberships/${uid}`;
    const existing = await store.getDocument<StaffMembershipRecord>(docPath);

    if (existing.exists && existing.data.isActive) {
      if (existing.data.role !== 'PLATFORM_OWNER' && existing.data.tenantId !== tenant.id) {
        return reply({ success: false, error: 'هذا الحساب تابع لسنتر آخر' }, 403);
      }
      return reply({
        success: true,
        isNew: false,
        member: existing.data,
        message: 'تم التحقق من صلاحيات الحساب بنجاح',
      });
    }

    // Only verified Firebase custom claim PLATFORM_OWNER may bootstrap their own membership;
    // NO self-provisioning for CENTER_ADMIN or from email allowlists!
    if (hasPlatformOwnerClaim(rawClaims)) {
      const newMember: StaffMembershipRecord = {
        uid,
        email: email || '',
        displayName: name || email?.split('@')[0] || 'مالك المنصة',
        tenantId: tenant.id,
        role: 'PLATFORM_OWNER',
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
        message: 'تم تفعيل صلاحيات مالك المنصة لحسابك بنجاح',
      });
    }

    return reply(
      {
        success: false,
        error: 'الحساب غير مسجل كعضو في إدارة هذا السنتر. يجب إضافة العضوية من الإدارة أولاً.',
      },
      403
    );
  } catch (error) {
    if (error instanceof FirebaseAuthError) {
      return reply({ success: false, error: error.message }, error.status);
    }
    const message = error instanceof Error ? error.message : 'تعذّر تهيئة صلاحيات الحساب';
    return reply({ success: false, error: message }, 500);
  }
}
