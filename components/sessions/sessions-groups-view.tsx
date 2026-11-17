'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarClock, Plus, Trash2, Edit2, Calendar, Clock, Printer, FileSpreadsheet,
  Users, Search, CheckCircle2, AlertTriangle, Building, ExternalLink, Calculator, Percent, DollarSign, Lock,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { GroupEditor, type ScheduleTeacher } from '@/components/timetable/group-editor';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDataProvider } from '@/lib/dal/factory';
import type { Group } from '@/lib/dal/types';
import { useTeacherContracts } from '@/lib/teachers/client';
import { splitPrivateFee } from '@/lib/finance/group-pricing';
import { GROUP_PRICING_LABELS, WEEKDAYS, isRegisteredGroup, weeklySlots } from '@/lib/timetable/group-schedule';
import { weeklyScheduleRows } from '@/lib/timetable/schedule-view';
import { downloadScheduleExcel, downloadSchedulePdf, scheduleExportRows } from '@/lib/timetable/export';

const DAYS_OF_WEEK = WEEKDAYS.map(([day, nameAr]) => ({ day, nameAr }));

export interface SessionsGroupsViewProps {
  initialTeacherId?: string;
  lockTeacherFilter?: boolean;
  allowGroupManagement?: boolean;
  isEmbedded?: boolean;
  title?: string;
  subtitle?: string;
}

export function SessionsGroupsView({
  initialTeacherId,
  lockTeacherFilter = false,
  allowGroupManagement: managementEnabled = true,
  isEmbedded = false,
  title,
  subtitle,
}: SessionsGroupsViewProps) {
  const { tenant, branches, masterData, groupData } = useTenant();
  const { stages, subjects } = masterData.data;
  const { groups, classrooms } = groupData;
  const loading = groupData.loading || masterData.loading;
  const allowGroupManagement = managementEnabled && groupData.canEdit && masterData.ready;
  const [baseTeachers, setBaseTeachers] = useState<ScheduleTeacher[]>([]);
  const directory = useTeacherContracts(tenant.id, tenant.slug, groupData.ready, masterData.auth.idToken);
  const teachers = useMemo(() => {
    const records = new Map(baseTeachers.map(teacher => [teacher.id, teacher]));
    for (const profile of directory.profiles) {
      records.set(profile.id, {
        id: profile.id,
        fullName: profile.fullName,
        isActive: profile.active,
        stageIds: profile.contracts?.map(c => c.level) || [],
        subjectIds: profile.subjectIds || [],
      });
    }
    return [...records.values()].filter(teacher => teacher.isActive);
  }, [baseTeachers, directory.profiles]);

  useEffect(() => {
    let active = true;
    getDataProvider().getUsers(tenant.id, { role: 'TEACHER' })
      .then(records => { if (active) setBaseTeachers(records); });
    return () => { active = false; };
  }, [tenant.id]);

  const [viewMode, setViewMode] = useState<'groups' | 'timetable'>('groups');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState(initialTeacherId || '');
  const [selectedModelFilter, setSelectedModelFilter] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');

  // Sync initialTeacherId if changed
  useEffect(() => {
    if (initialTeacherId) {
      setSelectedTeacherFilter(initialTeacherId);
    }
  }, [initialTeacherId]);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [editor, setEditor] = useState<{ group?: Group }>();
  const [deleteTargets, setDeleteTargets] = useState<Group[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  function handleOpenAddModal() {
    setEditor({});
  }

  async function handleDeleteGroup() {
    if (isDeleting || !deleteTargets.length) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await groupData.deleteGroups(deleteTargets);
      showToast('success', deleteTargets.length === 1 ? 'تم حذف المجموعة' : 'تم حذف المجموعات المحددة');
      setDeleteTargets([]);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'تعذّر حذف المجموعات');
    } finally {
      setIsDeleting(false);
    }
  }

  const registeredGroups = useMemo(() => groups.filter(isRegisteredGroup), [groups]);

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase('ar');
    return registeredGroups.filter(group => {
      const subject = subjects.find(item => item.id === group.subjectId);
      const teacher = teachers.find(item => item.id === group.teacherId);
      return (!query || [group.nameAr, subject?.nameAr, teacher?.fullName, group.teacherName]
        .some(name => name?.toLocaleLowerCase('ar').includes(query))) &&
        (!selectedStageFilter || (group.stageId ?? subject?.stage) === selectedStageFilter) &&
        (!selectedTeacherFilter || group.teacherId === selectedTeacherFilter) &&
        (!selectedModelFilter || group.pricingModel === selectedModelFilter) &&
        (selectedDayFilter === 'all' || weeklySlots(group).some(slot => slot.scheduleDay === selectedDayFilter));
    });
  }, [registeredGroups, subjects, teachers, searchQuery, selectedStageFilter, selectedTeacherFilter,
    selectedModelFilter, selectedDayFilter]);

  const timetableSessions = useMemo(
    () => weeklyScheduleRows(filteredGroups, classrooms, branches, subjects, teachers)
      .filter(row => selectedDayFilter === 'all' || row.day === selectedDayFilter),
    [filteredGroups, classrooms, branches, subjects, teachers, selectedDayFilter],
  );
  const groupsById = new Map(filteredGroups.map(group => [group.id, group]));
  const printRows = scheduleExportRows(timetableSessions);

  async function handleExportExcel() {
    try {
      await downloadScheduleExcel(timetableSessions);
      showToast('success', 'تم تصدير الجدول إلى إكسيل');
    } catch {
      showToast('error', 'تعذّر تصدير الجدول');
    }
  }

  async function handleExportPdf() {
    try {
      await downloadSchedulePdf(timetableSessions, tenant.nameAr,
        teachers.find(teacher => teacher.id === selectedTeacherFilter)?.fullName ?? '');
    } catch {
      showToast('error', 'تعذّر تصدير الجدول');
    }
  }

  const handlePrint = () => window.print();

  const selectedTeacherObj = teachers.find((t) => t.id === selectedTeacherFilter);

  return (
    <div className={`space-y-6 ${isEmbedded ? 'text-xs' : ''}`} dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div
          role={toast.type === 'success' ? 'status' : 'alert'}
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-red-600 text-white shadow-red-600/20'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Printable Sheet Header (Visible Only on Print) */}
      <div aria-hidden="true" className="hidden print:block mb-6 border-b-2 border-neutral-800 pb-4 text-center">
        <h1 className="text-2xl font-black text-neutral-900">{tenant.nameAr || 'سنتر يلا التعليمي'}</h1>
        <h2 className="text-lg font-bold text-neutral-700 mt-1">جدول الحصص والمجموعات الأسبوعي المعتمد</h2>
        {selectedTeacherObj && (
          <p className="text-sm font-bold text-neutral-800 mt-1">المعلم: {selectedTeacherObj.fullName}</p>
        )}
        <div className="flex justify-between text-xs text-neutral-600 mt-2 px-4">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</span>
          <span>إجمالي الحصص المجدولة: {timetableSessions.length} حصة</span>
        </div>
      </div>

      {!isEmbedded && <div className="no-print">
        <MasterDataStatus />
      </div>}
      <div aria-hidden="true" className="hidden print:block">
        <table className="w-full border-collapse text-sm">
          <thead><tr>{printRows[0].map(heading => <th key={heading} className="border p-2 text-start">{heading}</th>)}</tr></thead>
          <tbody>{printRows.slice(1).map((row, index) => <tr key={timetableSessions[index].id}>
            {row.map((value, column) => <td key={column} className="border p-2">{value}</td>)}
          </tr>)}</tbody>
        </table>
      </div>
      {/* Screen Header */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border no-print">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
              <CalendarClock className="w-7 h-7 text-brand-cyan-600" />
              <span>{title || 'الحصص والمجموعات الميدانية'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {subtitle || 'إدارة المجموعات، الجداول الدراسية الأسبوعية متعددة الحصص، وأنظمة الحسابات الثلاثة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Views */}
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
              <button
                type="button"
                onClick={() => setViewMode('timetable')}
                aria-pressed={viewMode === 'timetable'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'timetable'
                    ? 'bg-brand-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>عرض الجدول</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('groups')}
                aria-pressed={viewMode === 'groups'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'groups'
                    ? 'bg-brand-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>قائمة المجموعات ({filteredGroups.length})</span>
              </button>
            </div>

            {/* Export to Excel */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 text-xs font-bold border-border hover:bg-muted/50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">تصدير إكسيل</span>
            </Button>

            {/* Print / PDF */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-bold border-border hover:bg-muted/50"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </Button>

            <Button type="button" variant="outline" size="sm" onClick={handleExportPdf}>
              <FileSpreadsheet className="w-4 h-4 text-blue-600" /> تنزيل PDF
            </Button>
            {allowGroupManagement && registeredGroups.length > 1 && <Button type="button" variant="outline" size="sm"
              onClick={() => { setDeleteError(''); setDeleteTargets(registeredGroups); }}>
              <Trash2 className="w-4 h-4" /> حذف كل المجموعات
            </Button>}
            {/* Add Group Button (Only if allowed) */}
            {allowGroupManagement ? (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenAddModal}
                className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-brand-cyan-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مجموعة</span>
              </Button>
            ) : !managementEnabled ? (
              <Link
                href={`/center/${tenant.slug}/sessions`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cyan-600/10 text-brand-cyan-700 dark:text-brand-cyan-400 hover:bg-brand-cyan-600/20 text-xs font-bold transition-all border border-brand-cyan-500/30"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>إدارة المجموعات في تبويب الحصص</span>
              </Link>
            ) : null}
          </div>
        </div>
      )}

      {/* Embedded Controls Header if Embedded */}
      {isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border no-print">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
            <button
              type="button"
              onClick={() => setViewMode('groups')}
              aria-pressed={viewMode === 'groups'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'groups'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>المجموعات ({filteredGroups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timetable')}
              aria-pressed={viewMode === 'timetable'}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'timetable'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>الجدول</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="text-xs font-bold border-border"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 ml-1" />
              <span>إكسيل</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-bold border-border"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600 ml-1" />
              <span>طباعة</span>
            </Button>
          </div>
        </div>
      )}

      {/* Filters Bar (Screen Only) */}
      <div className="card-elevated p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between no-print">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="البحث باسم المجموعة، المادة الدراسية، أو اسم المعلم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20 focus:border-brand-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter */}
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
          >
            <option value="">جميع المراحل</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.nameAr}
              </option>
            ))}
          </select>

          {/* Teacher Filter */}
          {!lockTeacherFilter && (
            <select
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
            >
              <option value="">جميع المعلمين</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          )}

          {/* Pricing Model Filter */}
          <select
            value={selectedModelFilter}
            onChange={(e) => setSelectedModelFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
          >
            <option value="">جميع طرق الحساب</option>
            {Object.entries(GROUP_PRICING_LABELS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>

          {/* Day Filter */}
          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
          >
            <option value="all">كل الأيام</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.day} value={d.day}>
                {d.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {allowGroupManagement && (!classrooms.length || !teachers.length) && <div className="no-print flex flex-wrap gap-3 text-sm text-muted-foreground">
        {!classrooms.length && <Link className="underline" href={`/center/${tenant.slug}/branches-list`}>إضافة فرع وقاعة</Link>}
        {!teachers.length && <Link className="underline" href={`/center/${tenant.slug}/teachers`}>إضافة معلم</Link>}
      </div>}
      {/* Main View Area */}
      {loading ? (
        <div className="card-elevated p-12 text-center text-muted-foreground rounded-2xl border border-border">
          <div className="animate-spin w-8 h-8 border-4 border-brand-cyan-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-semibold">جاري تحميل بيانات المجموعات وجدول الحصص...</p>
        </div>
      ) : groupData.error === 'UNAUTHENTICATED' ? (
        <div className="card-elevated p-12 text-center text-muted-foreground rounded-2xl border border-border space-y-3 no-print">
          <Lock className="w-12 h-12 mx-auto text-amber-500/80 mb-2" />
          <h2 className="text-base font-bold text-foreground">يلزم تسجيل الدخول للوصول إلى الحصص والمجموعات</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            عرض الحصص والمجموعات الميدانية وإدارتها يتطلب تسجيل الدخول بحساب سنتر معتمد.
          </p>
          <div className="pt-2">
            <Link
              href={`/login?redirect=${encodeURIComponent(`/center/${tenant.slug}/sessions`)}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold transition-all shadow-md shadow-brand-cyan-600/20"
            >
              <span>تسجيل الدخول الآن</span>
            </Link>
          </div>
        </div>
      ) : groupData.error ? (
        <div className="card-elevated p-12 text-center text-rose-600 dark:text-rose-400 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-3 no-print">
          <AlertTriangle className="w-12 h-12 mx-auto text-rose-500 mb-2" />
          <h2 className="text-base font-bold text-foreground">تعذّر تحميل بيانات الحصص والمجموعات</h2>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            {groupData.error}
          </p>
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={groupData.refresh}
              className="border-rose-500/40 text-rose-600 hover:bg-rose-500/10 font-bold"
            >
              إعادة المحاولة
            </Button>
          </div>
        </div>
      ) : viewMode === 'timetable' ? (
        /* TIMETABLE VIEW (عرض الجدول) */
        <div className="space-y-4 no-print">
          {/* Quick Day Chips on Screen */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
            <button
              type="button"
              onClick={() => setSelectedDayFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDayFilter === 'all'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              عرض كامل الأسبوع
            </button>
            {DAYS_OF_WEEK.map((d) => {
              const count = timetableSessions.filter((s) => s.day === d.day).length;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDayFilter(d.day)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedDayFilter === d.day
                      ? 'bg-brand-cyan-600 text-white shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span>{d.nameAr}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Timetable Weekly Columns Matrix (Screen & Print Friendly) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {DAYS_OF_WEEK.filter((d) => selectedDayFilter === 'all' || selectedDayFilter === d.day).map((dayObj) => {
              const daySessions = timetableSessions.filter((s) => s.day === dayObj.day);

              return (
                <div
                  key={dayObj.day}
                  className="card-elevated rounded-2xl border border-border overflow-hidden flex flex-col print:border-neutral-300 print:break-inside-avoid"
                >
                  {/* Day Header */}
                  <div className="bg-muted/60 p-3 border-b border-border flex items-center justify-between print:bg-neutral-100">
                    <span className="font-black text-sm text-foreground">{dayObj.nameAr}</span>
                    <Badge variant="outline" className="text-[11px] font-bold">
                      {daySessions.length} حصة
                    </Badge>
                  </div>

                  {/* Day Sessions List */}
                  <div className="p-2 space-y-2 flex-1 min-h-[160px]">
                    {daySessions.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4 text-center">
                        <span className="text-xs text-muted-foreground/60">لا توجد حصص</span>
                      </div>
                    ) : (
                      daySessions.map((session) => (
                        <div
                          key={session.id}
                          className="p-2.5 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-brand-cyan-500/50 transition-all text-xs space-y-1.5 shadow-sm print:border-neutral-400 print:bg-white"
                        >
                          {/* Time & Badge */}
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="font-black text-brand-cyan-700 dark:text-brand-cyan-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {session.start} - {session.end}
                            </span>
                            {groupsById.get(session.groupId)?.pricingModel === 'center' ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold">
                                متوسط
                              </span>
                            ) : groupsById.get(session.groupId)?.pricingModel === 'private' ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 font-bold">
                                برايفت
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold">
                                بالحصة
                              </span>
                            )}
                          </div>

                          {/* Subject & Group */}
                          <div>
                            <div className="font-black text-foreground truncate">{session.subject}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{session.group}</div>
                          </div>

                          {/* Teacher Name */}
                          <div className="flex items-center gap-1 text-[11px] text-foreground font-semibold">
                            <span className="text-muted-foreground">👤</span>
                            <span className="truncate">{session.teacher}</span>
                          </div>

                          {/* Classroom Assigned Badge */}
                          <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[10px]">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 truncate">
                              <Building className="w-3 h-3 shrink-0" />
                              {session.room}
                            </span>
                            {session.branch && (
                              <span className="text-muted-foreground truncate">{session.branch}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* GROUPS LIST VIEW (قائمة المجموعات) */
        <div className="no-print grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="قائمة المجموعات">
          {filteredGroups.length === 0 ? (
            <div className="col-span-full card-elevated p-12 text-center text-muted-foreground rounded-2xl border border-border">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-base font-bold text-foreground">
                {registeredGroups.length ? 'لا توجد مجموعات تطابق البحث' : 'لا توجد مجموعات مسجلة بعد'}
                {!registeredGroups.length && <span className="sr-only">مفيش مجموعات مسجلة.</span>}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {allowGroupManagement
                  ? 'يمكنك إضافة مجموعة جديدة وتحديد مواعيد حصصها وطريقة حسابها.'
                  : 'لا توجد مجموعات مسندة لهذا المعلم تطابق الفلتر الحالي.'}
              </p>
              {allowGroupManagement && (
                <Button onClick={handleOpenAddModal} size="sm" className="mt-4 bg-brand-cyan-600 text-white">
                  <Plus className="w-4 h-4 ml-1" /> إضافة مجموعة جديدة
                </Button>
              )}
            </div>
          ) : (
            filteredGroups.map((group) => {
              const subject = subjects.find((s) => s.id === group.subjectId);
              const teacher = teachers.find((t) => t.id === group.teacherId);
              const branch = branches.find((b) => b.id === group.branchId);

              const schedules = weeklySlots(group);
              const rate = group.pricing?.model === 'center' ? group.pricing.teacherRate : undefined;
              const teacherPercentage = group.pricing?.model === 'private' ? group.pricing.teacherPercentage : undefined;
              const sessionPricing = group.pricing?.model === 'per_session' ? group.pricing : undefined;
              const shares = splitPrivateFee(group.monthlyFee, teacherPercentage ?? 0);

              return (
                <div
                  key={group.id}
                  className="card-elevated rounded-2xl border border-border p-4 flex flex-col justify-between hover:border-brand-cyan-500/40 transition-all space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Subject & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-brand-cyan-700 dark:text-brand-cyan-400 bg-brand-cyan-500/10 px-2 py-0.5 rounded-md">
                          {subject?.nameAr || 'المادة الدراسية'}
                        </span>
                        <h3 className="font-black text-base text-foreground mt-1.5 leading-snug">{group.nameAr}</h3>
                        {!group.isActive && <Badge variant="outline">غير نشطة</Badge>}
                      </div>

                      {allowGroupManagement && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`تعديل ${group.nameAr}`}
                            onClick={() => setEditor({ group })}
                            className="h-8 w-8 text-muted-foreground hover:text-brand-cyan-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`حذف ${group.nameAr}`}
                            onClick={() => { setDeleteError(''); setDeleteTargets([group]); }}
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Teacher & Branch */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <span>👤</span>
                        <span>{teacher?.fullName || group.teacherName || 'المعلم'}</span>
                      </div>
                      {branch && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>🏢</span>
                          <span>{branch.nameAr}</span>
                        </div>
                      )}
                    </div>

                    {/* Multi-Session Weekly Slots */}
                    <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border">
                      <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                        <span>مواعيد الحصص الأسبوعية ({schedules.length})</span>
                      </div>
                      {schedules.map(slot => {
                        const dayName = DAYS_OF_WEEK.find((d) => d.day === slot.scheduleDay)?.nameAr || '';
                        const room = classrooms.find((c) => c.id === (slot.classroomId || group.classroomId));
                        return (
                          <div
                            key={slot.id}
                            className="flex items-center justify-between text-xs bg-card/70 px-2 py-1.5 rounded-lg border border-border/60"
                          >
                            <span className="font-black text-foreground">
                              {dayName} ({slot.startTime} - {slot.endTime})
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold">
                              {room?.nameAr || 'القاعة'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pricing System Details Card */}
                    <div className="rounded-xl border p-2.5 text-xs space-y-1.5 bg-muted/20 border-border">
                      {group.pricingModel === 'center' ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Calculator className="w-3.5 h-3.5" />
                              نظام المتوسط
                            </span>
                            <span className="font-black text-foreground">
                              {rate === undefined ? '—' : `${rate} ج.م / طالب`}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            المرتب = سعر الطالب للمدرس × متوسط عدد الطلاب الحاضرين في كل الحصص بالشهر.
                          </p>
                          <div className="text-[10px] text-muted-foreground font-semibold">
                            مصاريف الطالب: {group.monthlyFee} ج.م شهرياً
                          </div>
                        </div>
                      ) : group.pricingModel === 'private' ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <Percent className="w-3.5 h-3.5" />
                              نظام البرايفت (النسبة)
                            </span>
                            <span className="font-black text-foreground">
                              {teacherPercentage === undefined ? '—' : `${teacherPercentage}% مدرس / ${Math.round((100 - teacherPercentage) * 100) / 100}% سنتر`}
                            </span>
                          </div>
                          {teacherPercentage !== undefined && <p className="text-[10px] text-muted-foreground mt-1">
                            من كل طالب يدفع {group.monthlyFee} ج.م، نصيب المدرس {shares.teacher} ج.م ونصيب السنتر {shares.center} ج.م.
                          </p>}
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              نظام الدفع بالحصة
                            </span>
                            <span className="font-black text-foreground">{group.sessionFee} ج.م / للحصة</span>
                          </div>
                          {sessionPricing && <p className="text-[10px] text-muted-foreground mt-1">
                            لكل طالب في الحصة {sessionPricing.teacherFee} ج.م للمدرس و{sessionPricing.centerFee} ج.م للسنتر.
                          </p>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Capacity */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>السعة القصوى: {group.maxStudents || 35} طالب</span>
                    <Badge variant={group.isActive ? 'default' : 'outline'} className="text-[10px]">
                      {group.isActive ? 'نشطة' : 'معطلة'}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {allowGroupManagement && editor && <GroupEditor group={editor.group} classrooms={classrooms} teachers={teachers}
        onClose={() => setEditor(undefined)} onSaved={group => {
          setEditor(undefined);
          setViewMode('groups');
          setSearchQuery('');
          setSelectedStageFilter('');
          setSelectedTeacherFilter('');
          setSelectedModelFilter('');
          setSelectedDayFilter('all');
          showToast('success', `تم حفظ ${group.nameAr}`);
        }} />}
      {allowGroupManagement && deleteTargets.length > 0 && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 no-print">
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-group-heading"
          className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <h2 id="delete-group-heading" className="font-bold">{deleteTargets.length === 1
            ? `حذف ${deleteTargets[0].nameAr}` : `حذف ${deleteTargets.length} مجموعات`}</h2>
          <p className="text-sm text-muted-foreground">تُحذف المجموعات المحددة من الجدول والتسجيل، وتبقى سجلات الحضور والحسابات السابقة محفوظة.</p>
          {deleteError && <p role="alert" className="text-sm text-rose-600">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={isDeleting} onClick={() => setDeleteTargets([])}>إلغاء</Button>
            <Button variant="destructive" disabled={isDeleting} onClick={handleDeleteGroup}>
              {isDeleting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}
            </Button>
          </div>
        </section>
      </div>}
    </div>
  );
}
