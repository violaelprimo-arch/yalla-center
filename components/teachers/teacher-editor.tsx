'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Camera, Plus, Trash2, UserRound, X, FileSpreadsheet, User, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TeacherAccountingView } from '@/components/teachers/teacher-accounting-view';
import { EGYPTIAN_STAGES, getGradeNameArabic } from '@/lib/materials/taxonomy';
import type { Subject, EducationalStage } from '@/lib/dal/types';
import {
  normalizeDigits, TEACHER_MODELS, TEACHER_PERMISSIONS, TEACHER_TABS, teacherInputSchema,
  teacherModels, teacherPermissions, teacherTabs, type TeacherContract, type TeacherInput,
  type TeacherPermission, type TeacherTab,
} from '@/lib/teachers/profile';

interface Props {
  initial: TeacherInput;
  editing: boolean;
  teacherId?: string;
  tenantId?: string;
  tenantSlug?: string;
  originalAvatar?: string;
  demo: boolean;
  subjects: Subject[];
  stages?: EducationalStage[];
  onSave: (input: TeacherInput, password?: string) => Promise<void>;
  onClose: () => void;
}

const control = 'mt-1 block w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';

async function thumbnail(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error('اختر صورة JPG أو PNG أو WebP بحجم 8 ميجابايت أو أقل');
  }
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 240;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('تعذّر تجهيز الصورة');
    const side = Math.min(image.width, image.height);
    context.fillStyle = '#f5f7fa';
    context.fillRect(0, 0, 240, 240);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 240, 240);
    const data = canvas.toDataURL('image/jpeg', 0.82);
    if (data.length > 90000) throw new Error('حجم الصورة كبير بعد الضغط');
    return data;
  } finally {
    image.close();
  }
}

export function TeacherEditor({ initial, editing, teacherId, tenantId, tenantSlug, originalAvatar, demo, subjects, stages, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState(1);
  const [input, setInput] = useState(initial);
  const [contracts, setContracts] = useState(initial.contracts.map(item => ({ ...item, value: String(item.value) })));
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [showOldPhoto, setShowOldPhoto] = useState(true);

  const stageList = stages && stages.length > 0
    ? stages.map(s => ({
        code: s.id,
        nameAr: s.nameAr,
        grades: (s.grades || []).map(g => ({ code: g.id, nameAr: g.nameAr })),
      }))
    : EGYPTIAN_STAGES;

  useEffect(() => { dialog.current?.showModal(); }, []);

  const avatar = input.avatarData ?? (showOldPhoto ? originalAvatar : undefined);
  const needsPassword = !demo && input.login?.mode === 'username' &&
    (initial.login?.mode !== 'username' || initial.login.username !== input.login.username.trim().toLowerCase());
  const setField = <K extends keyof TeacherInput>(field: K, value: TeacherInput[K]) =>
    setInput(previous => ({ ...previous, [field]: value }));

  function togglePermission(permission: TeacherPermission, checked: boolean) {
    const next = checked ? [...input.permissions, permission] : input.permissions.filter(item => item !== permission);
    setField('permissions', permission === 'viewStudents' && !checked
      ? next.filter(item => item !== 'viewStudentDetails') : next);
  }

  function toggleTab(tab: TeacherTab, checked: boolean) {
    setField('tabs', checked ? [...input.tabs, tab] : input.tabs.filter(item => item !== tab));
  }

  function updateContract(index: number, change: Partial<Omit<TeacherContract, 'value'> & { value: string }>) {
    setContracts(items => items.map((item, at) => at === index ? { ...item, ...change } : item));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || processingPhoto) return;
    setError('');
    const parsed = teacherInputSchema.safeParse({
      ...input,
      contracts: contracts.map(contract => ({
        ...contract,
        value: contract.value.trim() ? Number(normalizeDigits(contract.value).replace('٫', '.')) : NaN,
      })),
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue.path[0] === 'contracts' && issue.code === 'invalid_type' ? 'اكتب قيمة التعاقد لكل صف أو مرحلة' : issue.message);
      return;
    }
    if (!editing && !parsed.data.login) {
      setError('اختر طريقة تسجيل دخول المعلم');
      return;
    }
    if (needsPassword && password.length < 8) {
      setError('كلمة المرور لازم تكون 8 أحرف على الأقل');
      return;
    }
    if (step === 1) {
      setStep(2);
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data, needsPassword ? password : undefined);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حفظ المعلم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog ref={dialog} dir="rtl" aria-labelledby="teacher-editor-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      className={`m-auto max-h-[94dvh] overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl backdrop:bg-black/60 transition-all ${
        step === 3 ? 'w-[min(96vw,1020px)]' : 'w-[min(94vw,760px)]'
      }`}>
      <form onSubmit={submit} noValidate className="flex max-h-[94dvh] flex-col">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 id="teacher-editor-title" className="text-lg font-black">{editing ? 'الملف الشخصي والمالي للمعلم' : 'إضافة معلم جديد'}</h2>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  step === 1 ? 'bg-brand-cyan-500/20 text-brand-cyan-600 border border-brand-cyan-500/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                ١. البيانات والتعاقد
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  step === 2 ? 'bg-brand-cyan-500/20 text-brand-cyan-600 border border-brand-cyan-500/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                ٢. الصلاحيات والدخول
              </button>
              {editing && teacherId && tenantId && tenantSlug && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    step === 3 ? 'bg-brand-cyan-500/20 text-brand-cyan-600 border border-brand-cyan-500/30' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  <FileSpreadsheet size={13} />
                  <span>٣. الحسابات والمستحقات</span>
                </button>
              )}
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" aria-label="إغلاق" onClick={onClose} disabled={saving}><X size={18} /></Button>
        </header>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
          {error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
          {step === 3 && teacherId && tenantId && tenantSlug ? (
            <TeacherAccountingView
              tenantId={tenantId}
              tenantSlug={tenantSlug}
              initialTeacherId={teacherId}
              isModal={true}
            />
          ) : step === 1 ? <>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2 text-sm font-semibold">اسم المعلم <span aria-hidden="true">*</span>
                  <input className={control} required maxLength={100} value={input.fullName}
                    onChange={event => setField('fullName', event.target.value)} autoFocus />
                </label>
                <label className="text-sm font-semibold">رقم الهاتف (1) <span aria-hidden="true">*</span>
                  <input className={control} dir="ltr" type="tel" required value={input.phone} onChange={event => setField('phone', event.target.value)} />
                </label>
                <label className="text-sm font-semibold">رقم الهاتف (2) <span className="font-normal text-muted-foreground">اختياري</span>
                  <input className={control} dir="ltr" type="tel" value={input.phone2} onChange={event => setField('phone2', event.target.value)} />
                </label>
              </div>
              <div className="flex w-24 flex-col items-center gap-1 sm:w-28">
                <label className="relative grid aspect-square w-full cursor-pointer place-items-center overflow-hidden rounded-2xl border border-border bg-muted text-muted-foreground focus-within:ring-2 focus-within:ring-brand-cyan-500">
                  {avatar ? <img src={avatar} alt="" className="absolute inset-0 size-full object-cover" /> : <UserRound size={30} />}
                  <span className="absolute bottom-1.5 left-1.5 grid size-7 place-items-center rounded-lg bg-card text-foreground shadow"><Camera size={15} /></span>
                  <input aria-label="صورة المعلم" type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" onChange={async event => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    setProcessingPhoto(true);
                    setError('');
                    try { setField('avatarData', await thumbnail(file)); }
                    catch (cause) { setError(cause instanceof Error ? cause.message : 'تعذّر قراءة الصورة'); }
                    finally { setProcessingPhoto(false); }
                  }} />
                </label>
                <span className="text-xs text-muted-foreground">{processingPhoto ? 'تجهيز الصورة…' : 'صورة المعلم'}</span>
                {input.avatarData && <button type="button" className="text-xs text-red-600 underline" onClick={() => {
                  setField('avatarData', null);
                  setShowOldPhoto(false);
                }}>إزالة الصورة المرفوعة</button>}
              </div>
            </div>

            <fieldset className="space-y-3 rounded-2xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">المراحل والصفوف وطريقة الحساب</legend>
              {contracts.map((contract, index) => (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-xl bg-muted/45 p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.65fr)_auto]">
                  <label className="text-xs font-semibold">المرحلة أو الصف
                    <select className={control} value={contract.level} onChange={event => updateContract(index, { level: event.target.value })}>
                      <option value="">اختر</option>
                      {stageList.map(stage => <optgroup key={stage.code} label={stage.nameAr}>
                        <option value={stage.code} disabled={contracts.some((item, at) => at !== index && item.level === stage.code)}>{stage.nameAr} بالكامل</option>
                        {stage.grades.map(grade => <option key={grade.code} value={grade.code}
                          disabled={contracts.some((item, at) => at !== index && item.level === grade.code)}>{grade.nameAr}</option>)}
                      </optgroup>)}
                    </select>
                  </label>
                  <label className="col-span-2 text-xs font-semibold sm:col-span-1">طريقة الحساب
                    <select className={control} value={contract.model} onChange={event =>
                      updateContract(index, { model: event.target.value as TeacherContract['model'], value: '' })}>
                      {teacherModels.map(model => <option key={model} value={model}>{TEACHER_MODELS[model]}</option>)}
                    </select>
                  </label>
                  <label className="text-xs font-semibold">
                    {contract.model === 'private' ? 'نسبة المعلم %' : contract.model === 'per_attendee' ? 'ج.م / طالب' : 'ج.م / حصة'}
                    <input className={control} inputMode="decimal" value={contract.value}
                      onChange={event => updateContract(index, { value: event.target.value })} />
                  </label>
                  <Button type="button" variant="ghost" size="icon" aria-label={`حذف التعاقد ${index + 1}`}
                    onClick={() => setContracts(items => items.filter((_, at) => at !== index))}><Trash2 size={16} className="text-red-600" /></Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" disabled={contracts.length >= 15}
                onClick={() => setContracts(items => [...items, { level: '', model: 'fixed_session', value: '' }])}><Plus size={15} /> إضافة مرحلة أو صف</Button>
            </fieldset>

            <fieldset className="space-y-2 rounded-2xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">المواد الدراسية</legend>
              {subjects.length ? <div className="grid max-h-36 gap-2 overflow-y-auto sm:grid-cols-2">
                {subjects.map(subject => <label key={subject.id} className="flex items-start gap-2 rounded-lg bg-muted/40 p-2 text-xs">
                  <input type="checkbox" className="mt-0.5 accent-cyan-600" checked={input.subjectIds.includes(subject.id)}
                    onChange={event => setField('subjectIds', event.target.checked ? [...input.subjectIds, subject.id] : input.subjectIds.filter(id => id !== subject.id))} />
                  <span>{subject.nameAr}<span className="block text-muted-foreground">{getGradeNameArabic(subject.grade)}</span></span>
                </label>)}
              </div> : <p className="text-xs text-muted-foreground">اختيار المواد هيتاح لما تتضاف مواد لقائمة السنتر.</p>}
            </fieldset>

            <fieldset className="space-y-2 rounded-2xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">تسجيل دخول المعلم</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2"><input name="teacher-login" type="radio" checked={input.login?.mode === 'username'}
                  onChange={() => { setPassword(''); setField('login', initial.login?.mode === 'username' ? initial.login : { mode: 'username', username: '' }); }} /> اسم مستخدم وكلمة مرور</label>
                <label className="flex items-center gap-2"><input name="teacher-login" type="radio" checked={input.login?.mode === 'google'}
                  onChange={() => { setPassword(''); setField('login', initial.login?.mode === 'google' ? initial.login : { mode: 'google', email: '' }); }} /> حساب Google</label>
              </div>
              {input.login?.mode === 'username' && <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold">اسم المستخدم
                  <input className={control} dir="ltr" autoComplete="off" maxLength={32} value={input.login.username}
                    onChange={event => setField('login', { mode: 'username', username: event.target.value })} />
                </label>
                {needsPassword && <label className="text-xs font-semibold">كلمة المرور
                  <input className={control} dir="ltr" type="password" autoComplete="new-password" minLength={8} maxLength={128}
                    value={password} onChange={event => setPassword(event.target.value)} />
                </label>}
              </div>}
              {input.login?.mode === 'google' && <label className="block text-xs font-semibold">بريد حساب Google للمعلم
                <input className={control} dir="ltr" type="email" value={input.login.email} maxLength={254}
                  onChange={event => setField('login', { mode: 'google', email: event.target.value })} />
              </label>}
              {demo && <p className="text-xs text-muted-foreground">النسخة التجريبية تحفظ إعداد الدخول فقط. تفعيل الحساب يحتاج Firebase.</p>}
            </fieldset>
          </> : <>
            <fieldset className="grid gap-2 rounded-2xl border border-border p-3 sm:grid-cols-2">
              <legend className="px-1 text-sm font-bold">صلاحيات {input.fullName}</legend>
              {teacherPermissions.map(permission => <label key={permission} className="flex items-start gap-2 rounded-lg bg-muted/40 p-3 text-sm">
                <input type="checkbox" className="mt-1 accent-cyan-600" checked={input.permissions.includes(permission)}
                  disabled={permission === 'viewStudentDetails' && !input.permissions.includes('viewStudents')}
                  onChange={event => togglePermission(permission, event.target.checked)} />
                <span>{TEACHER_PERMISSIONS[permission]}
                  {permission === 'publishForum' && <small className="block text-muted-foreground">تُستخدم عند إطلاق المنتدى</small>}
                </span>
              </label>)}
            </fieldset>
            <fieldset className="flex flex-wrap gap-3 rounded-2xl border border-border p-3">
              <legend className="px-1 text-sm font-bold">التبويبات الظاهرة في صفحة المعلم</legend>
              {teacherTabs.map(tab => <label key={tab} className="inline-flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <input type="checkbox" className="accent-cyan-600" checked={input.tabs.includes(tab)} onChange={event => toggleTab(tab, event.target.checked)} />
                {TEACHER_TABS[tab].label}
              </label>)}
              <p className="w-full text-xs text-muted-foreground">التبويب يظهر للمعلم لما تكون صلاحية استخدامه مفعّلة.</p>
            </fieldset>
          </>}
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-border p-4">
          {step === 3 ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                العودة للبيانات
              </Button>
              <Button type="button" onClick={onClose}>
                إغلاق
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={saving} onClick={step === 2 ? () => { setError(''); setStep(1); } : onClose}>
                {step === 2 ? 'السابق' : 'إلغاء'}
              </Button>
              <Button type="submit" disabled={saving || processingPhoto}>{step === 1 ? 'التالي' : saving ? 'جارٍ الحفظ…' : 'حفظ المعلم'}</Button>
            </>
          )}
        </footer>
      </form>
    </dialog>
  );
}
