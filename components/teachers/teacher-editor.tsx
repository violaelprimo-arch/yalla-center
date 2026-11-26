'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Camera,
  UserRound,
  X,
  Check,
  AlertCircle,
  Briefcase,
  ShieldCheck,
  Building2,
  Calendar,
  Layers,
  BookOpen,
  DollarSign,
  Percent,
  Users,
  Eye,
  MessageSquare,
  FileText,
  Clock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';
import type { Subject, EducationalStage } from '@/lib/dal/types';
import {
  TEACHER_PERMISSIONS,
  TEACHER_TABS,
  LEGACY_TEACHER_MODELS,
  teacherInputSchema,
  teacherPermissions,
  teacherTabs,
  type TeacherInput,
  type TeacherPermission,
  type TeacherTab,
  type TeacherContract,
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

const control =
  'mt-1 block w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 transition-all';

async function thumbnail(file: File): Promise<string> {
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
    context.fillStyle = '#0B132B';
    context.fillRect(0, 0, 240, 240);
    context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, 240, 240);
    const data = canvas.toDataURL('image/jpeg', 0.85);
    if (data.length > 90000) throw new Error('حجم الصورة كبير بعد الضغط، اختر صورة أصغر');
    return data;
  } finally {
    image.close();
  }
}

export function TeacherEditor({
  initial,
  editing,
  teacherId,
  tenantId,
  tenantSlug,
  originalAvatar,
  demo,
  subjects,
  stages = [],
  onSave,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const validSubjectIds = new Set(subjects.map((s) => s.id));
  const [input, setInput] = useState<TeacherInput>(() => ({
    ...initial,
    subjectIds: (initial.subjectIds || []).filter((id) => validSubjectIds.size === 0 || validSubjectIds.has(id)),
    contracts: initial.contracts || [],
    permissions: initial.permissions || ['viewAccount', 'viewSchedule', 'viewStudents'],
    tabs: initial.tabs || teacherTabs,
  }));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [showOldPhoto, setShowOldPhoto] = useState(true);

  // Selected stage IDs
  const [selectedStageIds, setSelectedStageIds] = useState<string[]>(() => {
    if (input.contracts && input.contracts.length > 0) {
      return [...new Set(input.contracts.map((c) => c.level))];
    }
    return stages.length > 0 ? [stages[0].id] : [];
  });

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const avatar = input.avatarData ?? (showOldPhoto ? originalAvatar : undefined);
  const needsPassword =
    !demo &&
    input.login?.mode === 'username' &&
    (initial.login?.mode !== 'username' ||
      initial.login.username !== input.login.username.trim().toLowerCase());

  const setField = <K extends keyof TeacherInput>(field: K, value: TeacherInput[K]) =>
    setInput((prev) => ({ ...prev, [field]: value }));

  // Stage selection toggle
  const toggleStage = (stageId: string) => {
    setSelectedStageIds((prev) =>
      prev.includes(stageId) ? prev.filter((id) => id !== stageId) : [...prev, stageId]
    );
  };

  const togglePermission = (permission: TeacherPermission, checked: boolean) => {
    const next = checked ? [...input.permissions, permission] : input.permissions.filter((item) => item !== permission);
    setField(
      'permissions',
      permission === 'viewStudents' && !checked ? next.filter((item) => item !== 'viewStudentDetails') : next
    );
  };

  const toggleTab = (tab: TeacherTab, checked: boolean) => {
    setField('tabs', checked ? [...input.tabs, tab] : input.tabs.filter((item) => item !== tab));
  };

  async function handleNextStep() {
    setError('');
    if (!input.fullName.trim()) {
      setError('اسم المعلم مطلوب');
      return;
    }
    if (!input.phone.trim()) {
      setError('رقم الهاتف (1) مطلوب');
      return;
    }
    if (selectedStageIds.length === 0) {
      setError('اختر مرحلة تعليمية واحدة على الأقل');
      return;
    }
    if (!input.login) {
      setError('اختر طريقة تسجيل دخول المعلم');
      return;
    }
    if (input.login.mode === 'username' && !input.login.username.trim()) {
      setError('اسم المستخدم مطلوب');
      return;
    }
    if (input.login.mode === 'google' && !input.login.email.trim()) {
      setError('اكتب بريد Google صحيح');
      return;
    }
    if (needsPassword) {
      if (!password || password.length < 8) {
        setError('كلمة المرور لازم تكون 8 أحرف على الأقل');
        return;
      }
      if (password !== confirmPassword) {
        setError('كلمة المرور وتأكيد كلمة المرور غير متطابقتين');
        return;
      }
    }

    setStep(2);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || processingPhoto) return;
    setError('');

    // Prepare contracts array from selected stages without financial agreements
    const contracts: TeacherContract[] = selectedStageIds.map((stageId) => ({
      level: stageId,
      model: 'fixed_session',
      value: 0,
    } as any));

    const activeSubjectIds = new Set(subjects.map((s) => s.id));
    const payload: TeacherInput = {
      ...input,
      subjectIds: (input.subjectIds || []).filter((id) => activeSubjectIds.size === 0 || activeSubjectIds.has(id)),
      contracts,
    };

    const parsed = teacherInputSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue.message);
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed.data, needsPassword ? password : undefined);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حفظ بيانات المعلم');
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      dir="rtl"
      aria-labelledby="teacher-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
      className="m-auto max-h-[94dvh] w-[min(94vw,840px)] overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl backdrop:bg-black/60 transition-all p-0"
    >
      <form onSubmit={submit} noValidate className="flex max-h-[94dvh] flex-col">
        {/* Modal Header */}
        <header className="border-b border-border px-6 py-4 bg-muted/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center font-bold">
                <Briefcase className="w-5 h-5" />
              </div>
              <div>
                <h2 id="teacher-editor-title" className="text-base font-black text-foreground">
                  {editing ? 'تعديل بيانات المعلم والاتفاقات المالية' : 'إضافة معلم جديد — معالج التسجيل'}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {step === 1 ? 'الخطوة 1: البيانات الأساسية والمراحل والاتفاقات المالية' : 'الخطوة 2: الصلاحيات الممنوحة والتبويبات المتاحة'}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="إغلاق"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl hover:bg-muted text-muted-foreground"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Stepper Progress Bar */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                step === 1
                  ? 'bg-brand-cyan-500/15 text-brand-cyan-600 dark:text-brand-cyan-400 border-brand-cyan-500/30 shadow-soft-sm'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 1 ? 'bg-brand-cyan-600 text-white font-black' : 'bg-muted-foreground/30 text-foreground'}`}>
                ١
              </span>
              <span>بيانات المعلم والمراحل والمواد</span>
            </button>

            <button
              type="button"
              onClick={handleNextStep}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                step === 2
                  ? 'bg-brand-cyan-500/15 text-brand-cyan-600 dark:text-brand-cyan-400 border-brand-cyan-500/30 shadow-soft-sm'
                  : 'bg-muted/40 text-muted-foreground border-transparent hover:bg-muted/70'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 2 ? 'bg-brand-cyan-600 text-white font-black' : 'bg-muted-foreground/30 text-foreground'}`}>
                ٢
              </span>
              <span>صلاحيات المعلم والتبويبات</span>
            </button>
          </div>
        </header>

        {/* Modal Scrollable Body */}
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6 custom-scrollbar">
          {error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 ? (
            <>
              {/* SECTION: Teacher Photo (TOP-LEFT visual placement) & Primary Details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Photo Uploader (Visual Top-Left in RTL: placed on secondary col in desktop grid) */}
                <div className="md:col-span-4 order-1 md:order-2 flex flex-col items-center justify-center p-4 rounded-2xl border border-border bg-muted/20 text-center space-y-2.5">
                  <span className="text-xs font-bold text-foreground">صورة المعلم الشخصية</span>
                  <label className="relative grid aspect-square w-28 cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-border hover:border-brand-cyan-500 bg-background text-muted-foreground focus-within:ring-2 focus-within:ring-brand-cyan-500 transition-all shadow-sm">
                    {avatar ? (
                      <img src={avatar} alt={input.fullName || 'صورة المعلم'} className="absolute inset-0 size-full object-cover" />
                    ) : (
                      <div className="flex flex-col items-center gap-1">
                        <UserRound size={36} className="text-muted-foreground/60" />
                        <span className="text-[10px] text-muted-foreground">رفع صورة</span>
                      </div>
                    )}
                    <span className="absolute bottom-1.5 left-1.5 grid size-7 place-items-center rounded-lg bg-card/90 text-foreground shadow border border-border">
                      <Camera size={14} />
                    </span>
                    <input
                      aria-label="رفع صورة المعلم"
                      type="file"
                      className="sr-only"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        if (!file) return;
                        setProcessingPhoto(true);
                        setError('');
                        try {
                          const dataUrl = await thumbnail(file);
                          setField('avatarData', dataUrl);
                        } catch (cause) {
                          setError(cause instanceof Error ? cause.message : 'تعذّر قراءة الصورة');
                        } finally {
                          setProcessingPhoto(false);
                        }
                      }}
                    />
                  </label>
                  <p className="text-[11px] text-muted-foreground">
                    {processingPhoto ? 'جارٍ معالجة وضغط الصورة…' : 'PNG أو JPG بحد أقصى 8MB'}
                  </p>
                  {input.avatarData && (
                    <button
                      type="button"
                      className="text-[11px] text-red-500 hover:text-red-600 flex items-center gap-1 underline transition-colors"
                      onClick={() => {
                        setField('avatarData', null);
                        setShowOldPhoto(false);
                      }}
                    >
                      <Trash2 size={12} />
                      <span>إزالة الصورة</span>
                    </button>
                  )}
                </div>

                {/* Teacher Basic Inputs */}
                <div className="md:col-span-8 order-2 md:order-1 space-y-3.5">
                  <div>
                    <label className="text-xs font-bold text-foreground flex items-center gap-1">
                      <span>اسم المعلم بالكامل</span>
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      className={control}
                      aria-label="اسم المعلم"
                      required
                      placeholder="أدخل اسم المعلم الثلاثي أو الرباعي"
                      maxLength={100}
                      value={input.fullName}
                      onChange={(e) => setField('fullName', e.target.value)}
                      autoFocus
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1">
                        <span>رقم الهاتف (1)</span>
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        className={control}
                        aria-label="رقم الهاتف (1)"
                        dir="ltr"
                        type="tel"
                        required
                        placeholder="01012345678"
                        value={input.phone}
                        onChange={(e) => setField('phone', e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground flex items-center gap-1">
                        <span>رقم الهاتف (2)</span>
                        <span className="text-[10px] text-muted-foreground font-normal">(اختياري)</span>
                      </label>
                      <input
                        className={control}
                        aria-label="رقم الهاتف (2)"
                        dir="ltr"
                        type="tel"
                        placeholder="01234567890"
                        value={input.phone2}
                        onChange={(e) => setField('phone2', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION: Multiple Educational Stages */}
              <div className="space-y-4 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400" />
                      <span>المراحل التعليمية</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      اختر المراحل التعليمية المتاحة للمعلم.
                    </p>
                  </div>
                </div>

                {/* Stage Selection Pills */}
                {stages.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {stages.map((stage) => {
                      const isSelected = selectedStageIds.includes(stage.id);
                      return (
                        <button
                          key={stage.id}
                          type="button"
                          onClick={() => toggleStage(stage.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-brand-cyan-500/20 text-brand-cyan-600 dark:text-brand-cyan-400 border-brand-cyan-500/40 shadow-sm'
                              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/70'
                          }`}
                        >
                          <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${isSelected ? 'bg-brand-cyan-600 text-white' : 'border border-muted-foreground/40'}`}>
                            {isSelected && <Check size={10} />}
                          </span>
                          <span>{stage.nameAr}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد مراحل مسجلة في السنتر بعد.</p>
                )}
              </div>

              {/* SECTION: Multiple Teaching Subjects */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400" />
                    <span>المواد الدراسية المسندة للمعلم</span>
                  </h3>
                  <span className="text-xs text-muted-foreground">
                    ({input.subjectIds.length} مادة مختارة)
                  </span>
                </div>

                {subjects.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-44 overflow-y-auto p-1 custom-scrollbar">
                    {subjects.map((subject) => {
                      const isChecked = input.subjectIds.includes(subject.id);
                      return (
                        <label
                          key={subject.id}
                          className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-brand-cyan-500/10 border-brand-cyan-500/40 text-foreground'
                              : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 accent-cyan-600 rounded"
                            checked={isChecked}
                            onChange={(e) =>
                              setField(
                                'subjectIds',
                                e.target.checked
                                  ? [...input.subjectIds, subject.id]
                                  : input.subjectIds.filter((id) => id !== subject.id)
                              )
                            }
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold text-foreground block truncate">{subject.nameAr}</span>
                            <span className="text-[10px] text-muted-foreground block">
                              {getGradeNameArabic(subject.grade)}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">لا توجد مواد مسجلة في السنتر بعد.</p>
                )}
              </div>

              {/* SECTION: Teacher Account Credentials Setup */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400" />
                  <span>بيانات حساب المعلم</span>
                </h3>

                <div className="flex flex-wrap gap-4 text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="teacher-login-mode"
                      type="radio"
                      className="accent-cyan-600"
                      checked={input.login?.mode === 'username'}
                      onChange={() => {
                        setPassword('');
                        setConfirmPassword('');
                        setField(
                          'login',
                          initial.login?.mode === 'username'
                            ? initial.login
                            : { mode: 'username', username: '' }
                        );
                      }}
                    />
                    <span>اسم مستخدم وكلمة مرور</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      name="teacher-login-mode"
                      type="radio"
                      aria-label="حساب Google"
                      className="accent-cyan-600"
                      checked={input.login?.mode === 'google'}
                      onChange={() => {
                        setPassword('');
                        setConfirmPassword('');
                        setField(
                          'login',
                          initial.login?.mode === 'google'
                            ? initial.login
                            : { mode: 'google', email: '' }
                        );
                      }}
                    />
                    <span>البريد الإلكتروني المرتبط بحساب Google</span>
                  </label>
                </div>

                {input.login?.mode === 'username' && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div>
                      <label className="text-xs font-semibold text-foreground">اسم المستخدم</label>
                      <input
                        className={control}
                        aria-label="اسم المستخدم"
                        dir="ltr"
                        autoComplete="off"
                        maxLength={32}
                        placeholder="teacher_username"
                        value={input.login.username}
                        onChange={(e) =>
                          setField('login', { mode: 'username', username: e.target.value.toLowerCase() })
                        }
                      />
                    </div>
                    {needsPassword && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-foreground">كلمة المرور (مبدئية)</label>
                          <input
                            className={control}
                            aria-label="كلمة المرور"
                            dir="ltr"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-foreground">تأكيد كلمة المرور</label>
                          <input
                            className={control}
                            aria-label="تأكيد كلمة المرور"
                            dir="ltr"
                            type="password"
                            autoComplete="new-password"
                            minLength={8}
                            maxLength={128}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {input.login?.mode === 'google' && (
                  <div className="pt-1 space-y-1">
                    <label className="text-xs font-semibold text-foreground">البريد الإلكتروني لحساب Google</label>
                    <input
                      className={control}
                      aria-label="بريد حساب Google للمعلم"
                      dir="ltr"
                      type="email"
                      placeholder="teacher@gmail.com"
                      maxLength={254}
                      value={input.login.email}
                      onChange={(e) =>
                        setField('login', { mode: 'google', email: e.target.value.toLowerCase() })
                      }
                    />
                    <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                      سيتم إرسال دعوة الحساب، ويلزم المعلم تأكيد هويته عبر تسجيل الدخول الرسمي بحساب Google لربط الصلاحيات.
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* STEP 2: Teacher Permissions & Tab Visibility */}
              <div className="space-y-6">
                {/* Permissions Toggles */}
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400" />
                      <span>الصلاحيات الممنوحة لـ {input.fullName || 'المعلم'}</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      حدد الصلاحيات الإجرائية المسموح بها لهذا المعلم بشكل مستقل:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {teacherPermissions.map((permission) => {
                      const isChecked = input.permissions.includes(permission);
                      const isViewDetails = permission === 'viewStudentDetails';
                      const isDisabled = isViewDetails && !input.permissions.includes('viewStudents');

                      return (
                        <label
                          key={permission}
                          className={`p-3.5 rounded-2xl border transition-all flex items-start justify-between gap-3 cursor-pointer ${
                            isChecked
                              ? 'bg-card border-brand-cyan-500/40 shadow-soft-sm'
                              : 'bg-muted/30 border-border opacity-85'
                          } ${isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-foreground block">
                              {TEACHER_PERMISSIONS[permission]}
                            </span>
                            <span className="text-[11px] text-muted-foreground block mt-0.5">
                              {permission === 'viewAccount' && 'عرض المبالغ المستحقة والمسددة وكشف الحساب.'}
                              {permission === 'publishForum' && 'نشر بوستات وإعلانات في المنتدى الداخلي.'}
                              {permission === 'viewSchedule' && 'عرض جدول قاعات ومواعيد السنتر بالكامل.'}
                              {permission === 'requestExtraSession' && 'إمكانية إرسال طلب حصة إضافية للموافقة.'}
                              {permission === 'viewStudents' && 'عرض قوائم وأسماء الطلاب في مجموعاته فقط.'}
                              {permission === 'viewStudentDetails' && 'عرض أرقام أولياء الأمور والبيانات التفصيلية.'}
                            </span>
                          </div>

                          <input
                            type="checkbox"
                            aria-label={TEACHER_PERMISSIONS[permission]}
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={(e) => togglePermission(permission, e.target.checked)}
                            className="sr-only"
                          />

                          <div
                            aria-hidden="true"
                            className={`w-11 h-6 rounded-full transition-colors relative shrink-0 p-0.5 border ${
                              isChecked
                                ? 'bg-brand-cyan-600 border-brand-cyan-500'
                                : 'bg-muted border-border'
                            }`}
                          >
                            <span
                              className={`block w-5 h-5 rounded-full bg-white shadow-md transition-transform ${
                                isChecked ? '-translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Visible Tabs in Teacher Portal */}
                <div className="space-y-3 pt-2 border-t border-border">
                  <div>
                    <h3 className="text-sm font-black text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400" />
                      <span>التحكم في الصفحات والتبويبات الظاهرة في بوابة المعلم</span>
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      اختر الأقسام التي تظهر في شريط التنقل الخاص بالمعلم عند تسجيل دخوله:
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {teacherTabs.map((tab) => {
                      const isChecked = input.tabs.includes(tab);
                      return (
                        <label
                          key={tab}
                          className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer transition-all ${
                            isChecked
                              ? 'bg-brand-cyan-500/10 border-brand-cyan-500/40 text-foreground'
                              : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted/60'
                          }`}
                        >
                          <input
                            type="checkbox"
                            aria-label={TEACHER_TABS[tab].label}
                            className="accent-cyan-600 rounded"
                            checked={isChecked}
                            onChange={(e) => toggleTab(tab, e.target.checked)}
                          />
                          <span className="truncate">{TEACHER_TABS[tab].label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer Controls */}
        <footer className="border-t border-border px-6 py-4 bg-muted/20 flex items-center justify-between">
          {step === 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              className="rounded-xl flex items-center gap-1.5 text-xs font-bold"
            >
              <ArrowRight size={14} />
              <span>السابق (بيانات المعلم)</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl text-xs font-bold text-muted-foreground"
            >
              إلغاء
            </Button>
          )}

          <div className="ms-auto flex items-center gap-2">
            {step === 1 ? (
              <Button
                type="button"
                aria-label="التالي"
                onClick={handleNextStep}
                className="rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-soft-sm px-5"
              >
                <span>التالي</span>
                <ArrowLeft size={14} />
              </Button>
            ) : (
              <Button
                type="submit"
                aria-label="حفظ المعلم"
                disabled={saving}
                className="rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-soft-sm px-6"
              >
                <Check size={16} />
                <span>{saving ? 'جارٍ الحفظ…' : 'حفظ المعلم'}</span>
              </Button>
            )}
          </div>
        </footer>
      </form>
    </dialog>
  );
}
