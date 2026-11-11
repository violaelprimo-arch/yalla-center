import { NextRequest, NextResponse } from 'next/server';
import { getReceptionDataProvider } from '@/lib/dal/factory';
import { receptionSessionState } from '@/lib/attendance/reception';
import { recordReceptionScan } from '@/lib/attendance/checkin';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ centerSlug: string }> | { centerSlug: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { centerSlug } = resolvedParams;

    const dal = getReceptionDataProvider();
    const tenant = await dal.getTenantBySlug(centerSlug);
    if (!tenant) {
      return NextResponse.json(
        { success: false, error: 'CENTER_NOT_FOUND', message: 'السنتر غير موجود' },
        { status: 404 }
      );
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

    const result = await recordReceptionScan({
      tenantId: tenant.id,
      sessionId,
      studentCodeOrBarcode,
      verificationMethod: verificationMethod || 'barcode',
      cashierUserId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
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
