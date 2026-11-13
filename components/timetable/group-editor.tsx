'use client';

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/components/layout/tenant-provider';
import type { Classroom, Group, PricingModel } from '@/lib/dal/types';
import { splitPrivateFee } from '@/lib/finance/group-pricing';
import {
  GROUP_PRICING_LABELS, groupInputSchema, moneyAmount, WEEKDAYS, weeklySlots, type GroupPricing, type WeeklySlot,
} from '@/lib/timetable/group-schedule';

export interface ScheduleTeacher {
  id: string;
  fullName: string;
  isActive: boolean;
}

const control = 'w-full min-w-0 rounded-lg border border-border bg-background px-2.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';
const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });

function Field({ title, children }: { title: string; children: ReactNode }) {
  return <label className="min-w-0 space-y-1 text-sm font-semibold"><span>{title}</span>{children}</label>;
}

function Amount({ title, value, onChange, max }: {
  title: string; value: string; onChange: (value: string) => void; max?: number;
}) {
  return <Field title={title}><input className={control} type="number" min="0" step="0.01"
    max={max ?? 1000000} value={value} onChange={event => onChange(event.target.value)} required /></Field>;
}

export function GroupEditor({ group, classrooms, teachers, onClose, onSaved }: {
  group?: Group;
  classrooms: Classroom[];
  teachers: ScheduleTeacher[];
  onClose: () => void;
  onSaved: (group: Group) => void;
}) {
  const { branches, activeBranchId, masterData, groupData } = useTenant();
  const { stages, subjects } = masterData.data;
  const dialog = useRef<HTMLDialogElement>(null);
  const [id] = useState(() => group?.id ?? `group-${crypto.randomUUID()}`);
  const originalSubject = subjects.find(subject => subject.id === group?.subjectId);
  const originalPricing = group?.pricing;
  const [nameAr, setName] = useState(group?.nameAr ?? '');
  const [stageId, setStage] = useState(group?.stageId ?? originalSubject?.stage ?? '');
  const [gradeId, setGrade] = useState(group?.gradeId ?? originalSubject?.grade ?? '');
  const [subjectId, setSubject] = useState(group?.subjectId ?? '');
  const [teacherId, setTeacher] = useState(group?.teacherId ?? '');
  const [branchId, setBranch] = useState(group?.branchId ?? activeBranchId ?? '');
  const [maxStudents, setMaxStudents] = useState(group ? String(group.maxStudents) : '');
  const [slots, setSlots] = useState<WeeklySlot[]>(() => group
    ? weeklySlots(group).map(slot => ({ ...slot, classroomId: slot.classroomId || group.classroomId }))
    : [{ id: crypto.randomUUID(), scheduleDay: 6, startTime: '14:00', endTime: '15:00', classroomId: '' }]);
  const [model, setModel] = useState<PricingModel>(group?.pricingModel ?? 'center');
  const [monthlyFee, setMonthlyFee] = useState(group ? String(group.monthlyFee) : '');
  const [teacherRate, setTeacherRate] = useState(originalPricing?.model === 'center' ? String(originalPricing.teacherRate) : '');
  const [teacherPercentage, setTeacherPercentage] = useState(originalPricing?.model === 'private'
    ? String(originalPricing.teacherPercentage) : '');
  const [teacherFee, setTeacherFee] = useState(originalPricing?.model === 'per_session' ? String(originalPricing.teacherFee) : '');
  const [centerFee, setCenterFee] = useState(originalPricing?.model === 'per_session' ? String(originalPricing.centerFee) : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const grades = stages.find(stage => stage.id === stageId)?.grades ?? [];
  const matchingSubjects = subjects.filter(subject => subject.stage === stageId && subject.grade === gradeId);
  const rooms = classrooms.filter(room => room.branchId === branchId);
  const activeTeachers = teachers.filter(teacher => teacher.isActive);
  const activeBranches = branches.filter(branch => branch.isActive);
  const privateShares = splitPrivateFee(Number(monthlyFee), Number(teacherPercentage));

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  function updateSlot(slotId: string, changes: Partial<WeeklySlot>) {
    setSlots(previous => previous.map(slot => slot.id === slotId ? { ...slot, ...changes } : slot));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (saving) return;
    let pricing: GroupPricing;
    switch (model) {
      case 'center':
        pricing = { model, monthlyFee: Number(monthlyFee), teacherRate: Number(teacherRate) };
        break;
      case 'private':
        pricing = { model, monthlyFee: Number(monthlyFee), teacherPercentage: Number(teacherPercentage) };
        break;
      case 'per_session':
        pricing = { model, teacherFee: Number(teacherFee), centerFee: Number(centerFee) };
        break;
    }
    const result = groupInputSchema.safeParse({
      id, version: group?.version ?? 0, nameAr, branchId, stageId, gradeId, subjectId, teacherId,
      weeklySlots: slots, pricing, maxStudents: maxStudents === '' ? undefined : Number(maxStudents),
    });
    if (!result.success) {
      setError(result.error.issues[0].message);
      return;
    }
    setSaving(true);
    try {
      onSaved(await groupData.save(result.data));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حفظ المجموعة');
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} aria-labelledby="group-editor-title"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    className="m-auto w-[calc(100%-1rem)] max-w-3xl max-h-[92dvh] overflow-y-auto rounded-2xl border border-border bg-card text-foreground shadow-2xl backdrop:bg-black/55"
    dir="rtl">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3 sm:px-6">
      <h2 id="group-editor-title" className="text-lg font-black">{group ? 'تعديل المجموعة' : 'إضافة مجموعة'}</h2>
      <Button variant="ghost" size="icon" aria-label="إغلاق" disabled={saving} onClick={onClose}><X size={18} /></Button>
    </div>
    <form onSubmit={submit} className="space-y-5 p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <Field title="اسم المجموعة"><input className={control} autoFocus required maxLength={120}
          value={nameAr} onChange={event => setName(event.target.value)} /></Field>
        <Field title="المرحلة"><select className={control} value={stageId} required
          onChange={event => { setStage(event.target.value); setGrade(''); setSubject(''); }}>
          <option value="">اختر المرحلة</option>
          {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.nameAr}</option>)}
        </select></Field>
        <Field title="الصف الدراسي"><select className={control} value={gradeId} required disabled={!stageId}
          onChange={event => { setGrade(event.target.value); setSubject(''); }}>
          <option value="">اختر الصف</option>
          {grades.map(grade => <option key={grade.id} value={grade.id}>{grade.nameAr}</option>)}
        </select></Field>
        <Field title="المادة"><select className={control} value={subjectId} required disabled={!gradeId}
          onChange={event => setSubject(event.target.value)}>
          <option value="">{gradeId && !matchingSubjects.length ? 'مفيش مواد مضافة للصف ده' : 'اختر المادة'}</option>
          {matchingSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.nameAr}</option>)}
        </select></Field>
        <Field title="المعلم"><select className={control} value={teacherId} required onChange={event => setTeacher(event.target.value)}>
          <option value="">اختر المعلم</option>
          {activeTeachers.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.fullName}</option>)}
        </select></Field>
        <Field title="الفرع"><select className={control} value={branchId} required onChange={event => {
          setBranch(event.target.value);
          setSlots(previous => previous.map(slot => ({ ...slot, classroomId: '' })));
        }}>
          <option value="">اختر الفرع</option>
          {activeBranches.map(branch => <option key={branch.id} value={branch.id}>{branch.nameAr}</option>)}
        </select></Field>
        <Field title="سعة المجموعة (اختياري)"><input type="number" className={control} min={1} max={1000}
          placeholder="حسب سعة القاعات" value={maxStudents} onChange={event => setMaxStudents(event.target.value)} /></Field>
      </div>

      <section className="space-y-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold">المواعيد الأسبوعية</h3>
          <Button type="button" variant="outline" size="sm" disabled={slots.length >= 28} onClick={() => {
            setSlots(previous => [...previous, {
              ...previous[previous.length - 1], id: crypto.randomUUID(),
              scheduleDay: (previous[previous.length - 1].scheduleDay + 1) % 7,
            }]);
          }}><Plus size={16} /> إضافة موعد</Button>
        </div>
        {branchId && !rooms.length && <p className="text-sm text-amber-700 dark:text-amber-300">أضف قاعة للفرع من «البيانات الأساسية ← قائمة الفروع».</p>}
        {slots.map(slot => <div key={slot.id} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-[1fr_1fr_1fr_1.45fr_auto] sm:items-end">
          <Field title="اليوم"><select className={control} value={slot.scheduleDay}
            onChange={event => updateSlot(slot.id, { scheduleDay: Number(event.target.value) })}>
            {WEEKDAYS.map(([day, label]) => <option key={day} value={day}>{label}</option>)}
          </select></Field>
          <Field title="وقت البداية"><input className={control} type="time" required dir="ltr" value={slot.startTime}
            onChange={event => updateSlot(slot.id, { startTime: event.target.value })} /></Field>
          <Field title="وقت النهاية"><input className={control} type="time" required dir="ltr" value={slot.endTime}
            onChange={event => updateSlot(slot.id, { endTime: event.target.value })} /></Field>
          <Field title="القاعة"><select className={control} value={slot.classroomId} required
            onChange={event => updateSlot(slot.id, { classroomId: event.target.value })}>
            <option value="">اختر القاعة</option>
            {rooms.map(room => <option key={room.id} value={room.id}>{room.nameAr}</option>)}
          </select></Field>
          {slots.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label="حذف الموعد"
            onClick={() => setSlots(previous => previous.filter(item => item.id !== slot.id))}><Trash2 size={16} /></Button>}
        </div>)}
      </section>

      <section className="space-y-3 border-t border-border pt-4">
        <h3 className="font-bold">طريقة الحساب</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field title="نظام المجموعة"><select className={control} value={model} onChange={event => setModel(event.target.value as PricingModel)}>
            {Object.entries(GROUP_PRICING_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></Field>
          {model !== 'per_session' && <Amount title="مصروفات الطالب الشهرية (ج.م)" value={monthlyFee} onChange={setMonthlyFee} />}
          {model === 'center' && <Amount title="سعر الطالب للمعلم في الشهر (ج.م)" value={teacherRate} onChange={setTeacherRate} />}
          {model === 'private' && <Amount title="نسبة المعلم (%)" max={100} value={teacherPercentage} onChange={setTeacherPercentage} />}
          {model === 'per_session' && <>
            <Amount title="نصيب المعلم لكل طالب في الحصة (ج.م)" value={teacherFee} onChange={setTeacherFee} />
            <Amount title="نصيب السنتر لكل طالب في الحصة (ج.م)" value={centerFee} onChange={setCenterFee} />
          </>}
        </div>
        <p className="rounded-lg bg-muted/55 px-3 py-2 text-sm" aria-live="polite">
          {model === 'center' && 'مستحق المعلم الشهري = متوسط حضور الحصص المنعقدة × سعر الطالب للمعلم.'}
          {model === 'private' && `المعلم ${currency.format(privateShares.teacher)} · السنتر ${moneyAmount(100 - Number(teacherPercentage))}% (${currency.format(privateShares.center)}) لكل طالب شهريًا`}
          {model === 'per_session' && `سعر الحصة للطالب ${currency.format(moneyAmount(Number(teacherFee) + Number(centerFee)))}`}
        </p>
        {group?.pricing && <p className="text-xs text-muted-foreground">تطبق تغييرات المواعيد والأسعار على الحصص والفواتير الجديدة.</p>}
      </section>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ المجموعة'}</Button>
      </div>
    </form>
  </dialog>;
}
