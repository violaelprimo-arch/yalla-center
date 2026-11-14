'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  Filter,
  GraduationCap,
  Layers,
  Code2,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Subject } from '@/lib/dal/types';
import { isRegisteredGroup } from '@/lib/timetable/group-schedule';

export default function SubjectsManagementPage() {
  const { tenant, masterData, groupData } = useTenant();

  const { data: { subjects, stages }, loading, canEdit, save } = masterData;

  // Filters
  const [selectedStageFilter, setSelectedStageFilter] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [formData, setFormData] = useState({
    nameAr: '',
    code: '',
    stage: '',
    grade: '',
  });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const linkedGroups = deleteTarget
    ? groupData.groups.filter(group => group.subjectId === deleteTarget.id && isRegisteredGroup(group))
    : [];

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Lookup maps for stage and grade names
  const stageNameMap = useMemo(() => {
    const map = new Map<string, string>();
    stages.forEach((s) => map.set(s.id, s.nameAr));
    return map;
  }, [stages]);

  const gradeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    stages.forEach((s) => {
      (s.grades || []).forEach((g) => map.set(g.id, g.nameAr));
    });
    return map;
  }, [stages]);

  // Grades available for the selected stage filter
  const filterGrades = useMemo(() => {
    if (!selectedStageFilter) return [];
    const stage = stages.find((s) => s.id === selectedStageFilter);
    return stage?.grades || [];
  }, [stages, selectedStageFilter]);

  // Grades available for modal form's selected stage
  const formAvailableGrades = useMemo(() => {
    if (!formData.stage) return [];
    const stage = stages.find((s) => s.id === formData.stage);
    return stage?.grades || [];
  }, [stages, formData.stage]);

  // Filtered subjects list
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      if (selectedStageFilter && s.stage !== selectedStageFilter) return false;
      if (selectedGradeFilter && s.grade !== selectedGradeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = s.nameAr.toLowerCase().includes(q);
        const matchesCode = (s.code || '').toLowerCase().includes(q);
        const stageName = (stageNameMap.get(s.stage) || '').toLowerCase();
        const gradeName = (gradeNameMap.get(s.grade) || '').toLowerCase();
        if (!matchesName && !matchesCode && !stageName.includes(q) && !gradeName.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [subjects, selectedStageFilter, selectedGradeFilter, searchQuery, stageNameMap, gradeNameMap]);

  // Open Modal for Create or Edit
  const handleOpenModal = (subject?: Subject) => {
    setFormError('');
    if (subject) {
      setEditingSubject(subject);
      setFormData({
        nameAr: subject.nameAr,
        code: subject.code || '',
        stage: subject.stage,
        grade: subject.grade,
      });
    } else {
      setEditingSubject(null);
      const defaultStage = stages[0]?.id || '';
      const defaultGrade = stages[0]?.grades?.[0]?.id || '';
      setFormData({
        nameAr: '',
        code: '',
        stage: defaultStage,
        grade: defaultGrade,
      });
    }
    setIsModalOpen(true);
  };

  // Stage change in modal updates available grades and picks first grade
  const handleFormStageChange = (newStageId: string) => {
    const stage = stages.find((s) => s.id === newStageId);
    const firstGradeId = stage?.grades?.[0]?.id || '';
    setFormData((prev) => ({
      ...prev,
      stage: newStageId,
      grade: firstGradeId,
    }));
  };

  // Submit Modal
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formData.nameAr.trim();
    if (!trimmedName) {
      setFormError('اسم المادة مطلوب');
      return;
    }
    if (!formData.stage) {
      setFormError('المرحلة التعليمية مطلوبة');
      return;
    }
    if (!formData.grade) {
      setFormError('الصف الدراسي مطلوب');
      return;
    }

    // Client-side check for duplicate name in the same grade
    const duplicate = subjects.find(
      (s) =>
        s.grade === formData.grade &&
        s.nameAr.trim().toLowerCase() === trimmedName.toLowerCase() &&
        s.id !== editingSubject?.id
    );
    if (duplicate) {
      setFormError('يوجد مادة بنفس الاسم في هذا الصف بالفعل');
      return;
    }

    try {
      setIsSaving(true);
      await save({
        action: 'saveSubject',
        subject: {
          id: editingSubject?.id,
          nameAr: trimmedName,
          code: formData.code.trim(),
          stage: formData.stage,
          grade: formData.grade,
        },
      });
      showToast('success', editingSubject ? 'تم تعديل المادة الدراسية بنجاح' : 'تم إضافة المادة الدراسية بنجاح');
      setIsModalOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'تعذّر حفظ المادة الدراسية');
    } finally {
      setIsSaving(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');

    try {
      setIsDeleting(true);
      await save({ action: 'deleteSubject', subjectId: deleteTarget.id });
      showToast('success', 'تم حذف المادة الدراسية بنجاح');
      setDeleteTarget(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'تعذّر حذف المادة الدراسية');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <MasterDataStatus />
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-soft-xl border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="mr-2 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 flex items-center justify-center text-brand-cyan-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">قائمة المواد الدراسية</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              إدارة المقررات والمناهج المعتمدة لمراحل وصفوف سنتر {tenant.nameAr}
            </p>
          </div>
        </div>

        <Button
          disabled={!canEdit}
          onClick={() => handleOpenModal()}
          className="gap-2 bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold shrink-0 shadow-soft-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة مادة دراسية</span>
        </Button>
      </div>

      {/* Filters Bar */}
      <Card className="bg-card/70 border-border">
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الكود..."
              className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Stage Filter */}
          <div>
            <select
              value={selectedStageFilter}
              onChange={(e) => {
                setSelectedStageFilter(e.target.value);
                setSelectedGradeFilter('');
              }}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
            >
              <option value="">جميع المراحل التعليمية</option>
              {stages.map((stage) => (
                <option key={stage.id} value={stage.id}>
                  {stage.nameAr}
                </option>
              ))}
            </select>
          </div>

          {/* Grade Filter */}
          <div>
            <select
              value={selectedGradeFilter}
              disabled={!selectedStageFilter}
              onChange={(e) => setSelectedGradeFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500 disabled:opacity-50"
            >
              <option value="">
                {selectedStageFilter ? 'جميع الصفوف في هذه المرحلة' : 'اختر مرحلة أولاً لفلترة الصفوف'}
              </option>
              {filterGrades.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.nameAr}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Table / List */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-3 border-brand-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">جارٍ تحميل المواد الدراسية...</p>
        </div>
      ) : filteredSubjects.length === 0 ? (
        <Card className="border-border text-center py-16">
          <CardContent className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <BookOpen className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">لا توجد مواد دراسية مطابقة</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              لم نجد أي مادة دراسية تطابق معايير البحث. يمكنك إضافة مواد دراسية جديدة للمرحلة والصف المطلوبين.
            </p>
            <Button
              disabled={!canEdit}
              onClick={() => handleOpenModal()}
              className="mt-4 gap-2 bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مادة دراسية</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border shadow-soft-sm overflow-hidden bg-card/60">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                <tr>
                  <th className="p-3.5 px-4">اسم المادة</th>
                  <th className="p-3.5 px-4">الكود</th>
                  <th className="p-3.5 px-4">المرحلة التعليمية</th>
                  <th className="p-3.5 px-4">الصف الدراسي</th>
                  <th className="p-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredSubjects.map((subject) => {
                  const stageName = stageNameMap.get(subject.stage) || subject.stage;
                  const gradeName = gradeNameMap.get(subject.grade) || subject.grade;

                  return (
                    <tr key={subject.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3.5 px-4 font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <BookOpen className="w-4 h-4 text-brand-cyan-500 shrink-0" />
                          <span>{subject.nameAr}</span>
                        </div>
                      </td>
                      <td className="p-3.5 px-4 font-mono text-muted-foreground text-xs">
                        {subject.code || '—'}
                      </td>
                      <td className="p-3.5 px-4">
                        <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30 text-xs">
                          {stageName}
                        </Badge>
                      </td>
                      <td className="p-3.5 px-4">
                        <Badge variant="outline" className="bg-brand-cyan-500/10 text-brand-cyan-400 border-brand-cyan-500/30 text-xs">
                          {gradeName}
                        </Badge>
                      </td>
                      <td className="p-3.5 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canEdit}
                            onClick={() => handleOpenModal(subject)}
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                            title="تعديل المادة"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!canEdit}
                            onClick={() => { setDeleteError(''); setDeleteTarget(subject); }}
                            className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10"
                            title="حذف المادة"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* MODAL: Add / Edit Subject */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-soft-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingSubject ? 'تعديل المادة الدراسية' : 'إضافة مادة دراسية جديدة'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Stage Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  المرحلة التعليمية <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.stage}
                  onChange={(e) => handleFormStageChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                >
                  <option value="" disabled>
                    اختر المرحلة التعليمية
                  </option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Grade Selection */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  الصف الدراسي <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.grade}
                  disabled={!formData.stage || formAvailableGrades.length === 0}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500 disabled:opacity-50"
                >
                  <option value="" disabled>
                    {formAvailableGrades.length === 0 ? 'لا توجد صفوف لهذه المرحلة' : 'اختر الصف الدراسي'}
                  </option>
                  {formAvailableGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subject Name */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  اسم المادة الدراسية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="مثال: الرياضيات التطبيقية"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              {/* Subject Code (Optional) */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  كود المادة (اختياري)
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="مثال: MATH-101"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500 font-mono"
                />
              </div>

              <div className="p-2.5 rounded-lg bg-muted text-muted-foreground text-[11px] leading-relaxed">
                يُسمح بنفس اسم المادة في صفوف مختلفة، ولكن يمنع تكرار اسم المادة داخل نفس الصف.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
                >
                  {isSaving ? 'جارٍ الحفظ...' : 'حفظ المادة'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-soft-2xl overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">
                تأكيد حذف المادة
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من رغبتك في حذف مادة{' '}
              <strong className="text-foreground">{deleteTarget.nameAr}</strong>؟
              حذف المادة يتطلب إزالة ارتباطها بالمجموعات المسجلة والمذكرات والامتحانات.
            </p>

            {linkedGroups.length > 0 && (
              <div className="rounded-xl border border-border bg-muted p-3 text-xs">
                <p className="break-words">{linkedGroups.map(group => group.nameAr).join('، ')}</p>
                <Link href={`/center/${tenant.slug}/sessions`} className="mt-1 inline-block font-semibold text-brand-cyan-700 underline dark:text-brand-cyan-300">
                  إدارة المجموعات المرتبطة
                </Link>
              </div>
            )}
            {deleteError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
