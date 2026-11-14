'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EducationalStage, Material, Subject } from '@/lib/dal/types';
import { materialDetailsSchema, type MaterialDetails, type MaterialMutation } from '@/lib/materials/management';
import { DOCUMENT_CATEGORIES, getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';

const fieldClass = 'w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

export function MaterialEditor({ material, stages, subjects, onSave, onClose }: {
  material?: Material;
  stages: EducationalStage[];
  subjects: Subject[];
  onSave: (mutation: MaterialMutation) => Promise<void>;
  onClose: () => void;
}) {
  const initialSubject = subjects.find(subject => subject.stage === 'secondary' && subject.grade === '3_sec') ?? subjects[0];
  const [form, setForm] = useState<MaterialDetails>({
    title: material?.title ?? '', description: material?.description ?? '',
    googleDriveUrlOrId: material?.googleDriveWebViewLink ?? material?.googleDriveFileId ?? '',
    stage: material?.stage ?? initialSubject?.stage ?? '', grade: material?.grade ?? initialSubject?.grade ?? '',
    subjectId: material?.subjectId ?? initialSubject?.id ?? '', unitName: material?.unitName ?? '', lessonName: material?.lessonName ?? '',
    category: material?.category ?? 'lecture_notes',
  });
  const [autoIndex, setAutoIndex] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);
  const title = material ? 'تعديل المذكرة' : 'إضافة مذكرة';
  const grades = stages.find(stage => stage.id === form.stage)?.grades ?? [];
  const offeredSubjects = subjects.filter(subject => subject.stage === form.stage && subject.grade === form.grade);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);

  function update(changes: Partial<MaterialDetails>) {
    setForm(previous => ({ ...previous, ...changes }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const details = materialDetailsSchema.safeParse(form);
    if (!details.success) {
      setError(details.error.issues[0].message);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(material
        ? { action: 'update', id: material.id, updatedAt: material.updatedAt, details: details.data }
        : { action: 'create', input: { ...details.data, autoIndex } });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حفظ المذكرة');
    } finally {
      setSaving(false);
    }
  }

  return <dialog ref={dialog} dir="rtl" aria-labelledby="material-editor-title"
    className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-card text-foreground shadow-2xl backdrop:bg-black/60"
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card p-4 sm:px-6">
      <h2 id="material-editor-title" className="text-lg font-bold">{title}</h2>
      <Button type="button" variant="ghost" size="icon" aria-label="إغلاق" disabled={saving} onClick={onClose}><X size={18} /></Button>
    </div>
    <form onSubmit={submit} className="space-y-4 p-4 sm:p-6">
      {error && <p role="alert" className="rounded-lg bg-rose-600/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">{error}</p>}
      <fieldset disabled={saving} className="space-y-3 text-sm font-semibold">
        <label className="block space-y-1"><span>عنوان المذكرة</span><input className={fieldClass} required autoFocus maxLength={300}
          value={form.title} onChange={event => update({ title: event.target.value })} /></label>
        <label className="block space-y-1"><span>نبذة عن المحتوى</span><textarea className={fieldClass} rows={2} maxLength={4000}
          value={form.description} onChange={event => update({ description: event.target.value })} /></label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1"><span>المرحلة</span><select className={fieldClass} value={form.stage} required
            onChange={event => update({ stage: event.target.value, grade: '', subjectId: '' })}>
            <option value="">اختر المرحلة</option>
            {form.stage && !stages.some(stage => stage.id === form.stage) && <option value={form.stage}>{getStageNameArabic(form.stage)}</option>}
            {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.nameAr}</option>)}
          </select></label>
          <label className="space-y-1"><span>الصف الدراسي</span><select className={fieldClass} value={form.grade} required disabled={!form.stage}
            onChange={event => update({ grade: event.target.value, subjectId: '' })}>
            <option value="">اختر الصف</option>
            {form.grade && !grades.some(grade => grade.id === form.grade) && <option value={form.grade}>{getGradeNameArabic(form.grade)}</option>}
            {grades.map(grade => <option key={grade.id} value={grade.id}>{grade.nameAr}</option>)}
          </select></label>
          <label className="space-y-1"><span>المادة الدراسية</span><select className={fieldClass} value={form.subjectId} required disabled={!form.grade}
            onChange={event => update({ subjectId: event.target.value })}>
            <option value="">{form.grade && !offeredSubjects.length ? 'مفيش مواد مضافة للصف ده' : 'اختر المادة'}</option>
            {form.subjectId && !offeredSubjects.some(subject => subject.id === form.subjectId) &&
              <option value={form.subjectId}>{subjects.find(subject => subject.id === form.subjectId)?.nameAr ?? 'المادة المسجلة للمذكرة'}</option>}
            {offeredSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.nameAr}</option>)}
          </select></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1"><span>الوحدة الدراسية</span><input className={fieldClass} required maxLength={200}
            value={form.unitName} onChange={event => update({ unitName: event.target.value })} /></label>
          <label className="space-y-1"><span>الدرس التعليمي</span><input className={fieldClass} required maxLength={200}
            value={form.lessonName} onChange={event => update({ lessonName: event.target.value })} /></label>
        </div>
        <label className="block space-y-1"><span>تصنيف المذكرة</span><select className={fieldClass} value={form.category}
          onChange={event => update({ category: event.target.value as MaterialDetails['category'] })}>
          {Object.values(DOCUMENT_CATEGORIES).map(item => <option key={item.code} value={item.code}>{item.nameAr}</option>)}
        </select></label>
        <label className="block space-y-1"><span>رابط Google Drive (اختياري)</span><input className={fieldClass} dir="ltr" maxLength={2000}
          value={form.googleDriveUrlOrId} onChange={event => update({ googleDriveUrlOrId: event.target.value })} /></label>
        {!material && <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={autoIndex}
          onChange={event => setAutoIndex(event.target.checked)} /> فهرسة النص عند الإضافة</label>}
      </fieldset>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        <Button type="button" variant="outline" disabled={saving} onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ المذكرة'}</Button>
      </div>
    </form>
  </dialog>;
}
