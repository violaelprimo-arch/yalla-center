'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, CalendarDays, Edit3, Plus, Search, Trash2 } from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { GroupEditor, type ScheduleTeacher } from '@/components/timetable/group-editor';
import { WeeklyTimetable } from '@/components/timetable/weekly-timetable';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import type { Group } from '@/lib/dal/types';
import { useTeacherContracts } from '@/lib/teachers/client';
import { GROUP_PRICING_LABELS, slotSummary, studentGroupFee, WEEKDAYS, weeklySlots } from '@/lib/timetable/group-schedule';
import { weeklyScheduleRows } from '@/lib/timetable/schedule-view';

const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
const pageSize = 10;
const filterControl = 'rounded-lg border border-border bg-background px-2 py-1.5 text-sm';

export default function SessionsGroupsPage() {
  const { tenant, branches, masterData, groupData } = useTenant();
  const { auth, data: { stages, subjects } } = masterData;
  const { groups, classrooms } = groupData;
  const path = usePathname();
  const [showTable, setShowTable] = useState(false);
  const [editor, setEditor] = useState<{ group?: Group }>();
  const [baseTeachers, setBaseTeachers] = useState<ScheduleTeacher[]>([]);
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState('');
  const [teacher, setTeacher] = useState('');
  const [pricing, setPricing] = useState('');
  const [day, setDay] = useState('');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
  const [deleteSelection, setDeleteSelection] = useState<Group[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const teacherDirectory = useTeacherContracts(tenant.id, tenant.slug, groupData.canEdit, auth.idToken);
  const teachers = useMemo(() => {
    const entries = new Map(baseTeachers.map(user => [user.id, user]));
    for (const profile of teacherDirectory.profiles) entries.set(profile.id, {
      id: profile.id, fullName: profile.fullName, isActive: profile.active,
    });
    return [...entries.values()];
  }, [baseTeachers, teacherDirectory.profiles]);

  useEffect(() => {
    const openRequestedSchedule = () => setShowTable(window.location.hash === '#weekly');
    openRequestedSchedule();
    window.addEventListener('hashchange', openRequestedSchedule);
    return () => window.removeEventListener('hashchange', openRequestedSchedule);
  }, [path]);

  useEffect(() => {
    let active = true;
    const dal = getDataProvider();
    dal.getUsers(tenant.id, { role: 'TEACHER' }).then(users => { if (active) setBaseTeachers(users); });
    return () => { active = false; };
  }, [tenant.id]);

  const teacherNames = new Map(teachers.map(teacher => [teacher.id, teacher.fullName]));
  const subjectsById = new Map(subjects.map(subject => [subject.id, subject]));
  const subjectNames = new Map(subjects.map(subject => [subject.id, subject.nameAr]));
  const gradeNames = new Map(stages.flatMap(stage => stage.grades.map(grade => [grade.id, grade.nameAr])));
  const search = query.trim().toLocaleLowerCase('ar');
  const activeGroups = groups.filter(group => group.isActive);
  const filteredGroups = activeGroups.filter(group => (!teacher || group.teacherId === teacher) &&
    (!stage || (group.stageId ?? subjectsById.get(group.subjectId)?.stage) === stage) &&
    (!pricing || group.pricingModel === pricing) &&
    [group.nameAr, teacherNames.get(group.teacherId) ?? group.teacherName, subjectNames.get(group.subjectId)]
      .some(value => value?.toLocaleLowerCase('ar').includes(search)));
  const matches = day ? filteredGroups.filter(group => weeklySlots(group).some(slot => slot.scheduleDay === Number(day))) : filteredGroups;
  const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = weeklyScheduleRows(filteredGroups, classrooms, branches, subjects, teachers);

  function toggleSchedule() {
    const open = !showTable;
    setShowTable(open);
    window.history.replaceState(null, '', open ? '#weekly' : path);
  }

  function confirmDeletion(selection: Group[]) {
    setDeleteError('');
    setDeleteSelection(selection);
  }

  async function deleteSelectedGroups() {
    if (deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await groupData.deleteGroups(deleteSelection);
      setNotice(deleteSelection.length === 1 ? `تم حذف ${deleteSelection[0].nameAr}` : 'تم حذف المجموعات المحددة');
      setDeleteSelection([]);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'تعذّر حذف المجموعات');
    } finally {
      setDeleting(false);
    }
  }

  return <div className="space-y-5" dir="rtl">
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
        <CalendarClock className="text-brand-cyan-600" size={27} /> الحصص والمجموعات
      </h1>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" aria-pressed={showTable} onClick={toggleSchedule}>
          <CalendarDays size={16} /> {showTable ? `قائمة المجموعات (${activeGroups.length})` : 'عرض الجدول'}
        </Button>
        {groupData.canEdit && <Button size="sm" disabled={!masterData.ready} onClick={() => setEditor({})}>
          <Plus size={17} /> إضافة مجموعة
        </Button>}
      </div>
    </div>
    <div className="no-print space-y-2 empty:hidden">
      <MasterDataStatus />
      {groupData.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{groupData.error}
        <button className="ms-2 underline" type="button" onClick={groupData.refresh}>إعادة التحميل</button>
      </p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    </div>
    {!showTable && groupData.canEdit && classrooms.length === 0 && <p className="text-sm text-muted-foreground">
      أضف قاعة من <Link href={`/center/${tenant.slug}/branches-list`} className="underline">قائمة الفروع</Link> لاستخدامها في المواعيد.
    </p>}
    {groupData.loading && <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المجموعات…</p>}
    {groupData.ready && <div className="no-print flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
      <label className="relative w-full max-w-sm">
        <Search size={16} className="absolute end-3 top-2.5 text-muted-foreground" />
        <input className="w-full rounded-lg border border-border bg-background py-2 ps-3 pe-10 text-sm"
          aria-label="بحث المجموعات" placeholder="ابحث باسم المجموعة أو المعلم أو المادة" value={query}
          onChange={event => { setQuery(event.target.value); setPage(0); }} />
      </label>
      <select className={filterControl} aria-label="المرحلة" value={stage} onChange={event => { setStage(event.target.value); setPage(0); }}>
        <option value="">كل المراحل</option>
        {stages.map(item => <option key={item.id} value={item.id}>{item.nameAr}</option>)}
      </select>
      <select className={filterControl} aria-label="المعلم" value={teacher} onChange={event => { setTeacher(event.target.value); setPage(0); }}>
        <option value="">كل المعلمين</option>
        {teachers.map(item => <option key={item.id} value={item.id}>{item.fullName}</option>)}
      </select>
      {groupData.canEdit && <select className={filterControl} aria-label="طريقة الحساب" value={pricing}
        onChange={event => { setPricing(event.target.value); setPage(0); }}>
        <option value="">كل طرق الحساب</option>
        {Object.entries(GROUP_PRICING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>}
      {!showTable && <select className={filterControl} aria-label="اليوم" value={day} onChange={event => { setDay(event.target.value); setPage(0); }}>
        <option value="">كل الأيام</option>
        {WEEKDAYS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select>}
    </div>}
    {groupData.ready && (showTable
      ? <WeeklyTimetable rows={rows} center={tenant.nameAr} />
      : <section className="rounded-2xl border border-border bg-card" aria-label="قائمة المجموعات">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <span className="text-xs text-muted-foreground">{matches.length} مجموعة</span>
            {groupData.canEdit && activeGroups.length > 1 && <Button variant="outline" size="sm" className="text-rose-600"
              onClick={() => confirmDeletion(activeGroups)}><Trash2 size={15} /> حذف كل المجموعات</Button>}
        </div>
        {matches.length ? <ul className="divide-y divide-border">
          {matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(group => {
            const subject = subjectsById.get(group.subjectId);
            const grade = gradeNames.get(group.gradeId ?? subject?.grade ?? '');
            return <li key={group.id} className="grid gap-2 px-3 py-3 text-sm md:grid-cols-[1.35fr_1.2fr_1fr_auto] md:items-center">
              <div className="min-w-0">
                <p className="break-words font-bold">{group.nameAr}</p>
                <p className="text-xs text-muted-foreground">{[grade, subject?.nameAr].filter(Boolean).join(' · ')}</p>
              </div>
              <div className="min-w-0">
                <p className="break-words">{teacherNames.get(group.teacherId) ?? group.teacherName ?? 'معلم'}</p>
                <p className="break-words text-xs text-muted-foreground">{slotSummary(group)}</p>
              </div>
              {groupData.canEdit && <div className="min-w-0">
                <p>{GROUP_PRICING_LABELS[group.pricingModel]}</p>
                <p className="text-xs text-muted-foreground">{currency.format(studentGroupFee(group))}
                  {group.pricingModel === 'per_session' ? ' / حصة' : ' / شهر'}
                </p>
              </div>}
              {groupData.canEdit && <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setEditor({ group })}
                  aria-label={`تعديل ${group.nameAr}`}><Edit3 size={15} /> تعديل</Button>
                <Button variant="ghost" size="sm" className="text-rose-600" onClick={() => confirmDeletion([group])}
                  aria-label={`حذف ${group.nameAr}`}><Trash2 size={15} /> حذف</Button>
              </div>}
            </li>;
          })}
        </ul> : <p className="p-5 text-sm text-muted-foreground">{activeGroups.length ? 'مفيش مجموعات مطابقة.' : 'مفيش مجموعات مسجلة.'}</p>}
        {lastPage > 0 && <div className="flex items-center justify-end gap-2 border-t border-border p-2 text-xs">
          <Button variant="outline" size="sm" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>السابق</Button>
          <span>{currentPage + 1} / {lastPage + 1}</span>
          <Button variant="outline" size="sm" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)}>التالي</Button>
        </div>}
      </section>)}
    {editor && <GroupEditor group={editor.group} classrooms={classrooms} teachers={teachers}
      onClose={() => setEditor(undefined)} onSaved={group => {
        setEditor(undefined);
        setQuery('');
        setStage('');
        setTeacher('');
        setPricing('');
        setDay('');
        if (!editor.group) setPage(Math.floor(activeGroups.length / pageSize));
        setNotice(`تم حفظ ${group.nameAr}`);
      }} />}
    {deleteSelection.length > 0 && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-group-heading"
        className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xl">
        <h2 id="delete-group-heading" className="font-bold">
          {deleteSelection.length === 1 ? `حذف ${deleteSelection[0].nameAr}` : `حذف ${deleteSelection.length} مجموعات`}
        </h2>
        <p className="text-sm text-muted-foreground">تُحذف المجموعات المحددة من الجدول والتسجيل، وتبقى سجلات الحضور والحسابات السابقة محفوظة.</p>
        {deleteError && <p role="alert" className="text-sm text-rose-600">{deleteError}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="outline" disabled={deleting} onClick={() => setDeleteSelection([])}>إلغاء</Button>
          <Button variant="destructive" disabled={deleting} onClick={deleteSelectedGroups}>{deleting ? 'جارٍ الحذف…' : 'تأكيد الحذف'}</Button>
        </div>
      </section>
    </div>}
  </div>;
}
