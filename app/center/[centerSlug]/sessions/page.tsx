'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, CalendarDays, Edit3, Plus, Search } from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { GroupEditor, type ScheduleTeacher } from '@/components/timetable/group-editor';
import { WeeklyTimetable } from '@/components/timetable/weekly-timetable';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import type { Group } from '@/lib/dal/types';
import { useTeacherContracts } from '@/lib/teachers/client';
import { GROUP_PRICING_LABELS, slotSummary, studentGroupFee } from '@/lib/timetable/group-schedule';
import { weeklyScheduleRows } from '@/lib/timetable/schedule-view';

const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });
const pageSize = 10;

export default function SessionsGroupsPage() {
  const { tenant, branches, masterData, groupData } = useTenant();
  const { auth, data: { stages, subjects } } = masterData;
  const { groups, classrooms } = groupData;
  const path = usePathname();
  const [showTable, setShowTable] = useState(false);
  const [editor, setEditor] = useState<{ group?: Group }>();
  const [baseTeachers, setBaseTeachers] = useState<ScheduleTeacher[]>([]);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState('');
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
  const subjectNames = new Map(subjects.map(subject => [subject.id, subject.nameAr]));
  const gradeNames = new Map(stages.flatMap(stage => stage.grades.map(grade => [grade.id, grade.nameAr])));
  const search = query.trim().toLocaleLowerCase('ar');
  const matches = groups.filter(group => group.isActive &&
    [group.nameAr, teacherNames.get(group.teacherId) ?? group.teacherName, subjectNames.get(group.subjectId)]
      .some(value => value?.toLocaleLowerCase('ar').includes(search)));
  const lastPage = Math.max(0, Math.ceil(matches.length / pageSize) - 1);
  const currentPage = Math.min(page, lastPage);
  const rows = weeklyScheduleRows(groups, classrooms, branches, subjects, teachers);

  function toggleSchedule() {
    const open = !showTable;
    setShowTable(open);
    window.history.replaceState(null, '', open ? '#weekly' : path);
  }

  return <div className="space-y-5" dir="rtl">
    <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
        <CalendarClock className="text-brand-cyan-600" size={27} /> الحصص والمجموعات
      </h1>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" aria-pressed={showTable} onClick={toggleSchedule}>
          <CalendarDays size={16} /> {showTable ? 'عرض المجموعات' : 'عرض الجدول'}
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
      أضف قاعة من <Link href={`/center/${tenant.slug}/branches`} className="underline">الفروع والقاعات</Link> لاستخدامها في المواعيد.
    </p>}
    {groupData.loading && <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المجموعات…</p>}
    {groupData.ready && (showTable
      ? <WeeklyTimetable rows={rows} center={tenant.nameAr} />
      : <section className="rounded-2xl border border-border bg-card" aria-label="قائمة المجموعات">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
          <label className="relative w-full max-w-sm">
            <Search size={16} className="absolute end-3 top-2.5 text-muted-foreground" />
            <input className="w-full rounded-lg border border-border bg-background py-2 ps-3 pe-10 text-sm"
              aria-label="بحث المجموعات" placeholder="ابحث باسم المجموعة أو المعلم" value={query}
              onChange={event => { setQuery(event.target.value); setPage(0); }} />
          </label>
          <span className="text-xs text-muted-foreground">{matches.length} مجموعة</span>
        </div>
        {matches.length ? <ul className="divide-y divide-border">
          {matches.slice(currentPage * pageSize, (currentPage + 1) * pageSize).map(group => {
            const subject = subjects.find(item => item.id === group.subjectId);
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
              {groupData.canEdit && <Button variant="ghost" size="sm" className="justify-self-start"
                onClick={() => setEditor({ group })} aria-label={`تعديل ${group.nameAr}`}><Edit3 size={15} /> تعديل</Button>}
            </li>;
          })}
        </ul> : <p className="p-5 text-sm text-muted-foreground">مفيش مجموعات مطابقة.</p>}
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
        setPage(Math.ceil((groups.length + (editor.group ? 0 : 1)) / pageSize) - 1);
        setNotice(`تم حفظ ${group.nameAr}`);
      }} />}
  </div>;
}
