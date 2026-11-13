'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Layers,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  ChevronDown,
  ArrowUpDown,
  BookOpen,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EducationalStage, EducationalGrade } from '@/lib/dal/types';

export default function StagesManagementPage() {
  const { tenant } = useTenant();

  const [stages, setStages] = useState<EducationalStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Notifications
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals state
  const [isStageModalOpen, setIsStageModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<EducationalStage | null>(null);
  const [stageFormData, setStageFormData] = useState({ nameAr: '', order: 1 });
  const [stageFormError, setStageFormError] = useState('');
  const [isSavingStage, setIsSavingStage] = useState(false);

  const [isGradeModalOpen, setIsGradeModalOpen] = useState(false);
  const [editingGrade, setEditingGrade] = useState<EducationalGrade | null>(null);
  const [gradeFormData, setGradeFormData] = useState({
    stageId: '',
    nameAr: '',
    order: 1,
    hasDivisions: false,
    divisionsText: '', // comma-separated
  });
  const [gradeFormError, setGradeFormError] = useState('');
  const [isSavingGrade, setIsSavingGrade] = useState(false);

  // Delete Confirm Modal
  const [deleteTarget, setDeleteTarget] = useState<{
    type: 'stage' | 'grade';
    id: string;
    nameAr: string;
    stageId?: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  const loadMasterData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/center/${tenant.slug}/master-data`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.data?.stages) {
        setStages(data.data.stages);
      } else {
        showToast('error', data.error || 'تعذر تحميل قائمة المراحل التعليمية');
      }
    } catch {
      showToast('error', 'خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [tenant.slug, showToast]);

  useEffect(() => {
    loadMasterData();
  }, [loadMasterData]);

  // Total grades count
  const totalGradesCount = useMemo(() => {
    return stages.reduce((acc, stage) => acc + (stage.grades?.length || 0), 0);
  }, [stages]);

  // Filtered stages
  const filteredStages = useMemo(() => {
    if (!searchQuery.trim()) return stages;
    const q = searchQuery.toLowerCase().trim();
    return stages
      .map((stage) => {
        const stageMatch = stage.nameAr.toLowerCase().includes(q);
        const matchedGrades = (stage.grades || []).filter((g) =>
          g.nameAr.toLowerCase().includes(q)
        );
        if (stageMatch) return stage;
        if (matchedGrades.length > 0) {
          return { ...stage, grades: matchedGrades };
        }
        return null;
      })
      .filter((s): s is EducationalStage => s !== null);
  }, [stages, searchQuery]);

  // Open Stage Modal
  const handleOpenStageModal = (stage?: EducationalStage) => {
    setStageFormError('');
    if (stage) {
      setEditingStage(stage);
      setStageFormData({
        nameAr: stage.nameAr,
        order: stage.order || 1,
      });
    } else {
      setEditingStage(null);
      setStageFormData({
        nameAr: '',
        order: stages.length + 1,
      });
    }
    setIsStageModalOpen(true);
  };

  // Submit Stage Form
  const handleSaveStage = async (e: React.FormEvent) => {
    e.preventDefault();
    setStageFormError('');

    if (!stageFormData.nameAr.trim()) {
      setStageFormError('اسم المرحلة التعليمية مطلوب');
      return;
    }

    try {
      setIsSavingStage(true);
      const res = await fetch(`/api/center/${tenant.slug}/master-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveStage',
          stage: {
            id: editingStage?.id,
            nameAr: stageFormData.nameAr.trim(),
            order: Number(stageFormData.order) || 1,
          },
        }),
      });

      const result = await res.json();
      if (result.success) {
        showToast('success', editingStage ? 'تم تعديل المرحلة التعليمية بنجاح' : 'تم إضافة المرحلة التعليمية بنجاح');
        setIsStageModalOpen(false);
        await loadMasterData();
      } else {
        setStageFormError(result.error || 'تعذر حفظ المرحلة التعليمية');
      }
    } catch {
      setStageFormError('خطأ أثناء إرسال البيانات إلى الخادم');
    } finally {
      setIsSavingStage(false);
    }
  };

  // Open Grade Modal
  const handleOpenGradeModal = (stageId?: string, grade?: EducationalGrade) => {
    setGradeFormError('');
    if (grade) {
      setEditingGrade(grade);
      setGradeFormData({
        stageId: grade.stageId,
        nameAr: grade.nameAr,
        order: grade.order || 1,
        hasDivisions: !!grade.hasDivisions,
        divisionsText: (grade.divisions || []).map((d) => d.nameAr).join('، '),
      });
    } else {
      setEditingGrade(null);
      const targetStage = stages.find((s) => s.id === stageId) || stages[0];
      setGradeFormData({
        stageId: targetStage?.id || '',
        nameAr: '',
        order: (targetStage?.grades?.length || 0) + 1,
        hasDivisions: false,
        divisionsText: '',
      });
    }
    setIsGradeModalOpen(true);
  };

  // Submit Grade Form
  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    setGradeFormError('');

    if (!gradeFormData.nameAr.trim()) {
      setGradeFormError('اسم الصف الدراسي مطلوب');
      return;
    }
    if (!gradeFormData.stageId) {
      setGradeFormError('المرحلة التابعة مطلوبة');
      return;
    }

    let parsedDivisions: Array<{ id: string; nameAr: string }> | undefined;
    if (gradeFormData.hasDivisions && gradeFormData.divisionsText.trim()) {
      parsedDivisions = gradeFormData.divisionsText
        .split(/[,،]/)
        .map((part) => part.trim())
        .filter(Boolean)
        .map((name, idx) => ({
          id: `div-${idx + 1}-${Date.now()}`,
          nameAr: name,
        }));
    }

    try {
      setIsSavingGrade(true);
      const res = await fetch(`/api/center/${tenant.slug}/master-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'saveGrade',
          grade: {
            id: editingGrade?.id,
            stageId: gradeFormData.stageId,
            nameAr: gradeFormData.nameAr.trim(),
            order: Number(gradeFormData.order) || 1,
            hasDivisions: gradeFormData.hasDivisions,
            divisions: parsedDivisions,
          },
        }),
      });

      const result = await res.json();
      if (result.success) {
        showToast('success', editingGrade ? 'تم تعديل الصف الدراسي بنجاح' : 'تم إضافة الصف الدراسي بنجاح');
        setIsGradeModalOpen(false);
        await loadMasterData();
      } else {
        setGradeFormError(result.error || 'تعذر حفظ الصف الدراسي');
      }
    } catch {
      setGradeFormError('خطأ أثناء إرسال البيانات إلى الخادم');
    } finally {
      setIsSavingGrade(false);
    }
  };

  // Execute Delete
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');

    try {
      setIsDeleting(true);
      const isStage = deleteTarget.type === 'stage';
      const res = await fetch(`/api/center/${tenant.slug}/master-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isStage
            ? { action: 'deleteStage', stageId: deleteTarget.id }
            : { action: 'deleteGrade', gradeId: deleteTarget.id }
        ),
      });

      const result = await res.json();
      if (result.success) {
        showToast('success', isStage ? 'تم حذف المرحلة التعليمية بنجاح' : 'تم حذف الصف الدراسي بنجاح');
        setDeleteTarget(null);
        await loadMasterData();
      } else {
        setDeleteError(result.error || 'تعذر الحذف');
      }
    } catch {
      setDeleteError('خطأ في الاتصال أثناء تنفيذ الحذف');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
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

      {/* Header & Stats Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 flex items-center justify-center text-brand-cyan-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">قائمة المراحل والصفوف التعليمية</h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                البيانات الأساسية للمراحل التعليمية والصفوف والشعب المعتمدة في سنتر {tenant.nameAr}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Button
            variant="outline"
            onClick={() => handleOpenGradeModal()}
            className="gap-2 border-border text-foreground hover:bg-muted"
          >
            <Plus className="w-4 h-4 text-brand-cyan-500" />
            <span>إضافة صف دراسي</span>
          </Button>
          <Button
            onClick={() => handleOpenStageModal()}
            className="gap-2 bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مرحلة تعليمية</span>
          </Button>
        </div>
      </div>

      {/* Quick Stats & Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-card/70 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">المراحل التعليمية</p>
              <p className="text-2xl font-black text-foreground mt-1">{stages.length}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Layers className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">الصفوف الدراسية</p>
              <p className="text-2xl font-black text-brand-cyan-500 mt-1">{totalGradesCount}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 flex items-center justify-center text-brand-cyan-400">
              <BookOpen className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/70 border-border">
          <CardContent className="p-4 flex items-center">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ابحث عن مرحلة أو صف دراسي..."
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
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-3 border-brand-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">جارٍ تحميل البيانات الأساسية...</p>
        </div>
      ) : filteredStages.length === 0 ? (
        <Card className="border-border text-center py-16">
          <CardContent className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <GraduationCap className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">لا توجد مراحل تعليمية مطابقة</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              لم يتم العثور على أي مرحلة أو صف دراسي. يمكنك إضافة مرحلة تعليمية جديدة لبدء ربط الطلاب والمعلمين.
            </p>
            <Button
              onClick={() => handleOpenStageModal()}
              className="mt-4 gap-2 bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة مرحلة تعليمية</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {filteredStages.map((stage) => (
            <Card key={stage.id} className="border-border shadow-soft-sm overflow-hidden bg-card/60">
              {/* Stage Card Header */}
              <CardHeader className="bg-muted/40 border-b border-border py-3.5 px-4 sm:px-6 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-cyan-500/10 border border-brand-cyan-500/30 flex items-center justify-center text-brand-cyan-400 font-bold text-xs">
                    {stage.order || 1}
                  </div>
                  <div>
                    <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                      <span>{stage.nameAr}</span>
                      <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground font-normal">
                        معرف: {stage.id}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      يحتوي على {stage.grades?.length || 0} صفوف دراسية
                    </p>
                  </div>
                </div>

                {/* Stage Controls */}
                <div className="flex items-center gap-1 sm:gap-2 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenGradeModal(stage.id)}
                    className="h-8 gap-1 text-xs text-brand-cyan-600 dark:text-brand-cyan-400 hover:bg-brand-cyan-500/10"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">إضافة صف</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenStageModal(stage)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                    title="تعديل المرحلة"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setDeleteTarget({
                        type: 'stage',
                        id: stage.id,
                        nameAr: stage.nameAr,
                      })
                    }
                    className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10"
                    title="حذف المرحلة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardHeader>

              {/* Grades Table / List */}
              <CardContent className="p-0">
                {!stage.grades || stage.grades.length === 0 ? (
                  <div className="p-6 text-center text-xs text-muted-foreground">
                    لا توجد صفوف دراسية مسجلة في هذه المرحلة بعد.{' '}
                    <button
                      onClick={() => handleOpenGradeModal(stage.id)}
                      className="text-brand-cyan-500 hover:underline font-bold mr-1"
                    >
                      أضف أول صف الآن
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {stage.grades.map((grade) => (
                      <div
                        key={grade.id}
                        className="p-3 sm:p-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-muted flex items-center justify-center text-xs text-muted-foreground font-semibold">
                            {grade.order || 1}
                          </span>
                          <div>
                            <p className="text-sm font-bold text-foreground flex items-center gap-2">
                              <span>{grade.nameAr}</span>
                              <span className="text-[10px] text-muted-foreground font-mono">({grade.id})</span>
                            </p>
                            {/* Divisions Tags */}
                            {grade.hasDivisions && grade.divisions && grade.divisions.length > 0 && (
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className="text-[11px] text-muted-foreground">الشُعب المتاحة:</span>
                                {grade.divisions.map((div) => (
                                  <Badge
                                    key={div.id}
                                    variant="outline"
                                    className="text-[10px] bg-brand-cyan-500/10 text-brand-cyan-400 border-brand-cyan-500/30"
                                  >
                                    {div.nameAr}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Grade Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenGradeModal(stage.id, grade)}
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                            title="تعديل الصف"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({
                                type: 'grade',
                                id: grade.id,
                                nameAr: grade.nameAr,
                                stageId: stage.id,
                              })
                            }
                            className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-500/10"
                            title="حذف الصف"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL 1: Add/Edit Stage */}
      {isStageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-soft-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingStage ? 'تعديل المرحلة التعليمية' : 'إضافة مرحلة تعليمية جديدة'}
              </h3>
              <button
                onClick={() => setIsStageModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveStage} className="p-5 space-y-4">
              {stageFormError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{stageFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  اسم المرحلة التعليمية <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={stageFormData.nameAr}
                  onChange={(e) => setStageFormData({ ...stageFormData, nameAr: e.target.value })}
                  placeholder="مثال: المرحلة الثانوية"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  الترتيب في القائمة
                </label>
                <input
                  type="number"
                  min="1"
                  value={stageFormData.order}
                  onChange={(e) => setStageFormData({ ...stageFormData, order: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              {editingStage && (
                <div className="p-2.5 rounded-lg bg-muted text-muted-foreground text-[11px]">
                  ملاحظة: معرّف المرحلة (<span className="font-mono">{editingStage.id}</span>) سيظل ثابتًا للحفاظ على ارتباط البيانات التاريخية.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStageModalOpen(false)}
                  disabled={isSavingStage}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingStage}
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
                >
                  {isSavingStage ? 'جارٍ الحفظ...' : 'حفظ المرحلة'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Add/Edit Grade */}
      {isGradeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-soft-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingGrade ? 'تعديل الصف الدراسي' : 'إضافة صف دراسي جديد'}
              </h3>
              <button
                onClick={() => setIsGradeModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-5 space-y-4">
              {gradeFormError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{gradeFormError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  المرحلة التعليمية التابعة <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={gradeFormData.stageId}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, stageId: e.target.value })}
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

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  اسم الصف الدراسي <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={gradeFormData.nameAr}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, nameAr: e.target.value })}
                  placeholder="مثال: الصف الأول الثانوي"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  الترتيب في المرحلة
                </label>
                <input
                  type="number"
                  min="1"
                  value={gradeFormData.order}
                  onChange={(e) => setGradeFormData({ ...gradeFormData, order: Number(e.target.value) || 1 })}
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              {/* Divisions Toggle */}
              <div className="p-3 rounded-xl bg-muted/40 border border-border space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={gradeFormData.hasDivisions}
                    onChange={(e) => setGradeFormData({ ...gradeFormData, hasDivisions: e.target.checked })}
                    className="w-4 h-4 rounded text-brand-cyan-600 focus:ring-brand-cyan-500"
                  />
                  <span className="text-xs font-bold text-foreground">
                    هل يحتوي هذا الصف على شُعب دراسية (مثل: علمي / أدبي)؟
                  </span>
                </label>

                {gradeFormData.hasDivisions && (
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      أسماء الشُعب (افصل بينها بفاصلة أو كوما):
                    </label>
                    <input
                      type="text"
                      value={gradeFormData.divisionsText}
                      onChange={(e) => setGradeFormData({ ...gradeFormData, divisionsText: e.target.value })}
                      placeholder="مثال: علمي، أدبي أو علمي علوم، علمي رياضة، أدبي"
                      className="w-full px-3 py-2 text-xs sm:text-sm rounded-lg bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                    />
                  </div>
                )}
              </div>

              {editingGrade && (
                <div className="p-2.5 rounded-lg bg-muted text-muted-foreground text-[11px]">
                  ملاحظة: معرّف الصف (<span className="font-mono">{editingGrade.id}</span>) سيظل ثابتًا للحفاظ على صحة عقود المعلمين وتسجيلات الطلاب.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsGradeModalOpen(false)}
                  disabled={isSavingGrade}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingGrade}
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
                >
                  {isSavingGrade ? 'جارٍ الحفظ...' : 'حفظ الصف'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-soft-2xl overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">
                تأكيد الحذف
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من رغبتك في حذف{' '}
              <strong className="text-foreground">{deleteTarget.nameAr}</strong>؟
              {deleteTarget.type === 'stage'
                ? ' سيتم منع الحذف تلقائيًا إذا كانت هناك مواد أو صفوف أو طلاب مرتبطين بهذه المرحلة.'
                : ' سيتم منع الحذف إذا كانت هناك مواد دراسية أو طلاب مسجلين بهذا الصف.'}
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs">
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
