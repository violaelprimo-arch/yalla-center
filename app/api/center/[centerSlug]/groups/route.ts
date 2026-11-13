import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getDataProvider } from '@/lib/dal/factory';
import type { GroupInput } from '@/lib/dal/types';

export const dynamic = 'force-dynamic';

type RouteContext = {
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
};

const weeklyScheduleSlotSchema = z.object({
  id: z.string().optional(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().min(1, 'وقت البدء مطلوب'),
  endTime: z.string().min(1, 'وقت الانتهاء مطلوب'),
  classroomId: z.string().min(1, 'القاعة مطلوبة'),
  branchId: z.string().optional(),
});

const groupInputSchema = z.object({
  id: z.string().optional(),
  nameAr: z.string().min(1, 'اسم المجموعة مطلوب'),
  stage: z.string().min(1, 'المرحلة التعليمية مطلوبة'),
  grade: z.string().min(1, 'الصف الدراسي مطلوب'),
  subjectId: z.string().min(1, 'المادة الدراسية مطلوبة'),
  teacherId: z.string().min(1, 'المعلم مطلوب'),
  branchId: z.string().min(1, 'الفرع مطلوب'),
  classroomId: z.string().optional(),
  academicYear: z.string().optional(),
  pricingModel: z.enum([
    'center',
    'private',
    'average_monthly',
    'private_percentage',
    'per_session_fixed',
    'fixed_session',
    'per_attendee',
  ]),
  monthlyFee: z.number().optional(),
  sessionFee: z.number().optional(),
  teacherRatePerStudent: z.number().optional(),
  teacherPercentage: z.number().optional(),
  centerPercentage: z.number().optional(),
  teacherSessionAmount: z.number().optional(),
  centerSessionAmount: z.number().optional(),
  maxStudents: z.number().int().positive().optional(),
  weeklySchedules: z.array(weeklyScheduleSlotSchema).min(1, 'يجب تحديد موعد حصة واحدة على الأقل في الأسبوع'),
  isActive: z.boolean().optional(),
});

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const dal = getDataProvider();
    const tenant = (await dal.getTenants()).find((t) => t.slug === params.centerSlug) || (await dal.getTenants())[0];
    const tenantId = tenant?.id || 'tenant-maher-001';

    const [groups, subjects, teachers, stages, branches, classrooms, sessions] = await Promise.all([
      dal.getGroups(tenantId),
      dal.getSubjects(tenantId),
      dal.getUsers(tenantId, { role: 'TEACHER' }),
      dal.getStages(tenantId),
      dal.getBranches(tenantId),
      dal.getClassrooms(tenantId),
      dal.getSessions(tenantId),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        groups,
        subjects,
        teachers,
        stages,
        branches,
        classrooms,
        sessions,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر تحميل بيانات المجموعات' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const dal = getDataProvider();
    const tenant = (await dal.getTenants()).find((t) => t.slug === params.centerSlug) || (await dal.getTenants())[0];
    const tenantId = tenant?.id || 'tenant-maher-001';

    const body = await request.json();
    const validated = groupInputSchema.safeParse(body);
    if (!validated.success) {
      return NextResponse.json(
        { success: false, error: validated.error.issues[0]?.message || 'بيانات المجموعة غير صالحة' },
        { status: 400 }
      );
    }

    const saved = await dal.saveGroup(tenantId, validated.data as GroupInput);
    return NextResponse.json({ success: true, data: saved });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر حفظ المجموعة' },
      { status: 400 }
    );
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  try {
    const params = await Promise.resolve(context.params);
    const dal = getDataProvider();
    const tenant = (await dal.getTenants()).find((t) => t.slug === params.centerSlug) || (await dal.getTenants())[0];
    const tenantId = tenant?.id || 'tenant-maher-001';

    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('id');
    if (!groupId) {
      return NextResponse.json({ success: false, error: 'معرف المجموعة مطلوب' }, { status: 400 });
    }

    const result = await dal.deleteGroup(tenantId, groupId);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error || 'تعذر حذف المجموعة' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'تعذر حذف المجموعة' },
      { status: 500 }
    );
  }
}
