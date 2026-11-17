'use client';

import React, { useState, useMemo, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  MinusCircle,
  Percent,
  Phone,
  Printer,
  Receipt,
  RefreshCw,
  Sparkles,
  UserCheck,
  Users,
  Wallet,
  X,
  Layers,
  DollarSign,
  PlusCircle,
  ArrowDownLeft,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Group, TeacherMonthlyStatement, User } from '@/lib/dal/types';
import { getDataProvider } from '@/lib/dal/factory';
import { getStageNameArabic } from '@/lib/materials/taxonomy';

const ARABIC_MONTHS = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
];

interface Props {
  tenantSlug: string;
  statement: TeacherMonthlyStatement;
  teachers: User[];
  groups: Group[];
  isLoading: boolean;
  onLoad: (teacherId: string, month: number, year: number) => void;
  onClose: () => void;
}

export function TeacherAccountingView({ tenantSlug, statement, teachers, groups, isLoading, onLoad, onClose }: Props) {
  const { teacherId: selectedTeacherId, payrollMonth: month, payrollYear: year } = statement;
  const allTeachers = teachers.some(teacher => teacher.id === selectedTeacherId) ? teachers
    : [...teachers, { id: selectedTeacherId, fullName: statement.teacherName, phone: statement.teacherPhone }];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups((prev) => ({
      ...prev,
      [groupId]: prev[groupId] === false,
    }));
  };

  function moveMonth(offset: number) {
    const date = new Date(Date.UTC(year, month - 1 + offset, 1));
    onLoad(selectedTeacherId, date.getUTCMonth() + 1, date.getUTCFullYear());
  }

  // Disbursement Modal State
  const [showDisburseModal, setShowDisburseModal] = useState(false);
  const [disburseAmount, setDisburseAmount] = useState(() => String(statement?.summary.netPayrollInvoiced || ''));
  const [disburseDate, setDisburseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [disburseMethod, setDisburseMethod] = useState<'cash' | 'vodafone_cash' | 'instapay'>('cash');
  const [disburseReason, setDisburseReason] = useState(() => `صرف مستحقات شهر ${ARABIC_MONTHS[month - 1]} ${year}`);
  const [disbursing, setDisbursing] = useState(false);
  const [disburseError, setDisburseError] = useState('');
  const [disburseSuccess, setDisburseSuccess] = useState('');

  // Handle Disbursement Submit
  async function handleDisburseSubmit(e: FormEvent) {
    e.preventDefault();
    setDisburseError('');
    const amt = parseFloat(disburseAmount);
    if (isNaN(amt) || amt <= 0) {
      setDisburseError('أدخل مبلغًا صحيحًا للصرف أكبر من صفر');
      return;
    }
    setDisbursing(true);
    try {
      await getDataProvider().recordTeacherAdvance({
        tenantId: statement.tenantId,
        teacherId: selectedTeacherId,
        amount: amt,
        reason: `${disburseReason} (${disburseMethod === 'cash' ? 'نقدًا' : disburseMethod === 'vodafone_cash' ? 'فودافون كاش' : 'إنستاباي'}) [${disburseDate}]`,
        disbursedByUserId: 'admin-action',
      });
      setDisburseSuccess(`تم تسجيل صرف مبلغ ${amt.toFixed(2)} ج.م بنجاح وتحديث الحساب`);
      setTimeout(() => {
        setShowDisburseModal(false);
        setDisburseSuccess('');
        onLoad(selectedTeacherId, month, year);
      }, 1000);
    } catch (cause) {
      setDisburseError(cause instanceof Error ? cause.message : 'تعذّر تسجيل عملية الصرف');
    } finally {
      setDisbursing(false);
    }
  }

  // Unified Multi-Group Breakdown Rows
  const unifiedGroups = useMemo(() => {
    if (!statement) return [];
    const rows: Array<{
      groupId: string;
      groupName: string;
      stageName: string;
      pricingModelLabel: string;
      pricingModel: string;
      conductedSessionsCount: number;
      totalAttendance: number;
      compensationAmount: number;
      rateDescription: string;
      calculationText: string;
      sessions?: Array<{
        sessionId: string;
        sessionDate: string;
        startTime?: string;
        endTime?: string;
        classroomName?: string;
        status: string;
        attendanceCount: number;
        dueAmount: number;
        detail: string;
      }>;
    }> = [];

    // 1. Center Subscription Groups (نظام السنتر — متوسط الحضور)
    for (const cg of statement.centerSubscription.groups) {
      const grp = groups.find((g) => g.id === cg.groupId);
      const stageName = grp?.stageId ? getStageNameArabic(grp.stageId) : 'المرحلة الدراسية';
      rows.push({
        groupId: cg.groupId,
        groupName: cg.groupName,
        stageName,
        pricingModelLabel: 'نظام السنتر — متوسط الحضور',
        pricingModel: 'center',
        conductedSessionsCount: cg.conductedSessionsCount,
        totalAttendance: cg.totalValidAttendance,
        compensationAmount: cg.compensationAmount,
        rateDescription: `الفئة: ${cg.ratePerStudent.toFixed(2)} ج.م/طالب`,
        calculationText: `${cg.totalValidAttendance} حضور ÷ ${cg.conductedSessionsCount} حصص = ${cg.averageAttendance.toFixed(2)} متوسط × ${cg.ratePerStudent.toFixed(2)} ج.م = ${cg.compensationAmount.toFixed(2)} ج.م`,
        sessions: cg.sessions?.map((s) => ({
          sessionId: s.sessionId,
          sessionDate: s.sessionDate,
          startTime: s.startTime,
          endTime: s.endTime,
          classroomName: s.classroomName,
          status: s.status,
          attendanceCount: s.validAttendanceCount,
          dueAmount: cg.conductedSessionsCount ? (s.validAttendanceCount * cg.ratePerStudent / cg.conductedSessionsCount) : 0,
          detail: s.status === 'canceled' ? 'ملغاة (مستبعدة من المتوسط)' : `${s.validAttendanceCount} حضور يدخل في حساب المتوسط`,
        })),
      });
    }

    // 2. Private Lessons Groups (نظام البرايفت — النسبة المئوية)
    for (const pg of statement.privateLessons.groups) {
      const grp = groups.find((g) => g.id === pg.groupId);
      const stageName = grp?.stageId ? getStageNameArabic(grp.stageId) : 'المرحلة الدراسية';
      rows.push({
        groupId: pg.groupId,
        groupName: pg.groupName,
        stageName,
        pricingModelLabel: 'نظام البرايفت — النسبة المئوية',
        pricingModel: 'private',
        conductedSessionsCount: grp ? 4 : 0,
        totalAttendance: pg.enrolledCount,
        compensationAmount: pg.totalTeacherShare,
        rateDescription: `نسبة المعلم: ${pg.teacherPercentage}% (السنتر: ${pg.centerPercentage}%)`,
        calculationText: `صافي الإيراد: ${pg.totalNetRevenue.toFixed(2)} ج.م × ${pg.teacherPercentage}% = ${pg.totalTeacherShare.toFixed(2)} ج.م (بدون تكرار الحصة)`,
        sessions: pg.items?.map((it) => ({
          sessionId: it.enrollmentId,
          sessionDate: 'اشتراك شهري',
          classroomName: it.studentName,
          status: 'completed',
          attendanceCount: 1,
          dueAmount: it.teacherShare,
          detail: `اشتراك ${it.basePrice.toFixed(2)} ج.م - صافي ${it.netRevenue.toFixed(2)} ج.م × ${pg.teacherPercentage}% = ${it.teacherShare.toFixed(2)} ج.م`,
        })),
      });
    }

    // 3. Lesson / Session-based Groups (fixed_session, per_attendee, per_session)
    if (statement.lessonCompensation?.sessions) {
      const groupedByGroupName = new Map<string, typeof statement.lessonCompensation.sessions>();
      for (const sess of statement.lessonCompensation.sessions) {
        const list = groupedByGroupName.get(sess.groupName) || [];
        list.push(sess);
        groupedByGroupName.set(sess.groupName, list);
      }

      for (const [gName, sessions] of groupedByGroupName.entries()) {
        const first = sessions[0];
        const grp = groups.find((g) => g.nameAr === gName);
        const stageName = grp?.stageId ? getStageNameArabic(grp.stageId) : 'المرحلة الدراسية';
        const modelLabel =
          first.model === 'fixed_session'
            ? 'أجر ثابت للحصة'
            : first.model === 'per_attendee'
            ? 'أجر ثابت لكل طالب حاضر'
            : 'نظام الدفع بالحصة';
        const totalAttendance = sessions.reduce((acc, s) => acc + s.attendanceCount, 0);
        const totalDue = sessions.reduce((acc, s) => acc + s.teacherDue, 0);
        const rateDesc =
          first.model === 'fixed_session'
            ? `أجر ثابت: ${first.rate.toFixed(2)} ج.م/حصة`
            : first.model === 'per_attendee'
            ? `الفئة: ${first.rate.toFixed(2)} ج.م/طالب حاضر`
            : `الفئة: ${first.rate.toFixed(2)} ج.م`;

        rows.push({
          groupId: grp?.id || `group-${gName}`,
          groupName: gName,
          stageName,
          pricingModelLabel: modelLabel,
          pricingModel: first.model,
          conductedSessionsCount: sessions.length,
          totalAttendance,
          compensationAmount: totalDue,
          rateDescription: rateDesc,
          calculationText:
            first.model === 'fixed_session'
              ? `${sessions.length} حصص منفذة × ${first.rate.toFixed(2)} ج.م = ${totalDue.toFixed(2)} ج.م`
              : `${totalAttendance} طالب حاضر × ${first.rate.toFixed(2)} ج.م = ${totalDue.toFixed(2)} ج.م`,
          sessions: sessions.map((s) => ({
            sessionId: s.sessionId,
            sessionDate: s.sessionDate,
            startTime: s.startTime,
            endTime: s.endTime,
            classroomName: s.classroomName,
            status: 'completed',
            attendanceCount: s.attendanceCount,
            dueAmount: s.teacherDue,
            detail:
              s.model === 'fixed_session'
                ? `أجر ثابت للحصة المنفذة = ${s.teacherDue.toFixed(2)} ج.م`
                : `${s.attendanceCount} طالب حاضر × ${s.rate.toFixed(2)} ج.م = ${s.teacherDue.toFixed(2)} ج.م`,
          })),
        });
      }
    }

    return rows;
  }, [statement, groups]);

  // Export to Excel CSV with UTF-8 BOM
  const handleExportCSV = () => {
    if (!statement) return;

    const teacher = allTeachers.find((t) => t.id === selectedTeacherId);
    const teacherName = statement.teacherName || teacher?.fullName || 'المعلم';
    const lines: string[] = [];

    // Header
    lines.push('كشف حساب ومستحقات المعلم - منصة يلا سنتر');
    lines.push(`المعلم,${teacherName}`);
    lines.push(`الشهر والسنة,${ARABIC_MONTHS[month - 1]} ${year}`);
    lines.push(`المواد,${statement.subjectNames.join(' - ')}`);
    lines.push(`تاريخ الاستخراج,${new Date().toLocaleDateString('ar-EG')}`);
    lines.push('');

    // Summary
    lines.push('--- ملخص المستحقات والتسويات ---');
    lines.push(`إجمالي مستحقات السنتر (المتوسط),${statement.centerSubscription.totalCompensation.toFixed(2)} ج.م`);
    lines.push(`إجمالي مستحقات البرايفت (النسبة),${statement.privateLessons.totalInvoicedTeacherShare.toFixed(2)} ج.م`);
    if (statement.lessonCompensation) {
      lines.push(`إجمالي مستحقات الدفع بالحصة,${statement.lessonCompensation.totalCompensation.toFixed(2)} ج.م`);
    }
    lines.push(`إجمالي المستحقات الإجمالية,${statement.summary.grossCompensation.toFixed(2)} ج.م`);
    lines.push(`السلف والاستقطاعات,${statement.summary.totalAdvances.toFixed(2)} ج.م`);
    lines.push(`المكافآت التشجيعية,${statement.summary.totalBonuses.toFixed(2)} ج.م`);
    lines.push(`صافي المبلغ المستحق للصرف,${statement.summary.netPayrollInvoiced.toFixed(2)} ج.م`);
    lines.push('');

    // Center Groups
    if (statement.centerSubscription.groups.length > 0) {
      lines.push('--- مجموعات نظام السنتر (نظام المتوسط) ---');
      lines.push('المجموعة,الفئة المتفق عليها للرأس,عدد الحصص المنعقدة,إجمالي الحضور,متوسط الحضور,المستحق المحسوب (ج.م)');
      statement.centerSubscription.groups.forEach((g) => {
        lines.push(
          `"${g.groupName}",${g.ratePerStudent.toFixed(2)},${g.conductedSessionsCount},${g.totalValidAttendance},${g.averageAttendance.toFixed(2)},${g.compensationAmount.toFixed(2)}`
        );
      });
      lines.push('');
    }

    // Private Groups
    if (statement.privateLessons.groups.length > 0) {
      lines.push('--- مجموعات نظام البرايفت (نسبة مئوية) ---');
      lines.push('المجموعة,عدد الطلاب,إجمالي المصروفات,الخصومات,صافي الإيراد,نسبة المعلم (%),حصة المعلم (ج.م),حصة السنتر (ج.م),المحصل فعلياً');
      statement.privateLessons.groups.forEach((g) => {
        lines.push(
          `"${g.groupName}",${g.enrolledCount},${g.totalGrossInvoiced.toFixed(2)},${g.totalDiscountAmount.toFixed(2)},${g.totalNetRevenue.toFixed(2)},${g.teacherPercentage}%,${g.totalTeacherShare.toFixed(2)},${g.totalCenterShare.toFixed(2)},${g.totalCollected.toFixed(2)}`
        );
      });
      lines.push('');
    }

    // Lesson Compensation (Per-Session)
    if (statement.lessonCompensation && statement.lessonCompensation.sessions.length > 0) {
      lines.push('--- حصص نظام الدفع بالحصة ---');
      lines.push('المجموعة,تاريخ الحصة,الحضور,إجمالي الرسوم,مستحق المعلم (ج.م),صافي السنتر (ج.م)');
      statement.lessonCompensation.sessions.forEach((ls) => {
        lines.push(
          `"${ls.groupName}",${ls.sessionDate},${ls.attendanceCount},${ls.revenue.toFixed(2)},${ls.teacherDue.toFixed(2)},${ls.centerNet.toFixed(2)}`
        );
      });
      lines.push('');
    }

    // Advances
    if (statement.adjustments.advances.length > 0) {
      lines.push('--- السلف النقدية المصروفة ---');
      lines.push('التاريخ,المبلغ (ج.م),البيان');
      statement.adjustments.advances.forEach((adv) => {
        lines.push(`${adv.createdAt?.slice(0, 10) || ''},${adv.amount.toFixed(2)},"${adv.reason || 'سلفة نقدية'}"`);
      });
      lines.push('');
    }

    const bom = '\uFEFF';
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `كشف_حساب_${teacherName.replace(/\s+/g, '_')}_${year}_${month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const currentTeacher = allTeachers.find((t) => t.id === selectedTeacherId);
  const teacherAssignedGroups = groups.filter((g) => g.teacherId === selectedTeacherId && g.isActive);

  return (
    <div
      className="space-y-6 p-2 text-foreground sm:p-4"
      dir="rtl"
    >
      {/* Print-Only Header */}
      <div className="hidden print:block border-b-2 border-border pb-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-brand-navy-900">يلا سنتر — كشف الحساب والمستحقات المالي</h1>
            <p className="text-sm text-muted-foreground mt-1">
              الفترة: {ARABIC_MONTHS[month - 1]} {year} · تم الاستخراج في: {new Date().toLocaleDateString('ar-EG')}
            </p>
          </div>
          <div className="text-left font-mono text-sm">
            <span className="font-bold text-foreground">{currentTeacher?.fullName}</span>
            <span className="block text-xs text-muted-foreground">{currentTeacher?.phone}</span>
          </div>
        </div>
      </div>

      {/* Top Filter and Controls Bar (Hidden during print) */}
      <div className="print:hidden bg-card border border-border rounded-2xl p-4 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Teacher Selector */}
          <div className="flex items-center gap-2 flex-1 min-w-[240px]">
            <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
              المعلم:
            </label>
            <select
              value={selectedTeacherId}
              onChange={(e) => onLoad(e.target.value, month, year)}
              disabled={isLoading}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 font-bold"
              aria-label="اختيار المعلم"
            >
              {allTeachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} {t.phone ? `(${t.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Month / Year Navigator */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1 rounded-xl border border-border">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveMonth(-1)}
              disabled={isLoading}
              title="الشهر السابق"
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <div className="flex items-center gap-1 px-2">
              <Calendar className="w-4 h-4 text-brand-cyan-600 ms-1" />
              <select
                value={month}
                onChange={(e) => onLoad(selectedTeacherId, Number(e.target.value), year)}
                disabled={isLoading}
                className="bg-transparent font-bold text-sm text-foreground focus-visible:outline-none border-none cursor-pointer"
                aria-label="الشهر"
              >
                {ARABIC_MONTHS.map((name, index) => (
                  <option key={index + 1} value={index + 1} className="bg-card text-foreground">
                    {name}
                  </option>
                ))}
              </select>

              <select
                value={year}
                onChange={(e) => onLoad(selectedTeacherId, month, Number(e.target.value))}
                disabled={isLoading}
                className="bg-transparent font-bold text-sm text-foreground focus-visible:outline-none border-none cursor-pointer"
                aria-label="السنة"
              >
                {[year - 2, year - 1, year, year + 1, year + 2].map((y) => (
                  <option key={y} value={y} className="bg-card text-foreground">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => moveMonth(1)}
              disabled={isLoading}
              title="الشهر التالي"
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
          </div>

          {/* Action Buttons: Refresh, CSV, Print, Disburse */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              onClick={() => {
                setDisburseAmount(String(statement?.summary.netPayrollInvoiced || 0));
                setDisburseError('');
                setDisburseSuccess('');
                setShowDisburseModal(true);
              }}
              disabled={!statement || isLoading}
              className="gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-sm"
              title="صرف مستحقات المعلم وتسجيل عملية الدفع"
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>صرف مستحقات</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onLoad(selectedTeacherId, month, year)}
              disabled={isLoading}
              title="إعادة الحساب والتحديث"
              className="gap-1 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">تحديث</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              disabled={!statement || isLoading}
              className="gap-1 text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">تصدير إكسيل</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              disabled={!statement || isLoading}
              className="gap-1 text-xs text-brand-navy-700 dark:text-brand-cyan-400"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </Button>

            <Button aria-label="إغلاق كشف الحساب"
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-muted-foreground space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-cyan-600" />
          <p className="text-sm font-bold">جاري تجميع بيانات الحضور والحصص وحساب النسب الرياضية...</p>
          <p className="text-xs text-muted-foreground">يتم استخدام نفس المحرك المالي الموحد للحصص والمجموعات والمالية</p>
        </div>
      ) : statement ? (
        <div className="space-y-6">
          {/* Teacher Summary Banner */}
          <div className="bg-gradient-to-l from-brand-navy-900/10 via-brand-cyan-500/5 to-transparent border border-border rounded-2xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <img
                src={teachers.find(teacher => teacher.id === selectedTeacherId)?.avatarUrl || '/brand/yalla-center-icon.png'}
                alt=""
                className="w-14 h-14 rounded-2xl border-2 border-brand-cyan-500/30 object-cover shadow-sm"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-black text-foreground">{statement.teacherName}</h2>
                  <Badge variant="cyan" className="text-[10px]">
                    معلم معتمد
                  </Badge>
                </div>
                {statement.teacherPhone && (
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 font-mono" dir="ltr">
                    <Phone className="w-3 h-3" />
                    <span>{statement.teacherPhone}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-muted-foreground">المواد المسندة:</span>
                  {statement.subjectNames.length > 0 ? (
                    statement.subjectNames.map((subj) => (
                      <Badge key={subj} variant="outline" className="text-[11px]">
                        {subj}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">غير مسجل</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 print:hidden">
              <Link
                href={`/center/${tenantSlug}/sessions`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-cyan-500/40 bg-brand-cyan-500/10 px-3 py-2 text-xs font-bold text-brand-cyan-600 hover:bg-brand-cyan-500/20 transition-colors shadow-sm"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>إدارة الحصص والمجموعات ({teacherAssignedGroups.length})</span>
              </Link>
            </div>
          </div>

          {/* 5 Financial KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
            {/* Card 1: Gross Earnings */}
            <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold">إجمالي المستحق من المجموعات</span>
                <Receipt className="w-4 h-4 text-brand-cyan-600" />
              </div>
              <div className="text-lg font-black text-foreground font-mono">
                {statement.summary.grossCompensation.toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">ج.م</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                إجمالي الدخل المحسوب من كافة المجموعات
              </p>
            </div>

            {/* Card 2: Advances */}
            <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold">إجمالي السلفيات</span>
                <MinusCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-lg font-black text-rose-600 dark:text-rose-400 font-mono">
                -{statement.summary.totalAdvances.toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">ج.م</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {statement.adjustments.advances.length} عمليات سلف مسجلة
              </p>
            </div>

            {/* Card 3: Deductions */}
            <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold">إجمالي الخصومات</span>
                <MinusCircle className="w-4 h-4 text-amber-600" />
              </div>
              <div className="text-lg font-black text-amber-600 dark:text-amber-400 font-mono">
                -{statement.summary.totalDeductions.toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">ج.م</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {statement.adjustments.deductions.length} خصومات إدارية
              </p>
            </div>

            {/* Card 4: Bonuses */}
            <div className="bg-card border border-border rounded-xl p-3.5 space-y-1 shadow-sm">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold">إجمالي المكافآت</span>
                <Sparkles className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-mono">
                +{statement.summary.totalBonuses.toFixed(2)}{' '}
                <span className="text-xs font-normal text-muted-foreground">ج.م</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                {statement.adjustments.bonuses.length} مكافآت تشجيعية
              </p>
            </div>

            {/* Card 5: Net Due Remaining */}
            <div className="bg-gradient-to-br from-brand-cyan-500/10 to-emerald-500/10 border-2 border-brand-cyan-500/40 rounded-xl p-3.5 space-y-1 shadow-sm sm:col-span-2 lg:col-span-1 xl:col-span-1">
              <div className="flex items-center justify-between text-brand-cyan-700 dark:text-brand-cyan-300">
                <span className="text-xs font-black">صافي المستحق للصرف</span>
                <Wallet className="w-4 h-4 text-brand-cyan-600" />
              </div>
              <div className="text-xl font-black text-brand-cyan-600 dark:text-brand-cyan-400 font-mono">
                {statement.summary.netPayrollInvoiced.toFixed(2)}{' '}
                <span className="text-xs font-normal text-foreground">ج.م</span>
              </div>
              <p className="text-[11px] text-muted-foreground">المبلغ النهائي المتاح للصرف</p>
            </div>
          </div>

          {/* SECTION: Comprehensive Multi-Group Table */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-brand-cyan-600" />
                <div>
                  <h3 className="font-black text-base text-foreground">
                    جدول مجموعات المعلم والاتفاقات المالية
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    كل مجموعة لها نظام محاسبة مالي مستقل ومستحقات محسوبة بدقة من سجلات الحضور
                  </p>
                </div>
              </div>
              <div className="text-left font-mono font-bold text-brand-cyan-600 text-sm">
                إجمالي مجموعات المعلم: {unifiedGroups.length}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-right text-xs">
                <thead className="bg-muted/70 text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3">المجموعة</th>
                    <th className="p-3">المرحلة</th>
                    <th className="p-3">نظام المحاسبة</th>
                    <th className="p-3 text-center">عدد الحصص المنفذة</th>
                    <th className="p-3 text-center">إجمالي الحضور</th>
                    <th className="p-3 text-left">المستحق المالي</th>
                    <th className="p-3 text-center print:hidden">تفاصيل الحصص</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {unifiedGroups.length > 0 ? (
                    unifiedGroups.map((group) => {
                      const isExpanded = expandedGroups[group.groupId] !== false;
                      return (
                        <React.Fragment key={group.groupId}>
                          <tr className="hover:bg-muted/20 transition-colors">
                            <td className="p-3 font-bold text-foreground">
                              <div className="flex items-center gap-2">
                                <span>{group.groupName}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground block font-normal">
                                {group.rateDescription}
                              </span>
                            </td>
                            <td className="p-3 text-muted-foreground font-medium">
                              {group.stageName}
                            </td>
                            <td className="p-3">
                              <Badge
                                variant={
                                  group.pricingModel === 'center'
                                    ? 'cyan'
                                    : group.pricingModel === 'private'
                                    ? 'outline'
                                    : 'default'
                                }
                                className="text-[11px] font-bold"
                              >
                                {group.pricingModelLabel}
                              </Badge>
                            </td>
                            <td className="p-3 text-center font-mono font-bold">
                              {group.conductedSessionsCount} حصص
                            </td>
                            <td className="p-3 text-center font-mono font-bold text-brand-cyan-600">
                              {group.totalAttendance} طالب
                            </td>
                            <td className="p-3 text-left font-mono font-black text-emerald-600 text-sm">
                              {group.compensationAmount.toFixed(2)} ج.م
                            </td>
                            <td className="p-3 text-center print:hidden">
                              <button
                                type="button"
                                onClick={() => toggleGroupExpand(group.groupId)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-border bg-muted/40 hover:bg-muted text-xs font-bold text-foreground transition-colors"
                              >
                                <span>{isExpanded ? 'إخفاء الحصص' : 'عرض الحصص'}</span>
                                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              </button>
                            </td>
                          </tr>

                          {/* Expanded Sessions Drill-Down */}
                          {isExpanded && group.sessions && (
                            <tr className="bg-muted/15">
                              <td colSpan={7} className="p-3.5 space-y-2">
                                <div className="rounded-xl border border-border/80 bg-background overflow-hidden p-3 space-y-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground border-b border-border/60 pb-2">
                                    <span className="font-bold text-foreground">
                                      تفاصيل حصص المجموعة ({group.sessions.length} حصص مسجلة):
                                    </span>
                                    <span className="text-[11px] font-mono text-brand-cyan-600">
                                      {group.calculationText}
                                    </span>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="w-full text-right text-xs">
                                      <thead className="bg-muted/40 text-muted-foreground font-bold">
                                        <tr>
                                          <th className="p-2">تاريخ الحصة</th>
                                          <th className="p-2">الميعاد والقاعة</th>
                                          <th className="p-2 text-center">عدد الحضور الفعلي</th>
                                          <th className="p-2">الحسبة المالية الخاصة بالحصة</th>
                                          <th className="p-2 text-left">المستحق المحسوب</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-border/60">
                                        {group.sessions.map((sess) => (
                                          <tr key={sess.sessionId} className="hover:bg-muted/10">
                                            <td className="p-2 font-mono font-bold">
                                              {sess.sessionDate}
                                            </td>
                                            <td className="p-2 text-muted-foreground">
                                              {sess.startTime && sess.endTime
                                                ? `${sess.startTime} - ${sess.endTime} · `
                                                : ''}
                                              {sess.classroomName || 'القاعة الرئيسية'}
                                            </td>
                                            <td className="p-2 text-center font-mono font-bold">
                                              {sess.attendanceCount} طالب
                                            </td>
                                            <td className="p-2 text-muted-foreground font-mono text-[11px]">
                                              {sess.detail}
                                            </td>
                                            <td className="p-2 text-left font-mono font-bold text-emerald-600">
                                              {sess.dueAmount.toFixed(2)} ج.م
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        لا توجد مجموعات مسندة لهذا المعلم بحصص خلال هذه الفترة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Section: Center Subscription Groups (نظام السنتر / المتوسط) */}
          {statement.centerSubscription.groups.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-brand-cyan-600" />
                  <div>
                    <h3 className="font-black text-base text-foreground">
                      مجموعات نظام السنتر (نظام المتوسط)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      المعادلة: إجمالي الحضور ÷ عدد الحصص المنعقدة = متوسط الحضور × الفئة المتفق عليها
                    </p>
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-brand-cyan-600 text-sm">
                  المجموع: {statement.centerSubscription.totalCompensation.toFixed(2)} ج.م
                </div>
              </div>

              {/* Group Cards List */}
              <div className="space-y-4">
                {statement.centerSubscription.groups.map((group) => {
                  const isExpanded = expandedGroups[group.groupId] !== false;
                  return (
                    <div
                      key={group.groupId}
                      className="border border-border/80 rounded-xl overflow-hidden bg-background"
                    >
                      {/* Group Header Row */}
                      <div className="p-3.5 bg-muted/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.groupId)}
                            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="توسيع الحصص"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{group.groupName}</span>
                              <Badge variant="cyan" className="text-[10px]">
                                نظام السنتر
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                              فئة الطالب المتفق عليها: {group.ratePerStudent.toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs">
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">الحصص المنعقدة</span>
                            <span className="font-mono font-bold text-foreground">
                              {group.conductedSessionsCount} حصص
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">إجمالي الحضور</span>
                            <span className="font-mono font-bold text-foreground">
                              {group.totalValidAttendance} طالب
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">متوسط الحضور</span>
                            <span className="font-mono font-bold text-brand-cyan-600">
                              {group.averageAttendance.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-center border-s border-border ps-3 sm:ps-6">
                            <span className="block text-[10px] text-muted-foreground">المستحق المحسوب</span>
                            <span className="font-mono font-black text-emerald-600 text-sm">
                              {group.compensationAmount.toFixed(2)} ج.م
                            </span>
                          </div>
                          <Link
                            href={`/center/${tenantSlug}/sessions`}
                            className="print:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-brand-cyan-600 hover:border-brand-cyan-500/40 transition-colors"
                            title="فتح المجموعة في الحصص والمجموعات"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Expandable Sessions Table */}
                      {isExpanded && group.sessions && (
                        <div className="p-3 sm:p-4 border-t border-border space-y-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">سجل حصص المجموعة خلال الشهر:</span>
                            <span className="text-[11px]">
                              الحصص الملغاة تُستبعد تلقائياً من بسط ومقام حساب المتوسط
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-muted/60 text-muted-foreground font-bold">
                                <tr>
                                  <th className="p-2.5">الحصة / التاريخ</th>
                                  <th className="p-2.5">الميعاد</th>
                                  <th className="p-2.5">القاعة</th>
                                  <th className="p-2.5">حالة الحصة</th>
                                  <th className="p-2.5">حضور الطلاب الفعلي</th>
                                  <th className="p-2.5">ملاحظات</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {group.sessions.length > 0 ? (
                                  group.sessions.map((sess) => {
                                    const isCanceled = sess.status === 'canceled';
                                    return (
                                      <tr
                                        key={sess.sessionId}
                                        className={isCanceled ? 'bg-red-500/5 text-muted-foreground' : 'hover:bg-muted/20'}
                                      >
                                        <td className="p-2.5 font-bold">
                                          {sess.sessionDate}
                                        </td>
                                        <td className="p-2.5 font-mono" dir="ltr">
                                          {sess.startTime && sess.endTime
                                            ? `${sess.startTime} - ${sess.endTime}`
                                            : '—'}
                                        </td>
                                        <td className="p-2.5">{sess.classroomName || 'القاعة الرئيسية'}</td>
                                        <td className="p-2.5">
                                          {sess.status === 'completed' && (
                                            <Badge variant="cyan" className="text-[10px]">
                                              مكتملة
                                            </Badge>
                                          )}
                                          {sess.status === 'canceled' && (
                                            <Badge variant="destructive" className="text-[10px]">
                                              ملغاة (مستبعدة)
                                            </Badge>
                                          )}
                                          {sess.status === 'in_progress' && (
                                            <Badge variant="outline" className="text-[10px] text-amber-600">
                                              جارية
                                            </Badge>
                                          )}
                                          {sess.status === 'scheduled' && (
                                            <Badge variant="outline" className="text-[10px]">
                                              مجدولة
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="p-2.5 font-mono font-bold">
                                          {isCanceled ? (
                                            <span className="line-through text-muted-foreground">0</span>
                                          ) : (
                                            <span>{sess.validAttendanceCount} طالب</span>
                                          )}
                                        </td>
                                        <td className="p-2.5 text-muted-foreground">
                                          {sess.notes || (isCanceled ? 'حصة ملغاة لا تدخل في المتوسط' : 'حصة منتظمة')}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={6} className="p-4 text-center text-muted-foreground">
                                      لا توجد حصص مسجلة في هذه الفترة
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* Center Calculation Box */}
                          <div className="bg-muted/30 p-2.5 rounded-lg border border-border text-[11px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
                            <span>
                              <b>معادلة الاحتساب:</b> {group.totalValidAttendance} طالب ÷ {group.conductedSessionsCount} حصص = {group.averageAttendance.toFixed(2)} متوسط × {group.ratePerStudent.toFixed(2)} ج.م
                            </span>
                            <span className="font-mono font-bold text-foreground">
                              المستحق: {group.compensationAmount.toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Private Lessons Groups (نظام البرايفت / النسبة) */}
          {statement.privateLessons.groups.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-600" />
                  <div>
                    <h3 className="font-black text-base text-foreground">
                      مجموعات نظام البرايفت (النسبة المئوية)
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      المعادلة: توزيع صافي الرسوم بعد الخصومات بنسبة المعلم والسنتر (المنحة 100% = 0 ج.م)
                    </p>
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-emerald-600 text-sm">
                  المجموع: {statement.privateLessons.totalInvoicedTeacherShare.toFixed(2)} ج.م
                </div>
              </div>

              {/* Private Group Cards */}
              <div className="space-y-4">
                {statement.privateLessons.groups.map((group) => {
                  const isExpanded = expandedGroups[group.groupId] !== false;
                  return (
                    <div
                      key={group.groupId}
                      className="border border-border/80 rounded-xl overflow-hidden bg-background"
                    >
                      {/* Group Header Row */}
                      <div className="p-3.5 bg-muted/30 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleGroupExpand(group.groupId)}
                            className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            aria-label="توسيع الطلاب"
                          >
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-foreground text-sm">{group.groupName}</span>
                              <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600">
                                نظام البرايفت
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-mono">
                              نسبة المعلم: {group.teacherPercentage}% · نسبة السنتر: {group.centerPercentage}%
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs">
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">الطلاب المسجلين</span>
                            <span className="font-mono font-bold text-foreground">
                              {group.enrolledCount} طالب
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">إجمالي الرسوم</span>
                            <span className="font-mono font-bold text-foreground">
                              {group.totalGrossInvoiced.toFixed(2)} ج.م
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">الخصومات الممنوحة</span>
                            <span className="font-mono font-bold text-rose-600">
                              -{group.totalDiscountAmount.toFixed(2)} ج.م
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="block text-[10px] text-muted-foreground">صافي الإيراد</span>
                            <span className="font-mono font-bold text-foreground">
                              {group.totalNetRevenue.toFixed(2)} ج.م
                            </span>
                          </div>
                          <div className="text-center border-s border-border ps-3 sm:ps-6">
                            <span className="block text-[10px] text-muted-foreground">حصة المعلم ({group.teacherPercentage}%)</span>
                            <span className="font-mono font-black text-emerald-600 text-sm">
                              {group.totalTeacherShare.toFixed(2)} ج.م
                            </span>
                          </div>
                          <Link
                            href={`/center/${tenantSlug}/sessions`}
                            className="print:hidden p-1.5 rounded-lg border border-border text-muted-foreground hover:text-brand-cyan-600 hover:border-brand-cyan-500/40 transition-colors"
                            title="فتح المجموعة في الحصص والمجموعات"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </div>
                      </div>

                      {/* Expandable Students Table */}
                      {isExpanded && group.items && (
                        <div className="p-3 sm:p-4 border-t border-border space-y-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span className="font-bold text-foreground">قائمة الطلاب المسجلين واحتساب حصص البرايفت:</span>
                            <span className="text-[11px]">
                              يتم تطبيق الخصومات أولاً ثم تقسيم صافي المبلغ بنسبة {group.teacherPercentage}% / {group.centerPercentage}%
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-right text-xs">
                              <thead className="bg-muted/60 text-muted-foreground font-bold">
                                <tr>
                                  <th className="p-2.5">الطالب</th>
                                  <th className="p-2.5">الهاتف</th>
                                  <th className="p-2.5">المصروفات الأساسية</th>
                                  <th className="p-2.5">الخصم المعتمد</th>
                                  <th className="p-2.5">الصافي بعد الخصم</th>
                                  <th className="p-2.5">حصة المعلم ({group.teacherPercentage}%)</th>
                                  <th className="p-2.5">حصة السنتر ({group.centerPercentage}%)</th>
                                  <th className="p-2.5">المحصل فعلياً</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {group.items.length > 0 ? (
                                  group.items.map((it) => {
                                    const isFree = it.discountType === 'free_100' || it.netRevenue === 0;
                                    return (
                                      <tr
                                        key={it.enrollmentId}
                                        className={isFree ? 'bg-muted/15' : 'hover:bg-muted/20'}
                                      >
                                        <td className="p-2.5 font-bold">
                                          {it.studentName}
                                          {isFree && (
                                            <Badge variant="outline" className="ms-1.5 text-[9px] text-brand-cyan-600">
                                              منحة 100%
                                            </Badge>
                                          )}
                                        </td>
                                        <td className="p-2.5 font-mono text-muted-foreground" dir="ltr">
                                          {it.studentPhone || '—'}
                                        </td>
                                        <td className="p-2.5 font-mono">{it.basePrice.toFixed(2)} ج.م</td>
                                        <td className="p-2.5 font-mono text-rose-600">
                                          {it.discountType === 'free_100' ? (
                                            'منحة كاملة (100%)'
                                          ) : it.discountType === 'percentage' ? (
                                            `خصم ${it.discountValue}%`
                                          ) : it.discountType === 'fixed' ? (
                                            `خصم ${it.discountValue} ج.م`
                                          ) : (
                                            'بدون خصم'
                                          )}
                                        </td>
                                        <td className="p-2.5 font-mono font-bold">
                                          {it.netRevenue.toFixed(2)} ج.م
                                        </td>
                                        <td className="p-2.5 font-mono font-bold text-emerald-600">
                                          {it.teacherShare.toFixed(2)} ج.م
                                        </td>
                                        <td className="p-2.5 font-mono text-muted-foreground">
                                          {it.centerShare.toFixed(2)} ج.م
                                        </td>
                                        <td className="p-2.5 font-mono">
                                          {it.collectedAmount > 0 ? (
                                            <span className="text-emerald-600 font-bold">
                                              {it.collectedAmount.toFixed(2)} ج.م
                                            </span>
                                          ) : (
                                            <span className="text-muted-foreground">غير مسدد</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })
                                ) : (
                                  <tr>
                                    <td colSpan={8} className="p-4 text-center text-muted-foreground">
                                      لا يوجد طلاب مسجلون حالياً
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Section: Per-Session Lesson Compensation (نظام الدفع بالحصة) */}
          {statement.lessonCompensation && statement.lessonCompensation.sessions.length > 0 && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm space-y-3 p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-600" />
                  <div>
                    <h3 className="font-black text-base text-foreground">
                      مستحقات نظام الدفع بالحصة
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      مبلغ محدد وثابت لكل حصة أو طالب بالاتفاق مع إدارة السنتر
                    </p>
                  </div>
                </div>
                <div className="text-left font-mono font-bold text-amber-600 text-sm">
                  المجموع: {statement.lessonCompensation.totalCompensation.toFixed(2)} ج.م
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-right text-xs">
                  <thead className="bg-muted/60 text-muted-foreground font-bold">
                    <tr>
                      <th className="p-2.5">المجموعة</th>
                      <th className="p-2.5">تاريخ الحصة</th>
                      <th className="p-2.5">الميعاد</th>
                      <th className="p-2.5">القاعة</th>
                      <th className="p-2.5">الحضور الفعلي</th>
                      <th className="p-2.5">إجمالي الرسوم</th>
                      <th className="p-2.5">الفئة المتفق عليها</th>
                      <th className="p-2.5">مستحق المعلم</th>
                      <th className="p-2.5">صافي السنتر</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {statement.lessonCompensation.sessions.map((ls) => (
                      <tr key={ls.sessionId} className="hover:bg-muted/20">
                        <td className="p-2.5 font-bold">{ls.groupName}</td>
                        <td className="p-2.5 font-mono">{ls.sessionDate}</td>
                        <td className="p-2.5 font-mono" dir="ltr">
                          {ls.startTime && ls.endTime ? `${ls.startTime} - ${ls.endTime}` : '—'}
                        </td>
                        <td className="p-2.5">{ls.classroomName || 'القاعة الرئيسية'}</td>
                        <td className="p-2.5 font-mono font-bold">{ls.attendanceCount} طالب</td>
                        <td className="p-2.5 font-mono">{ls.revenue.toFixed(2)} ج.م</td>
                        <td className="p-2.5 font-mono">{ls.rate.toFixed(2)} ج.م</td>
                        <td className="p-2.5 font-mono font-black text-emerald-600">
                          {ls.teacherDue.toFixed(2)} ج.م
                        </td>
                        <td className="p-2.5 font-mono text-muted-foreground">
                          {ls.centerNet.toFixed(2)} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section: Advances and Adjustments */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
            <h3 className="font-black text-base text-foreground flex items-center gap-2">
              <Wallet className="w-5 h-5 text-brand-cyan-600" />
              التسويات والسلف النقدية
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Advances List */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-muted-foreground block">
                  السلف النقدية المصروفة خلال الفترة:
                </span>
                {statement.adjustments.advances.length > 0 ? (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-2">التاريخ</th>
                          <th className="p-2">المبلغ</th>
                          <th className="p-2">البيان</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {statement.adjustments.advances.map((adv) => (
                          <tr key={adv.id}>
                            <td className="p-2 font-mono">{adv.createdAt?.slice(0, 10) || '—'}</td>
                            <td className="p-2 font-mono font-bold text-rose-600">
                              -{adv.amount.toFixed(2)} ج.م
                            </td>
                            <td className="p-2 text-muted-foreground">{adv.reason || 'سلفة نقدية معتمدة'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                    لا توجد سلف نقدية مسجلة لهذا المعلم
                  </div>
                )}
              </div>

              {/* Financial Calculation Summary Breakdown */}
              <div className="bg-muted/25 rounded-xl p-4 border border-border space-y-2.5 text-xs">
                <span className="font-bold text-foreground block text-sm border-b border-border pb-2">
                  ملخص كشف الحساب النهائي:
                </span>
                <div className="flex justify-between text-muted-foreground">
                  <span>إجمالي مستحقات الحصص والمجموعات:</span>
                  <span className="font-mono font-bold text-foreground">
                    {statement.summary.grossCompensation.toFixed(2)} ج.م
                  </span>
                </div>
                <div className="flex justify-between text-rose-600">
                  <span>- إجمالي السلف النقدية المخصومة:</span>
                  <span className="font-mono">-{statement.summary.totalAdvances.toFixed(2)} ج.م</span>
                </div>
                {statement.summary.totalBonuses > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>+ المكافآت التشجيعية المعتمدة:</span>
                    <span className="font-mono">+{statement.summary.totalBonuses.toFixed(2)} ج.م</span>
                  </div>
                )}
                <div className="flex justify-between items-center text-brand-cyan-600 font-black text-sm pt-2 border-t border-border">
                  <span>= صافي الراتب النهائي المستحق للصرف:</span>
                  <span className="font-mono text-base">{statement.summary.netPayrollInvoiced.toFixed(2)} ج.م</span>
                </div>
              </div>
            </div>
          </div>

          {/* Printable Signatures Area (Visible only when printed) */}
          <div className="hidden print:grid grid-cols-3 gap-6 pt-12 text-center text-xs text-foreground">
            <div className="border-t border-foreground/40 pt-2">
              <span className="block font-bold">توقيع المعلم</span>
              <span className="block text-[10px] text-muted-foreground mt-6">................................</span>
            </div>
            <div className="border-t border-foreground/40 pt-2">
              <span className="block font-bold">توقيع المحاسب المالي</span>
              <span className="block text-[10px] text-muted-foreground mt-6">................................</span>
            </div>
            <div className="border-t border-foreground/40 pt-2">
              <span className="block font-bold">اعتماد مدير السنتر</span>
              <span className="block text-[10px] text-muted-foreground mt-6">................................</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* Disbursement Modal Dialog */}
      {showDisburseModal && (
        <dialog
          open
          dir="rtl"
          onCancel={() => setShowDisburseModal(false)}
          className="fixed inset-0 z-50 m-auto max-h-[90dvh] w-[min(92vw,480px)] overflow-hidden rounded-3xl border border-border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/60 transition-all"
        >
          <div className="p-5 border-b border-border bg-gradient-to-l from-emerald-500/10 via-muted/20 to-background flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-sm text-foreground">صرف مستحقات المعلم</h3>
                <p className="text-[11px] text-muted-foreground">
                  {statement.teacherName} · {ARABIC_MONTHS[month - 1]} {year}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowDisburseModal(false)}
              className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </Button>
          </div>

          <form onSubmit={handleDisburseSubmit} className="p-5 space-y-4">
            {disburseError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-600 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{disburseError}</span>
              </div>
            )}
            {disburseSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{disburseSuccess}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                مبلغ الصرف (ج.م):
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  value={disburseAmount}
                  onChange={(e) => setDisburseAmount(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-black font-mono text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                />
                <span className="absolute left-3 top-2.5 text-xs text-muted-foreground">ج.م</span>
              </div>
              <span className="text-[10px] text-muted-foreground mt-1 block">
                الصافي المستحق حالياً: {statement.summary.netPayrollInvoiced.toFixed(2)} ج.م
              </span>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                تاريخ الصرف:
              </label>
              <input
                type="date"
                required
                value={disburseDate}
                onChange={(e) => setDisburseDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                طريقة الدفع:
              </label>
              <select
                value={disburseMethod}
                onChange={(e) => setDisburseMethod(e.target.value as any)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <option value="cash">نقدًا من الخزينة</option>
                <option value="vodafone_cash">فودافون كاش</option>
                <option value="instapay">إنستاباي / تحويل بنكي</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-foreground block mb-1">
                البيان / ملاحظات الصرف:
              </label>
              <input
                type="text"
                value={disburseReason}
                onChange={(e) => setDisburseReason(e.target.value)}
                placeholder="أدخل بيان الصرف"
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-bold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowDisburseModal(false)}
                disabled={disbursing}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={disbursing}
                className="rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 shadow-sm"
              >
                {disbursing ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>جارٍ الحفظ…</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>تأكيد صرف المستحقات</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </dialog>
      )}
    </div>
  );
}
