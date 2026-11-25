import { NextRequest, NextResponse } from 'next/server';
import { getReceptionDataProvider, isCloudProductionMode } from '@/lib/dal/factory';
import { receptionSessionState } from '@/lib/attendance/reception';
import { recordReceptionScan } from '@/lib/attendance/checkin';
import {
  authorizeStaffMember,
  CenterOperationsError,
} from '@/lib/firebase/center-operations-service';
import {
  createServerFirestoreStore,
  extractBearerToken,
  FirebaseAuthError,
  verifyFirebaseIdToken,
} from '@/lib/firebase/server';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { centerSlug } = resolvedParams;

    const bearer = extractBearerToken(req.headers.get('authorization'));
    const dal = getReceptionDataProvider(undefined, bearer ?? undefined);
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'CENTER_NOT_FOUND', message: 'السنتر غير موجود' },
        { status: 404 }
      );
    }

    let verifiedCashierUid: string | undefined;
    if (isCloudProductionMode() || bearer) {
      if (!bearer) {
        return NextResponse.json(
          { success: false, error: 'UNAUTHORIZED', message: 'سجّل الدخول بحساب الاستقبال أو الإدارة' },
          { status: 401 }
        );
      }
      const { uid } = await verifyFirebaseIdToken(bearer);
      const store = await createServerFirestoreStore({ callerIdToken: bearer });
      await authorizeStaffMember(store, uid, tenant.id, [
        'CENTER_ADMIN',
        'BRANCH_MANAGER',
        'RECEPTIONIST',
        'TEACHER',
        'PLATFORM_OWNER',
      ]);
      verifiedCashierUid = uid;
    }

    const body = await req.json();
    const { sessionId, studentCodeOrBarcode, verificationMethod, cashierUserId } = body;

    if (!sessionId || !studentCodeOrBarcode) {
      return NextResponse.json(
        {
          success: false,
          error: 'MISSING_FIELDS',
          message: 'معرف الحصة وكود الطالب أو الباركود مطلوبان',
        },
        { status: 400 }
      );
    }

    const session = await dal.getSessionById(tenant.id, sessionId);
    if (session && !receptionSessionState(session)) {
      return NextResponse.json(
        { success: false, error: 'SESSION_CLOSED', message: 'الحصة غير متاحة لتسجيل الحضور' },
        { status: 409 }
      );
    }

    const result = isCloudProductionMode()
      ? await (async () => {
          const scan = await dal.recordAttendanceScan(
            tenant.id,
            sessionId,
            studentCodeOrBarcode,
            verifiedCashierUid || cashierUserId,
            verificationMethod || 'barcode'
          );
          return {
            success: scan.success,
            isNewRecord: scan.isNewRecord,
            isDuplicate: scan.isDuplicate,
            attendance: scan.attendance,
            student: scan.student,
            session: scan.session,
            balanceAlert: scan.balanceAlert,
            messageArabic: scan.messageAr,
          };
        })()
      : await recordReceptionScan({
          tenantId: tenant.id,
          sessionId,
          studentCodeOrBarcode,
          verificationMethod: verificationMethod || 'barcode',
          cashierUserId: verifiedCashierUid || cashierUserId,
        });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    if (err instanceof CenterOperationsError || err instanceof FirebaseAuthError) {
      return NextResponse.json(
        { success: false, error: 'AUTH_ERROR', message: err.message },
        { status: err.status }
      );
    }
    const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تسجيل الحضور';
    const isNotFound = message.includes('لم يتم العثور على طالب') || message.includes('غير موجودة');
    return NextResponse.json(
      {
        success: false,
        error: isNotFound ? 'STUDENT_OR_SESSION_NOT_FOUND' : 'INTERNAL_ERROR',
        message,
      },
      { status: isNotFound ? 404 : 500 }
    );
  }
}
