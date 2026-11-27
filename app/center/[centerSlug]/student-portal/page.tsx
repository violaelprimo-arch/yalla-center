'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  FileText,
  Wallet,
  ExternalLink,
  Award,
  Bell,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnimatedTabs } from '@/components/motion/animated-tabs';
import { StaggeredCardGrid } from '@/components/motion/staggered-card-grid';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { GradeProgressAnimation } from '@/components/motion/grade-progress-animation';
import { InteractiveBarChart } from '@/components/ui/interactive-chart';
import { EducationalSubjectBadge } from '@/components/motion/educational-graphics';
import { SkeletonKpiGrid } from '@/components/ui/skeleton';
import { getDataProvider } from '@/lib/dal/factory';
import { weeklySlots, GROUP_PRICING_LABELS } from '@/lib/timetable/group-schedule';
import { getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';
import type {
  User,
  StudentEnrollmentDetail,
  StudentAttendanceDetail,
  Invoice,
  Material,
  Exam,
  ExamSubmission,
} from '@/lib/dal/types';

const DAY_NAMES: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

export default function StudentPortalPage() {
  const { tenant, currentUser, currentRole, masterData } = useTenant();
  const token = masterData.auth.idToken;
  const dal = useMemo(() => getDataProvider(token || undefined), [token]);

  const [activeTab, setActiveTab] = useState<'overview' | 'timetable' | 'attendance' | 'grades' | 'finance' | 'materials'>('overview');
  const [loading, setLoading] = useState(true);
  const [studentRecord, setStudentRecord] = useState<User | null>(null);
  const [enrollments, setEnrollments] = useState<StudentEnrollmentDetail[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceDetail[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'test' && !token) {
      if (!masterData.auth.loading) setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    dal.getUsers(tenant.id, { role: 'STUDENT' })
      .then(async (studentsList) => {
        if (!active) return;
        const matched =
          studentsList.find(
            (s) =>
              s.id === currentUser.id ||
              (currentUser.email && s.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
              (currentUser.studentCode && s.studentCode === currentUser.studentCode)
          ) || (['PLATFORM_OWNER', 'CENTER_ADMIN'].includes(currentRole) ? studentsList[0] : null);

        setStudentRecord(matched || null);
        if (!matched) {
          setLoading(false);
          return;
        }

        const [enr, att, inv, mats, exms] = await Promise.all([
          dal.getStudentEnrollmentDetails(tenant.id, matched.id).catch(() => []),
          dal.getStudentAttendanceHistory(tenant.id, matched.id).catch(() => []),
          dal.getInvoices(tenant.id, { studentId: matched.id }).catch(() => []),
          dal.getMaterials(tenant.id, matched.grade ? { grade: matched.grade } : undefined).catch(() => []),
          dal.getExams(tenant.id, { status: 'published' }).catch(() => []),
        ]);

        if (!active) return;
        setEnrollments(enr);
        setAttendance(att);
        setInvoices(inv);
        setMaterials(mats);
        setExams(exms);

        // Fetch student submissions per enrolled group
        const groupIds = [...new Set(enr.map((e) => e.groupId))];
        if (groupIds.length > 0) {
          const subBatches = await Promise.all(
            groupIds.map((gid) => dal.getStudentExamSubmissions(tenant.id, gid, matched.id).catch(() => []))
          );
          if (active) setSubmissions(subBatches.flat());
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dal, tenant.id, token, masterData.auth.loading, currentUser.id, currentUser.email, currentUser.studentCode, currentRole]);

  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

  const avgGradePct = useMemo(() => {
    if (submissions.length === 0) return 0;
    const total = submissions.reduce((sum, s) => {
      if (typeof s.percentage === 'number') return sum + s.percentage;
      const ex = exams.find((e) => e.id === s.examId);
      return sum + (ex && ex.totalMarks > 0 ? (s.totalScore / ex.totalMarks) * 100 : s.totalScore);
    }, 0);
    return Math.round(total / submissions.length);
  }, [submissions, exams]);

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <SkeletonKpiGrid count={4} />
      </div>
    );
  }

  if (!studentRecord) {
    return (
      <div className="card-elevated p-8 rounded-3xl border border-border bg-card text-center space-y-4 max-w-xl mx-auto" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-brand-cyan-500/10 text-brand-cyan-500 flex items-center justify-center mx-auto">
          <GraduationCap className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-foreground">بوابة الطالب — {tenant.nameAr}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          لا يوجد ملف طالب نشط مرتبط بهذا الحساب في {tenant.nameAr} حالياً. سجّل الدخول بحساب الطالب المعتمد من إدارة السنتر لعرض الحصص والدرجات والمذكرات.
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Link href="/login">
            <Button variant="cyan" size="sm" className="font-bold">
              تسجيل الدخول بحساب الطالب
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Student Identity Hero Card */}
      <div className="card-elevated p-6 rounded-3xl border border-brand-cyan-500/30 bg-gradient-to-l from-brand-cyan-500/10 via-card to-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center overflow-hidden shadow-soft-sm shrink-0">
            {studentRecord.avatarUrl ? (
              <img src={studentRecord.avatarUrl} alt={studentRecord.fullName} className="w-full h-full object-cover" />
            ) : (
              <GraduationCap className="w-8 h-8" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-foreground">{studentRecord.fullName}</h1>
              {studentRecord.studentCode && (
                <Badge variant="cyan" className="text-xs font-mono">
                  {studentRecord.studentCode}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {studentRecord.stage ? getStageNameArabic(studentRecord.stage) : 'المرحلة التعليمية'}
              {studentRecord.grade ? ` — ${getGradeNameArabic(studentRecord.grade)}` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <EducationalSubjectBadge subject="math" size="sm" showLabel={false} />
          <EducationalSubjectBadge subject="chemistry" size="sm" showLabel={false} />
        </div>
      </div>

      {/* Personal KPI Metrics */}
      <StaggeredCardGrid columns={4}>
        <AnimatedMetric
          label="المجموعات المقيدة"
          value={enrollments.length}
          suffix=" مجموعة"
          color="cyan"
          icon={<BookOpen className="w-4 h-4" />}
        />
        <AnimatedMetric
          label="نسبة الحضور"
          value={attendanceRate}
          suffix="%"
          color="emerald"
          icon={<CheckCircle2 className="w-4 h-4" />}
          trend={{ value: 0, periodText: `${presentCount} من ${attendance.length} حصة مسجلة` }}
        />
        <AnimatedMetric
          label="متوسط الدرجات"
          value={avgGradePct}
          suffix="%"
          color="purple"
          icon={<Award className="w-4 h-4" />}
          trend={{ value: 0, periodText: `${submissions.length} امتحان مصحح` }}
        />
        <AnimatedMetric
          label="الرصيد المستحق"
          value={studentRecord.balanceDue || 0}
          suffix=" ج.م"
          color={(studentRecord.balanceDue || 0) > 0 ? 'amber' : 'emerald'}
          icon={<Wallet className="w-4 h-4" />}
        />
      </StaggeredCardGrid>

      {/* Navigation Tabs */}
      <div className="overflow-x-auto pb-1">
        <AnimatedTabs
          activeId={activeTab}
          onChange={(id) => setActiveTab(id as typeof activeTab)}
          tabs={[
            { id: 'overview', label: 'نظرة عامة', icon: <GraduationCap className="w-4 h-4" /> },
            { id: 'timetable', label: 'جدول الحصص', icon: <Calendar className="w-4 h-4" /> },
            { id: 'attendance', label: 'سجل الحضور', icon: <CheckCircle2 className="w-4 h-4" /> },
            { id: 'grades', label: 'الدرجات والاختبارات', icon: <Award className="w-4 h-4" /> },
            { id: 'materials', label: 'المذكرات والملازم', icon: <FileText className="w-4 h-4" /> },
            { id: 'finance', label: 'المدفوعات', icon: <Wallet className="w-4 h-4" /> },
          ]}
        />
      </div>

      {/* Overview Rings & Academic Chart */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5">
            <GradeProgressAnimation
              score={submissions.length > 0 ? avgGradePct : attendanceRate}
              totalMarks={100}
              title={submissions.length > 0 ? 'مؤشر الأداء الأكاديمي' : 'مؤشر الالتزام بالحضور'}
              examName={
                submissions.length > 0
                  ? `متوسط ${submissions.length} اختبارات مسجلة`
                  : `${presentCount} حضور من ${attendance.length} حصة`
              }
              rank={studentRecord.balanceDue <= 0 ? 'الحساب المالي منتظم' : 'يوجد رصيد مستحق'}
            />
          </div>
          <div className="lg:col-span-7">
            <InteractiveBarChart
              title="نتائج الاختبارات الأخيرة (%)"
              subtitle="رسم تفاعلي للدرجات الحقيقية المسجلة"
              height={210}
              valueFormatter={(v) => `${v}%`}
              emptyLabel="لا توجد نتائج امتحانات مصححة بعد"
              data={submissions.map((sub, idx) => {
                const ex = exams.find((e) => e.id === sub.examId);
                const pct =
                  typeof sub.percentage === 'number'
                    ? Math.round(sub.percentage)
                    : ex && ex.totalMarks > 0
                    ? Math.round((sub.totalScore / ex.totalMarks) * 100)
                    : sub.totalScore;
                return {
                  id: sub.id || String(idx),
                  label: ex?.title?.slice(0, 12) || `اختبار ${idx + 1}`,
                  value: pct,
                };
              })}
            />
          </div>
        </div>
      )}

      {/* Enrolled Groups & Weekly Timetable */}
      {(activeTab === 'overview' || activeTab === 'timetable') && (
        <div id="timetable" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-cyan-600" />
            <span>المجموعات وجدول الحصص المقيد بها ({enrollments.length})</span>
          </h2>
          {enrollments.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              لم يتم قيد الطالب في أي مجموعات دراسية حتى الآن.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {enrollments.map((enr) => {
                const slots = weeklySlots(enr.group);
                return (
                  <Card key={enr.id} className="border border-border hover:border-brand-cyan-500/50 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-sm font-bold text-foreground">
                          {enr.subject?.nameAr || enr.group.nameAr}
                        </CardTitle>
                        <Badge variant="outline" className="text-[11px] font-mono">
                          {GROUP_PRICING_LABELS[enr.group.pricingModel]}
                        </Badge>
                      </div>
                      <p className="text-xs text-brand-cyan-600 dark:text-brand-cyan-400 font-semibold">
                        {enr.teacher?.fullName || enr.group.teacherName || 'المعلم'}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="space-y-1">
                        {slots.map((slot) => (
                          <div key={slot.id} className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            <span>
                              {DAY_NAMES[slot.scheduleDay]} ({slot.startTime} - {slot.endTime})
                            </span>
                          </div>
                        ))}
                      </div>
                      {enr.classroom && (
                        <p className="text-[11px] text-muted-foreground">القاعة: {enr.classroom.nameAr}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Real Attendance Log */}
      {(activeTab === 'overview' || activeTab === 'attendance') && (
        <div id="attendance" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>سجل الحضور الفعلي</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            {attendance.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">لا توجد سجلات حضور مسجلة بعد.</p>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                    <th className="p-3">التاريخ</th>
                    <th className="p-3">المجموعة</th>
                    <th className="p-3">وقت المسح</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendance.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono text-foreground font-semibold">{row.session.sessionDate}</td>
                      <td className="p-3 font-bold text-foreground">{row.group?.nameAr || row.subject?.nameAr || 'حصة'}</td>
                      <td className="p-3 font-mono text-muted-foreground" dir="ltr">
                        {row.scannedAt ? row.scannedAt.slice(11, 16) : '—'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === 'present'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : row.status === 'late'
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {row.status === 'present' ? 'حاضر' : row.status === 'late' ? 'متأخر' : 'غائب'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Real Exams & Grades */}
      {(activeTab === 'overview' || activeTab === 'grades') && (
        <div id="grades" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            <span>الامتحانات المتاحة ونتائجك</span>
          </h2>
          {exams.length === 0 && submissions.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              لا توجد امتحانات منشورة أو درجات مسجلة حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {exams.map((ex) => {
                const sub = submissions.find((s) => s.examId === ex.id);
                return (
                  <div key={ex.id} className="card-elevated p-4 rounded-2xl border border-border flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{ex.title}</h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        الدرجة الكلية: {ex.totalMarks} · المدة: {ex.durationMinutes} دقيقة
                      </p>
                    </div>
                    {sub ? (
                      <Badge variant="success" className="font-mono text-xs">
                        {sub.totalScore} / {ex.totalMarks}
                      </Badge>
                    ) : (
                      <Link href={`/center/${tenant.slug}/exams/${ex.id}/run`}>
                        <Button size="sm" variant="cyan" className="text-xs font-bold">
                          بدء الامتحان
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Real Study Materials */}
      {(activeTab === 'overview' || activeTab === 'materials') && (
        <div id="materials" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-cyan-600" />
            <span>المذكرات والملازم الدراسية ({materials.length})</span>
          </h2>
          {materials.length === 0 ? (
            <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
              لا توجد مذكرات مرفوعة لصفك الدراسي حالياً.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {materials.map((mat) => (
                <div
                  key={mat.id}
                  className="card-elevated p-4 rounded-2xl border border-border flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-[10px]">
                      {mat.unitName} · {mat.lessonName}
                    </Badge>
                    <h3 className="text-xs font-bold text-foreground leading-snug">{mat.title}</h3>
                  </div>
                  {mat.googleDriveWebViewLink && (
                    <a
                      href={mat.googleDriveWebViewLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl border border-border hover:bg-muted text-xs font-bold text-brand-cyan-600"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>فتح / تحميل المذكرة</span>
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Real Invoices & Finances */}
      {activeTab === 'finance' && (
        <div id="finance" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-500" />
            <span>سجل الفواتير والمدفوعات ({invoices.length})</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            {invoices.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">لا توجد فواتير مسجلة حالياً.</p>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                    <th className="p-3">الفترة</th>
                    <th className="p-3">المبلغ الصافي</th>
                    <th className="p-3">المدفوع</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-bold">
                        {inv.billingMonth}/{inv.billingYear}
                      </td>
                      <td className="p-3 font-mono">{inv.netAmount} ج.م</td>
                      <td className="p-3 font-mono text-emerald-600">{inv.paidAmount} ج.م</td>
                      <td className="p-3">
                        <Badge variant={inv.status === 'paid' ? 'success' : 'outline'} className="text-[10px]">
                          {inv.status === 'paid' ? 'مسددة' : inv.status === 'partially_paid' ? 'مسددة جزئياً' : 'مستحقة'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
