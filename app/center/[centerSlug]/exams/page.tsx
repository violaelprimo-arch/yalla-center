'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Sparkles,
  Printer,
  Play,
  Edit3,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Trash2,
  ArrowUp,
  ArrowDown,
  X,
  BookOpen,
  Send,
  Eye,
  ChevronRight,
  HelpCircle,
  Award,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { MathView } from '@/components/ui/math-view';
import { Exam, ExamQuestion, ExamStatus } from '@/lib/dal/types';
import { countArabicWords, MIN_EXAM_WORD_COUNT } from '@/lib/materials/indexer';
import { useCenterMaterials } from '@/lib/materials/client';
import Link from 'next/link';

export default function ExamsPage({ params }: { params: { centerSlug: string } }) {
  const { tenant, masterData } = useTenant();
  const { materials, error: materialsError } = useCenterMaterials(tenant, masterData.auth);
  const centerSlug = params?.centerSlug || tenant?.slug || 'al-maher';

  // Exams & Materials State
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | ExamStatus>('all');

  // Generation Modal State
  const [showGenModal, setShowGenModal] = useState(false);
  const [genTitle, setGenTitle] = useState('اختبار دوري - قوانين كيرشوف وقانون أوم');
  const [genSubject, setGenSubject] = useState('الفيزياء');
  const [genGrade, setGenGrade] = useState('الصف الثالث الثانوي');
  const [genDuration, setGenDuration] = useState(30);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<string[]>(['mat-kirchhoff-complete']);
  const [customSourceText, setCustomSourceText] = useState('');
  const [mcqCount, setMcqCount] = useState(3);
  const [shortAnswerCount, setShortAnswerCount] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Teacher Review Studio State
  const [selectedExamForReview, setSelectedExamForReview] = useState<Exam | null>(null);
  const [reviewQuestions, setReviewQuestions] = useState<ExamQuestion[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // Fetch Exams and Materials
  const fetchExams = async () => {
    try {
      setLoading(true);
      const examsRes = await fetch(`/api/center/${centerSlug}/exams`);

      if (examsRes.ok) {
        const examsData = await examsRes.json();
        setExams(examsData.exams || []);
      }
    } catch {
      // offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSlug]);

  // Word count calculation for preflight gauge
  const selectedMaterials = useMemo(() => materials.filter(item => selectedMaterialIds.includes(item.id)), [materials, selectedMaterialIds]);
  const selectedDocsWords = useMemo(() => {
    return selectedMaterials.reduce((count, item) => count + (item.wordCount || 0), countArabicWords(customSourceText));
  }, [selectedMaterials, customSourceText]);

  const isPreflightSatisfied = selectedDocsWords >= MIN_EXAM_WORD_COUNT;
  const wordCountPercentage = Math.min(
    100,
    Math.round((selectedDocsWords / MIN_EXAM_WORD_COUNT) * 100)
  );

  // Filtered Exams
  const filteredExams = useMemo(() => {
    return exams.filter((e) => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      return true;
    });
  }, [exams, statusFilter]);

  // Handle AI Exam Generation Submit
  const handleGenerateAiExam = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenError('');

    if (selectedMaterials.some(item => item.indexStatus !== 'indexed')) {
      setGenError('اختر مذكرات مفهرسة قبل توليد الامتحان');
      return;
    }

    if (selectedDocsWords < MIN_EXAM_WORD_COUNT) {
      setGenError(
        `نص المصدر قصير جداً (${selectedDocsWords} كلمة). الحد الأدنى المطلوب هو ${MIN_EXAM_WORD_COUNT} كلمة لمنع الهلوسة وتأصيل الامتحان (AC-8).`
      );
      return;
    }

    setIsGenerating(true);
    try {
      const idToken = masterData.auth.idToken;
      const sourceDocumentIds = selectedMaterials.map(material => material.id);
      const res = await fetch(`/api/center/${centerSlug}/exams/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}) },
        body: JSON.stringify({
          title: genTitle.trim(),
          subject: genSubject,
          grade: genGrade,
          durationMinutes: Number(genDuration),
          sourceDocumentIds: masterData.demo ? undefined : sourceDocumentIds,
          sourceText: (masterData.demo ? [...selectedMaterials.map(material => material.textContentIndexed), customSourceText] : [customSourceText])
            .filter(Boolean).join('\n\n').trim() || undefined,
          questionCounts: {
            mcq: Number(mcqCount),
            shortAnswer: Number(shortAnswerCount),
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'فشل توليد الامتحان');
      }

      // Add to exams list and open review studio
      setExams((prev) => [data.exam, ...prev]);
      setShowGenModal(false);
      openReviewStudio(data.exam.id);
    } catch (err: any) {
      setGenError(err.message || 'حدث خطأ أثناء الاتصال بمحرك التوليد');
    } finally {
      setIsGenerating(false);
    }
  };

  // Open Teacher Review Studio
  const openReviewStudio = async (examId: string) => {
    try {
      setReviewLoading(true);
      setReviewMessage('');
      const res = await fetch(`/api/center/${centerSlug}/exams/${examId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedExamForReview(data.exam);
        setReviewQuestions(data.questions || []);
      }
    } catch {
      // offline
    } finally {
      setReviewLoading(false);
    }
  };

  // Update question field in review studio
  const handleQuestionChange = (
    qIndex: number,
    field: keyof ExamQuestion,
    value: any
  ) => {
    setReviewQuestions((prev) => {
      const copy = [...prev];
      copy[qIndex] = { ...copy[qIndex], [field]: value };
      return copy;
    });
  };

  // Reorder question Up / Down
  const handleMoveQuestion = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= reviewQuestions.length) return;

    setReviewQuestions((prev) => {
      const copy = [...prev];
      const temp = copy[index];
      copy[index] = copy[targetIndex];
      copy[targetIndex] = temp;
      // Re-index sequential numbers
      return copy.map((q, idx) => ({
        ...q,
        questionNumber: idx + 1,
        orderIndex: idx + 1,
      }));
    });
  };

  // Delete question
  const handleDeleteQuestion = (index: number) => {
    setReviewQuestions((prev) =>
      prev
        .filter((_, idx) => idx !== index)
        .map((q, idx) => ({ ...q, questionNumber: idx + 1, orderIndex: idx + 1 }))
    );
  };

  // Save changes from review studio
  const handleSaveReviewChanges = async () => {
    if (!selectedExamForReview) return;
    setReviewSaving(true);
    setReviewMessage('');

    try {
      const totalMarks = reviewQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0);
      const passMarks = Math.round(totalMarks * 0.5);

      const res = await fetch(`/api/center/${centerSlug}/exams/${selectedExamForReview.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: {
            totalMarks,
            passMarks,
          },
        }),
      });

      if (res.ok) {
        setReviewMessage('تم حفظ التعديلات بنجاح وتمت إعادة حساب الدرجات الكلية.');
        setSelectedExamForReview((prev) => (prev ? { ...prev, totalMarks, passMarks } : null));
        fetchExams();
      }
    } catch {
      setReviewMessage('تعذر الحفظ');
    } finally {
      setReviewSaving(false);
    }
  };

  // Publish Exam from Review Studio
  const handlePublishExam = async (examId: string) => {
    try {
      const res = await fetch(`/api/center/${centerSlug}/exams/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examId }),
      });

      if (res.ok) {
        setExams((prev) =>
          prev.map((e) => (e.id === examId ? { ...e, status: 'published' } : e))
        );
        if (selectedExamForReview?.id === examId) {
          setSelectedExamForReview((prev) => (prev ? { ...prev, status: 'published' } : null));
        }
        setReviewMessage('تم نشر الامتحان بنجاح للطلاب!');
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>الرئيسية</span>
            <ChevronRight className="w-3 h-3 rotate-180" />
            <span className="text-cyan-500 font-bold">أستوديو الامتحانات ونماذج A4</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2.5">
            <FileSpreadsheet className="w-7 h-7 text-cyan-500" />
            <span>أستوديو الامتحانات الذكية (AI Exam Studio)</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            توليد الامتحانات المؤصلة وفقاً للمذكرات المفهرسة مع بوابة مراجعة المعلم وطباعة A4 الرسمية.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowGenModal(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4" />
            <span>توليد امتحان بالذكاء الاصطناعي (AI)</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 p-2 bg-card border border-border rounded-2xl">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'all'
                ? 'bg-cyan-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            الكل ({exams.length})
          </button>
          <button
            onClick={() => setStatusFilter('draft')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'draft'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            مسودات قيد المراجعة ({exams.filter((e) => e.status === 'draft').length})
          </button>
          <button
            onClick={() => setStatusFilter('published')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              statusFilter === 'published'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            منشورة للطلاب ({exams.filter((e) => e.status === 'published').length})
          </button>
        </div>
      </div>

      {/* Exams Directory Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredExams.map((exam) => {
          const isDraft = exam.status === 'draft';
          const isPublished = exam.status === 'published';

          return (
            <div
              key={exam.id}
              className="bg-card border border-border hover:border-cyan-500/50 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  {exam.isAiGenerated && (
                    <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> مؤصل بالذكاء الاصطناعي
                    </span>
                  )}

                  {isDraft ? (
                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Clock className="w-3 h-3" /> مسودة (بانتظار المعلم)
                    </span>
                  ) : isPublished ? (
                    <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> منشور رسمياً
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      مؤرشف
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-bold text-foreground leading-snug line-clamp-1">
                    {exam.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    الزمن: {exam.durationMinutes} دقيقة | الدرجة الكلية: {exam.totalMarks} درجة | درجة النجاح: {exam.passMarks}
                  </p>
                </div>

                {exam.instructions && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2 bg-muted/30 p-2.5 rounded-xl border border-border/50">
                    {exam.instructions}
                  </p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {/* Teacher Question Review Studio */}
                  <button
                    onClick={() => openReviewStudio(exam.id)}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-xs text-foreground flex items-center gap-1 transition-colors"
                    title="مراجعة وتعديل الأسئلة والدرجات"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-cyan-500" />
                    <span>المراجعة</span>
                  </button>

                  {/* Printable A4 Link */}
                  <Link
                    href={`/center/${centerSlug}/exams/printable/${exam.id}`}
                    className="p-1.5 rounded-lg border border-border hover:bg-muted text-xs text-foreground flex items-center gap-1 transition-colors"
                    title="طباعة نموذج A4 مع نموذج الإجابة"
                  >
                    <Printer className="w-3.5 h-3.5 text-blue-500" />
                    <span>طباعة A4</span>
                  </Link>
                </div>

                <div className="flex items-center gap-1.5">
                  {isDraft ? (
                    <button
                      onClick={() => handlePublishExam(exam.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                    >
                      <Send className="w-3 h-3" />
                      <span>نشر</span>
                    </button>
                  ) : (
                    <Link
                      href={`/center/${centerSlug}/exams/${exam.id}/run`}
                      className="px-3 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition-all"
                    >
                      <Play className="w-3 h-3" />
                      <span>اختبار</span>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal 1: AI Exam Generator with Strict Preflight Gate */}
      {showGenModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-cyan-500" />
                <span>توليد امتحان تربوي مؤصل بالذكاء الاصطناعي</span>
              </h3>
              <button
                onClick={() => setShowGenModal(false)}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateAiExam} className="p-6 overflow-y-auto space-y-4 text-xs">
              {genError && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs leading-relaxed flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              {/* Title & Subject */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">عنوان الامتحان *:</label>
                  <input
                    type="text"
                    required
                    value={genTitle}
                    onChange={(e) => setGenTitle(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">المادة الدراسية:</label>
                  <input
                    type="text"
                    value={genSubject}
                    onChange={(e) => setGenSubject(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              {/* Duration and Grade */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">الصف الدراسي:</label>
                  <input
                    type="text"
                    value={genGrade}
                    onChange={(e) => setGenGrade(e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">الزمن (بالدقائق):</label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={genDuration}
                    onChange={(e) => setGenDuration(Number(e.target.value))}
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              {/* Question Counts */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-muted/30 rounded-2xl border border-border">
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    عدد أسئلة الاختيار من متعدد (MCQ):
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={mcqCount}
                    onChange={(e) => setMcqCount(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-border bg-background text-foreground font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">
                    عدد أسئلة حل المسائل والمقال:
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={10}
                    value={shortAnswerCount}
                    onChange={(e) => setShortAnswerCount(Number(e.target.value))}
                    className="w-full p-2 rounded-xl border border-border bg-background text-foreground font-bold"
                  />
                </div>
              </div>

              {/* Source Materials Selection */}
              <div>
                <label className="font-bold text-foreground block mb-1.5">
                  اختر المذكرات المصدرية المعتمدة (تأصيل 100%):
                </label>
                {materialsError && <p role="alert" className="text-xs text-rose-600">{materialsError}</p>}
                <div className="max-h-36 overflow-y-auto space-y-1.5 p-3 rounded-2xl bg-background border border-border">
                  {materials.map((m) => {
                    const isSelected = selectedMaterialIds.includes(m.id);
                    return (
                      <label
                        key={m.id}
                        className={`flex items-center justify-between p-2 rounded-xl border cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-300 font-bold'
                            : 'bg-card border-border text-foreground hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedMaterialIds((prev) => [...prev, m.id]);
                              } else {
                                setSelectedMaterialIds((prev) => prev.filter((id) => id !== m.id));
                              }
                            }}
                            className="rounded border-border text-cyan-500 focus:ring-cyan-500"
                          />
                          <span>{m.title}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {m.wordCount} كلمة | {m.indexStatus === 'indexed' ? 'مفهرس' : 'غير مفهرس'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Real-time Preflight Word Meter Gauge */}
              <div className="p-4 rounded-2xl bg-card border border-border space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5">
                    {isPreflightSatisfied ? (
                      <span className="text-emerald-500 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" /> جاهز للتوليد التربوي (AC-8)
                      </span>
                    ) : (
                      <span className="text-amber-500 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4" /> النص المصدري غير كافٍ
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-foreground">
                    {selectedDocsWords} / {MIN_EXAM_WORD_COUNT} كلمة
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isPreflightSatisfied ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${wordCountPercentage}%` }}
                  />
                </div>

                {!isPreflightSatisfied && (
                  <p className="text-[11px] text-red-500 leading-tight">
                    يتطلب النظام 200 كلمة على الأقل لمنع الهلوسة وتأصيل الأسئلة حصرياً في المنهج المصري.
                  </p>
                )}
              </div>

              {/* Submit Button */}
              <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGenModal(false)}
                  className="px-4 py-2 rounded-xl border border-border font-bold text-foreground hover:bg-muted"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isGenerating || !isPreflightSatisfied}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold shadow-md transition-all disabled:opacity-40"
                >
                  {isGenerating ? 'جاري الصياغة والتأصيل...' : 'توليد مسودة الامتحان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Teacher Review Studio (Inline Editing & KaTeX Preview) */}
      {selectedExamForReview && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-border flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-cyan-500" />
                  <span>بوابة المعلم لمراجعة وتعديل الامتحان: {selectedExamForReview.title}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  يمكن للمعلم تعديل الأسئلة، الاختيارات، الصيغ الرياضية، الدرجات، وإعادة الترتيب قبل النشر.
                </p>
              </div>
              <button
                onClick={() => setSelectedExamForReview(null)}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Questions List Editor */}
            <div className="p-6 overflow-y-auto space-y-6">
              {reviewMessage && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-500 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{reviewMessage}</span>
                </div>
              )}

              {reviewQuestions.map((q, qIdx) => (
                <div
                  key={q.id}
                  className="p-5 rounded-2xl bg-background border border-border space-y-4 shadow-sm"
                >
                  {/* Top Header of Question Card */}
                  <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-xl bg-cyan-500/10 text-cyan-500 font-bold flex items-center justify-center text-xs">
                        {qIdx + 1}
                      </span>
                      <span className="text-xs font-bold text-foreground">
                        {q.questionType === 'mcq' ? 'اختيار من متعدد' : 'مسألة / مقالي'}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-muted-foreground">الدرجة:</span>
                        <input
                          type="number"
                          min={1}
                          max={50}
                          value={q.marks}
                          onChange={(e) =>
                            handleQuestionChange(qIdx, 'marks', Number(e.target.value))
                          }
                          className="w-14 p-1 rounded-lg border border-border bg-card text-center font-bold text-xs"
                        />
                      </div>

                      {/* Reorder Buttons */}
                      <button
                        type="button"
                        disabled={qIdx === 0}
                        onClick={() => handleMoveQuestion(qIdx, 'up')}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground disabled:opacity-30"
                        title="تحريك لأعلى"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={qIdx === reviewQuestions.length - 1}
                        onClick={() => handleMoveQuestion(qIdx, 'down')}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground disabled:opacity-30"
                        title="تحريك لأسفل"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(qIdx)}
                        className="p-1.5 rounded-lg border border-red-500/20 hover:bg-red-500/10 text-red-500"
                        title="حذف السؤال"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Question Text Textarea */}
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      نص السؤال:
                    </label>
                    <textarea
                      rows={2}
                      value={q.questionText}
                      onChange={(e) => handleQuestionChange(qIdx, 'questionText', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>

                  {/* KaTeX Formula with Instant Preview */}
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      صيغة المعادلة الرياضية KaTeX (اختياري):
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 items-center">
                      <input
                        type="text"
                        dir="ltr"
                        value={q.katexFormula || ''}
                        onChange={(e) =>
                          handleQuestionChange(qIdx, 'katexFormula', e.target.value)
                        }
                        placeholder="\sum I_{in} = \sum I_{out}"
                        className="p-2 rounded-xl border border-border bg-card text-xs font-mono text-start"
                      />
                      <div className="p-2 rounded-xl bg-muted/40 border border-border text-center overflow-x-auto min-h-[38px] flex items-center justify-center">
                        {q.katexFormula ? (
                          <MathView math={q.katexFormula} display={false} />
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">
                            (معاينة فورية)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* MCQ Options */}
                  {q.questionType === 'mcq' && q.options && (
                    <div className="space-y-2 pt-1">
                      <label className="text-[11px] font-bold text-muted-foreground block">
                        الخيارات الأربعة (حدد زر الراديو للإجابة الصحيحة):
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {q.options.map((opt, optIndex) => {
                          const isCorrect = q.correctAnswer === opt;
                          return (
                            <div
                              key={optIndex}
                              className={`flex items-center gap-2 p-2 rounded-xl border ${
                                isCorrect
                                  ? 'border-emerald-500 bg-emerald-500/10'
                                  : 'border-border bg-card'
                              }`}
                            >
                              <input
                                type="radio"
                                name={`correct-${q.id}`}
                                checked={isCorrect}
                                onChange={() => handleQuestionChange(qIdx, 'correctAnswer', opt)}
                                className="text-emerald-500 focus:ring-emerald-500"
                              />
                              <input
                                type="text"
                                value={opt}
                                onChange={(e) => {
                                  const newOpts = [...q.options!];
                                  newOpts[optIndex] = e.target.value;
                                  handleQuestionChange(qIdx, 'options', newOpts);
                                  if (isCorrect) {
                                    handleQuestionChange(qIdx, 'correctAnswer', e.target.value);
                                  }
                                }}
                                className="w-full bg-transparent text-xs text-foreground focus:outline-none font-medium"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Explanation / Grounding Citation */}
                  <div>
                    <label className="text-[11px] font-bold text-muted-foreground block mb-1">
                      التفسير العلمي والتأصيل المصدري:
                    </label>
                    <textarea
                      rows={2}
                      value={q.explanation || ''}
                      onChange={(e) => handleQuestionChange(qIdx, 'explanation', e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-border bg-card text-xs text-foreground leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-border flex items-center justify-between gap-3">
              <div className="text-xs font-bold text-muted-foreground">
                إجمالي الدرجات المحسوبة:{' '}
                <span className="text-foreground text-sm font-black font-mono">
                  {reviewQuestions.reduce((sum, q) => sum + Number(q.marks || 0), 0)} درجة
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveReviewChanges}
                  disabled={reviewSaving}
                  className="px-4 py-2 rounded-xl border border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold text-xs hover:bg-cyan-500/10 transition-colors"
                >
                  {reviewSaving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                </button>

                {selectedExamForReview.status === 'draft' && (
                  <button
                    type="button"
                    onClick={() => handlePublishExam(selectedExamForReview.id)}
                    className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all"
                  >
                    نشر الامتحان للطلاب
                  </button>
                )}

                <Link
                  href={`/center/${centerSlug}/exams/printable/${selectedExamForReview.id}`}
                  className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-bold text-xs flex items-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>معاينة A4</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
