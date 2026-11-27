'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Wallet,
  Award,
  Bell,
  ChevronDown,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Drawer } from '@/components/ui/drawer';
import { StaggeredCardGrid } from '@/components/motion/staggered-card-grid';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { GradeProgressAnimation } from '@/components/motion/grade-progress-animation';
import { EducationalSubjectBadge } from '@/components/motion/educational-graphics';
import { SkeletonKpiGrid } from '@/components/ui/skeleton';
import { getDataProvider } from '@/lib/dal/factory';
import { weeklySlots } from '@/lib/timetable/group-schedule';
import { getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';
import type {
  User,
  StudentEnrollmentDetail,
  StudentAttendanceDetail,
  Invoice,
  ExamSubmission,
  NotificationLog,
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

export default function ParentPortalPage() {
  const { tenant, currentUser, currentRole, masterData } = useTenant();
  const token = masterData.auth.idToken;
  const dal = useMemo(() => getDataProvider(token || undefined), [token]);

  const [loading, setLoading] = useState(true);
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [childSwitcherOpen, setChildSwitcherOpen] = useState(false);

  const [enrollments, setEnrollments] = useState<StudentEnrollmentDetail[]>([]);
  const [attendance, setAttendance] = useState<StudentAttendanceDetail[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [submissions, setSubmissions] = useState<ExamSubmission[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);

  useEffect(() => {
    if (process.env.NODE_ENV !== 'test' && !token) {
      if (!masterData.auth.loading) setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);

    dal.getUsers(tenant.id, { role: 'STUDENT' })
      .then((allStudents) => {
        if (!active) return;
        const linked = allStudents.filter(
          (st) =>
            (currentUser.phone && st.guardianPhone === currentUser.phone) ||
            (currentUser.email && st.email?.toLowerCase() === currentUser.email.toLowerCase()) ||
            st.id === currentUser.id
        );
        const list =
          linked.length > 0
            ? linked
            : ['PLATFORM_OWNER', 'CENTER_ADMIN'].includes(currentRole)
            ? allStudents
            : [];
        setChildren(list);
        if (list.length > 0) {
          setSelectedChildId((prev) => (list.some((c) => c.id === prev) ? prev : list[0].id));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dal, tenant.id, token, masterData.auth.loading, currentUser.id, currentUser.phone, currentUser.email, currentRole]);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0] || null;

  useEffect(() => {
    if (!activeChild) return;
    let active = true;
    Promise.all([
      dal.getStudentEnrollmentDetails(tenant.id, activeChild.id).catch(() => []),
      dal.getStudentAttendanceHistory(tenant.id, activeChild.id).catch(() => []),
      dal.getInvoices(tenant.id, { studentId: activeChild.id }).catch(() => []),
      dal.getNotifications ? dal.getNotifications(tenant.id, 10).catch(() => []) : Promise.resolve([]),
    ])
      .then(async ([enr, att, inv, notifs]) => {
        if (!active) return;
        setEnrollments(enr);
        setAttendance(att);
        setInvoices(inv);
        setNotifications(notifs);

        const groupIds = [...new Set(enr.map((e) => e.groupId))];
        if (groupIds.length > 0) {
          const subs = await Promise.all(
            groupIds.map((gid) => dal.getStudentExamSubmissions(tenant.id, gid, activeChild.id).catch(() => []))
          );
          if (active) setSubmissions(subs.flat());
        } else {
          setSubmissions([]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [dal, tenant.id, activeChild]);

  if (loading) {
    return (
      <div className="space-y-6" dir="rtl">
        <SkeletonKpiGrid count={3} />
      </div>
    );
  }

  if (!activeChild) {
    return (
      <div className="card-elevated p-8 rounded-3xl border border-border bg-card text-center space-y-4 max-w-xl mx-auto" dir="rtl">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/10 text-orange-500 flex items-center justify-center mx-auto">
          <Users className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-black text-foreground">بوابة ولي الأمر — {tenant.nameAr}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          لا يوجد طلاب مرتبطون برقم هاتف أو حساب ولي الأمر هذا داخل {tenant.nameAr} حتى الآن. تواصل مع إدارة السنتر لربط ملفات أبنائك ببياناتك.
        </p>
        <div className="pt-2">
          <Link href="/login">
            <Button variant="outline" size="sm" className="font-bold">
              تبديل الحساب / تسجيل الدخول
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = attendance.length > 0 ? Math.round((presentCount / attendance.length) * 100) : 0;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header with Desktop & Mobile Child Switcher */}
      <div className="card-elevated p-6 rounded-3xl border border-orange-500/30 bg-gradient-to-l from-orange-500/10 via-card to-card flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-black text-foreground">بوابة ولي الأمر للمتابعة الفورية</h1>
              <Badge variant="outline" className="text-xs">
                {children.length} {children.length === 1 ? 'طالب' : 'أبناء'}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              متابعة مباشرة لحضور أبنائك ودرجاتهم وحالة المصروفات في {tenant.nameAr}.
            </p>
          </div>
        </div>

        {/* Desktop Selector & Mobile Drawer Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChildSwitcherOpen(true)}
            className="md:hidden inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card font-bold text-xs text-foreground shadow-soft-sm"
          >
            <GraduationCap className="w-4 h-4 text-orange-500" />
            <span>{activeChild.fullName}</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="hidden md:flex items-center gap-2 bg-muted/60 p-2 rounded-xl border border-border">
            <GraduationCap className="w-4 h-4 text-orange-500 shrink-0" />
            <select
              aria-label="اختيار الطالب للمتابعة"
              value={activeChild.id}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id} className="bg-card text-foreground">
                  {c.fullName} {c.studentCode ? `(${c.studentCode})` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Child KPIs */}
      <StaggeredCardGrid columns={3}>
        <AnimatedMetric
          label="نسبة الانضباط والحضور"
          value={attendanceRate}
          suffix="%"
          color="emerald"
          icon={<CheckCircle2 className="w-4 h-4" />}
          trend={{ value: 0, periodText: `${presentCount} من ${attendance.length} حصة مسجلة` }}
        />
        <AnimatedMetric
          label="المجموعات المقيد بها"
          value={enrollments.length}
          suffix=" مجموعة"
          color="cyan"
          icon={<GraduationCap className="w-4 h-4" />}
          trend={{
            value: 0,
            periodText: `${activeChild.stage ? getStageNameArabic(activeChild.stage) : ''} ${activeChild.grade ? getGradeNameArabic(activeChild.grade) : ''}`,
          }}
        />
        <AnimatedMetric
          label="المستحقات المالية الحالية"
          value={activeChild.balanceDue || 0}
          suffix=" ج.م"
          color={(activeChild.balanceDue || 0) > 0 ? 'amber' : 'emerald'}
          icon={<Wallet className="w-4 h-4" />}
          trend={{ value: 0, periodText: `${invoices.length} فاتورة مسجلة` }}
        />
      </StaggeredCardGrid>

      {/* Progress Visualization & Notifications Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5">
          <GradeProgressAnimation
            score={attendanceRate}
            totalMarks={100}
            title={`انضباط ${activeChild.fullName}`}
            examName={`${presentCount} حصة حضور من أصل ${attendance.length}`}
            rank={activeChild.balanceDue <= 0 ? 'الحساب مسدد بالكامل' : `مستحق: ${activeChild.balanceDue} ج.م`}
          />
        </div>

        <div className="lg:col-span-7 card-elevated p-5 rounded-2xl border border-border bg-card space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-brand-cyan-500" />
              <span>أحدث التنبيهات والإشعارات ({notifications.length})</span>
            </h2>
            <EducationalSubjectBadge subject="languages" size="sm" showLabel={false} />
          </div>
          {notifications.length > 0 ? (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {notifications.slice(0, 5).map((notif) => (
                <div key={notif.id} className="p-3 rounded-xl border border-border bg-muted/20 text-xs flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-foreground">{notif.templateName}</p>
                    <p className="text-muted-foreground mt-0.5">{notif.recipientPhone}</p>
                  </div>
                  <Badge variant={notif.status === 'delivered' ? 'success' : 'outline'} className="text-[10px]">
                    {notif.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-6 text-center">
              ستظهر هنا تنبيهات الحضور والدرجات وسداد المصروفات فور إرسالها.
            </p>
          )}
        </div>
      </div>

      {/* Enrolled Groups */}
      <div id="overview" className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-cyan-600" />
          <span>المجموعات المقيد بها «{activeChild.fullName}»</span>
        </h2>
        {enrollments.length === 0 ? (
          <p className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            لا توجد مجموعات مقيد بها الطالب حالياً.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrollments.map((enr) => {
              const slots = weeklySlots(enr.group);
              return (
                <div key={enr.id} className="card-elevated p-4 rounded-xl border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground">{enr.subject?.nameAr || enr.group.nameAr}</h3>
                    <span className="text-xs font-semibold text-brand-cyan-600 dark:text-brand-cyan-400">
                      {enr.teacher?.fullName || enr.group.teacherName || 'المعلم'}
                    </span>
                  </div>
                  {slots.map((slot) => (
                    <div key={slot.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {DAY_NAMES[slot.scheduleDay]} ({slot.startTime} - {slot.endTime})
                        {enr.classroom ? ` • ${enr.classroom.nameAr}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Real Attendance & Exam Submissions Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div id="attendance" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>سجل الحضور الأخير</span>
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
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {attendance.slice(0, 10).map((row) => (
                    <tr key={row.id} className="hover:bg-muted/20">
                      <td className="p-3 font-mono font-semibold text-foreground">{row.session.sessionDate}</td>
                      <td className="p-3 font-bold text-foreground">{row.group?.nameAr || 'حصة'}</td>
                      <td className="p-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            row.status === 'present'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'bg-red-500/10 text-red-600 dark:text-red-400'
                          }`}
                        >
                          {row.status === 'present' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
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

        <div id="grades" className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            <span>درجات الامتحانات المسجلة ({submissions.length})</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            {submissions.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">لا توجد درجات امتحانات مسجلة لهذا الطالب بعد.</p>
            ) : (
              <table className="w-full text-right text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                    <th className="p-3">الامتحان</th>
                    <th className="p-3">الدرجة</th>
                    <th className="p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {submissions.map((g) => (
                    <tr key={g.id} className="hover:bg-muted/20">
                      <td className="p-3 font-bold text-foreground">{g.examId}</td>
                      <td className="p-3 font-black font-mono text-brand-cyan-600 dark:text-brand-cyan-400">
                        {g.totalScore} {typeof g.percentage === 'number' ? `(${Math.round(g.percentage)}%)` : ''}
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">
                        {(g.submittedAt || '').slice(0, 10)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Bottom Child Switcher Drawer */}
      <Drawer
        isOpen={childSwitcherOpen}
        onClose={() => setChildSwitcherOpen(false)}
        side="bottom"
        size="sm"
        title="اختر الطالب للمتابعة"
      >
        <div className="space-y-2">
          {children.map((c) => {
            const active = c.id === activeChild.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSelectedChildId(c.id);
                  setChildSwitcherOpen(false);
                }}
                className={`w-full p-3.5 rounded-xl border text-right flex items-center justify-between transition-colors ${
                  active
                    ? 'border-brand-cyan-500 bg-brand-cyan-500/10 font-bold text-foreground'
                    : 'border-border bg-card text-foreground hover:bg-muted'
                }`}
              >
                <span>{c.fullName}</span>
                {c.studentCode && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {c.studentCode}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </Drawer>
    </div>
  );
}
