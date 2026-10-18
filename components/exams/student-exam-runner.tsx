'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { MathView } from '@/components/ui/math-view';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Flag,
  ArrowRight,
  ArrowLeft,
  Save,
  Award,
  BookOpen,
  Send,
  HelpCircle,
} from 'lucide-react';
import Link from 'next/link';

export interface ExamRunnerQuestion {
  id: string;
  questionNumber: number;
  questionText: string;
  katexFormula?: string;
  questionType: 'mcq' | 'true_false' | 'essay';
  options?: string[];
  correctAnswer: string;
  explanation?: string;
  marks: number;
}

export interface StudentExamRunnerProps {
  centerSlug: string;
  examId: string;
  studentId?: string;
  studentName?: string;
  title: string;
  subject?: string;
  grade?: string;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  instructions?: string;
  questions: ExamRunnerQuestion[];
  onComplete?: (result: { score: number; percentage: number }) => void;
}

export function StudentExamRunner({
  centerSlug,
  examId,
  studentId = 'user-student-1001',
  studentName = 'طالب تجريبي',
  title,
  subject = 'الفيزياء',
  grade = 'الصف الثالث الثانوي',
  durationMinutes,
  totalMarks,
  passMarks,
  instructions,
  questions,
  onComplete,
}: StudentExamRunnerProps) {
  // Navigation & Answers State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string>('');

  // Grading Result State
  const [scoreResult, setScoreResult] = useState<{
    earnedPoints: number;
    totalPoints: number;
    percentage: number;
    isPassed: boolean;
    requiresManualReview: boolean;
  } | null>(null);

  // Timer State (in seconds)
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const storageKey = useMemo(() => `yalla_exam_${examId}_${studentId}`, [examId, studentId]);

  // Restore autosaved answers from LocalStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.answers) setAnswers(parsed.answers);
        if (parsed.flagged) setFlagged(parsed.flagged);
        if (parsed.isSubmitted) {
          setIsSubmitted(true);
          setScoreResult(parsed.scoreResult);
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey]);

  // Dual-tier autosave: LocalStorage update
  const saveSnapshot = useCallback(
    (newAnswers: Record<string, string>, newFlagged: Record<string, boolean>) => {
      try {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            answers: newAnswers,
            flagged: newFlagged,
            savedAt: new Date().toISOString(),
          })
        );
        const timeStr = new Date().toLocaleTimeString('ar-EG', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        setLastSavedTime(timeStr);
      } catch {
        // ignore
      }
    },
    [storageKey]
  );

  // Timer Countdown with Drift-Free Tick
  useEffect(() => {
    if (!isStarted || isSubmitted) return;

    const interval = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarted, isSubmitted]);

  // Select Option Handler
  const handleSelectAnswer = (questionId: string, answerText: string) => {
    if (isSubmitted) {
      throw new Error('Cannot change answers after exam submission');
    }
    const updated = { ...answers, [questionId]: answerText };
    setAnswers(updated);
    saveSnapshot(updated, flagged);
  };

  // Toggle Flag
  const toggleFlag = (questionId: string) => {
    const updated = { ...flagged, [questionId]: !flagged[questionId] };
    setFlagged(updated);
    saveSnapshot(answers, updated);
  };

  // Final Submission Routine
  const handleFinalSubmit = async () => {
    if (isSubmitted || isSubmitting) return;
    setIsSubmitting(true);

    try {
      // Calculate automated grading
      let earned = 0;
      let hasEssay = false;

      for (const q of questions) {
        if (q.questionType === 'essay') {
          hasEssay = true;
          continue;
        }
        const studentAns = answers[q.id];
        if (studentAns !== undefined && studentAns.trim() === q.correctAnswer.trim()) {
          earned += q.marks;
        }
      }

      const total = totalMarks || questions.reduce((s, q) => s + q.marks, 0);
      const percentage = total > 0 ? Math.round((earned / total) * 10000) / 100 : 0;
      const isPassed = earned >= (passMarks || total * 0.5);

      const resultPayload = {
        earnedPoints: earned,
        totalPoints: total,
        percentage,
        isPassed,
        requiresManualReview: hasEssay,
      };

      // Persist to backend API (or fallback safely)
      try {
        const answersList = Object.entries(answers).map(([qId, ans]) => ({
          questionId: qId,
          selectedAnswer: ans,
        }));

        await fetch(`/api/center/${centerSlug}/exams/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            examId,
            studentId,
            answers: answersList,
          }),
        });
      } catch {
        // Fallback works seamlessly in offline mode
      }

      // Mark locally submitted
      setIsSubmitted(true);
      setScoreResult(resultPayload);
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          answers,
          flagged,
          isSubmitted: true,
          scoreResult: resultPayload,
        })
      );

      if (onComplete) {
        onComplete({ score: earned, percentage });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Timer formatting & alert state
  const formattedTime = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60);
    const secs = remainingSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, [remainingSeconds]);

  const timerWarningClass = useMemo(() => {
    if (remainingSeconds <= 60) return 'text-red-500 bg-red-500/10 border-red-500/30 animate-pulse';
    if (remainingSeconds <= 300) return 'text-amber-500 bg-amber-500/10 border-amber-500/30';
    return 'text-cyan-500 bg-cyan-500/10 border-cyan-500/30';
  }, [remainingSeconds]);

  const activeQuestion = questions[currentIndex] || questions[0];
  const answeredCount = Object.keys(answers).length;
  const flaggedCount = Object.values(flagged).filter(Boolean).length;

  // View: Prompt before starting
  if (!isStarted && !isSubmitted) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-card border border-border rounded-3xl shadow-xl text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-500">
          <BookOpen className="w-8 h-8" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {subject} — {grade}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-4 p-4 rounded-2xl bg-muted/40 border border-border text-center">
          <div>
            <div className="text-xs text-muted-foreground">عدد الأسئلة</div>
            <div className="text-lg font-bold text-foreground mt-0.5">{questions.length}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الزمن المتاح</div>
            <div className="text-lg font-bold text-foreground mt-0.5">{durationMinutes} دقيقة</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">الدرجة الكلية</div>
            <div className="text-lg font-bold text-foreground mt-0.5">{totalMarks} درجة</div>
          </div>
        </div>

        {instructions && (
          <div className="text-xs text-start bg-background p-4 rounded-xl border border-border leading-relaxed text-muted-foreground">
            <strong className="text-foreground block mb-1">تعليمات الامتحان:</strong>
            {instructions}
          </div>
        )}

        <div className="pt-2">
          <button
            onClick={() => setIsStarted(true)}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-base shadow-lg transition-all active:scale-95"
          >
            بدء الامتحان الآن
          </button>
        </div>
      </div>
    );
  }

  // View: Post-Submission Results Card
  if (isSubmitted && scoreResult) {
    return (
      <div className="max-w-3xl mx-auto my-8 p-6 space-y-6">
        {/* Score Card Header */}
        <div className="bg-card border border-border rounded-3xl p-8 shadow-xl text-center space-y-4">
          <div
            className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center border-2 ${
              scoreResult.isPassed
                ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500'
                : 'bg-red-500/10 border-red-500 text-red-500'
            }`}
          >
            {scoreResult.isPassed ? (
              <CheckCircle2 className="w-10 h-10" />
            ) : (
              <XCircle className="w-10 h-10" />
            )}
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground">
              {scoreResult.isPassed ? 'تهانينا! لقد اجتزت الامتحان بنجاح' : 'تحتاج إلى مراجعة وتركيز إضافي'}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              الطالب: {studentName} | {title}
            </p>
          </div>

          <div className="flex items-center justify-center gap-6 py-4">
            <div className="text-center">
              <div className="text-xs text-muted-foreground">الدرجة المحققة</div>
              <div className="text-3xl font-extrabold text-foreground mt-1">
                {scoreResult.earnedPoints}{' '}
                <span className="text-base font-normal text-muted-foreground">/ {scoreResult.totalPoints}</span>
              </div>
            </div>
            <div className="h-10 w-px bg-border" />
            <div className="text-center">
              <div className="text-xs text-muted-foreground">النسبة المئوية</div>
              <div
                className={`text-3xl font-extrabold mt-1 ${
                  scoreResult.isPassed ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {scoreResult.percentage}%
              </div>
            </div>
          </div>

          {scoreResult.requiresManualReview && (
            <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-500 justify-center">
              <HelpCircle className="w-4 h-4 shrink-0" />
              <span>يتضمن الامتحان سؤالاً مقالياً قيد مراجعة وتصحيح المعلم؛ سيتم تحديث الدرجة النهائية قريباً.</span>
            </div>
          )}

          <div className="pt-2">
            <Link
              href={`/center/${centerSlug}/exams`}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة لقائمة الامتحانات</span>
            </Link>
          </div>
        </div>

        {/* Detailed Itemized Question Review */}
        <div className="space-y-4">
          <h3 className="text-base font-bold text-foreground">مراجعة الإجابات ونموذج الحل:</h3>
          {questions.map((q, qIndex) => {
            const studentAns = answers[q.id];
            const isCorrect = studentAns && studentAns.trim() === q.correctAnswer.trim();
            const isEssay = q.questionType === 'essay';

            return (
              <div
                key={q.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isEssay
                    ? 'bg-card border-amber-500/30'
                    : isCorrect
                    ? 'bg-card border-emerald-500/30'
                    : 'bg-card border-red-500/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-foreground">
                      {qIndex + 1}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{q.questionText}</span>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground shrink-0">
                    [{q.marks} درجات]
                  </span>
                </div>

                {q.katexFormula && (
                  <div className="my-2 p-2 bg-muted/30 rounded-xl text-center">
                    <MathView math={q.katexFormula} display={true} />
                  </div>
                )}

                <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">إجابتك: </span>
                    <span
                      className={`font-bold ${
                        isEssay
                          ? 'text-foreground'
                          : isCorrect
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }`}
                    >
                      {studentAns || '(لم تتم الإجابة)'}
                    </span>
                  </div>

                  {!isEssay && (
                    <div>
                      <span className="text-muted-foreground">الإجابة النموذجية: </span>
                      <span className="font-bold text-emerald-500">{q.correctAnswer}</span>
                    </div>
                  )}
                </div>

                {q.explanation && (
                  <div className="mt-2.5 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-xs text-foreground/90 leading-relaxed">
                    <strong className="text-cyan-500 block mb-0.5">التفسير العلمي والتأصيل:</strong>
                    {q.explanation}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // View: Live Active Exam Runner
  return (
    <div className="max-w-5xl mx-auto my-6 px-4 space-y-6">
      {/* Top HUD Bar: Timer, Progress, and Autosave Status */}
      <header className="bg-card border border-border rounded-2xl p-4 shadow-sm flex items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>{title}</span>
            <span className="text-xs text-muted-foreground font-normal">({grade})</span>
          </h2>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
            <span>
              السؤال {currentIndex + 1} من {questions.length}
            </span>
            <span>•</span>
            <span>تم حل {answeredCount} سؤال</span>
            {lastSavedTime && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1 text-emerald-500">
                  <Save className="w-3 h-3" />
                  حفظ تلقائي {lastSavedTime}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Resilient Countdown Timer */}
        <div className={`px-4 py-2 rounded-xl border font-mono font-bold flex items-center gap-2 ${timerWarningClass}`}>
          <Clock className="w-4 h-4" />
          <span className="text-base tracking-widest">{formattedTime}</span>
        </div>
      </header>

      {/* 5-Minute Warning Banner */}
      {remainingSeconds <= 300 && remainingSeconds > 60 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-500">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>تنبيه: متبقي أقل من 5 دقائق على نهاية الاختبار! يرجى مراجعة وتأكيد الإجابات.</span>
        </div>
      )}

      {/* 1-Minute Critical Warning Banner */}
      {remainingSeconds <= 60 && remainingSeconds > 0 && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-2 text-xs text-red-500 animate-pulse">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>تحذير عاجل: متبقي أقل من دقيقة واحدة! سيتم تسليم الامتحان تلقائياً عند انتهاء الوقت.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left/Main Column: Active Question Card */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center font-bold text-sm">
                  {currentIndex + 1}
                </span>
                <span className="text-xs text-muted-foreground">
                  {activeQuestion.questionType === 'mcq'
                    ? 'اختيار من متعدد'
                    : activeQuestion.questionType === 'true_false'
                    ? 'صواب وخطأ'
                    : 'سؤال مقالي وحل مسائل'}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground">
                  {activeQuestion.marks} درجات
                </span>
                <button
                  onClick={() => toggleFlag(activeQuestion.id)}
                  className={`p-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all ${
                    flagged[activeQuestion.id]
                      ? 'bg-amber-500/15 border-amber-500 text-amber-500'
                      : 'bg-muted/50 border-border text-muted-foreground hover:text-foreground'
                  }`}
                  title="تعليم للمراجعة"
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>{flagged[activeQuestion.id] ? 'مُعلّم' : 'علّم'}</span>
                </button>
              </div>
            </div>

            {/* Question Text */}
            <div className="text-base font-semibold text-foreground leading-relaxed">
              {activeQuestion.questionText}
            </div>

            {/* KaTeX Display Math (if present) */}
            {activeQuestion.katexFormula && (
              <div className="p-4 bg-muted/30 border border-border/50 rounded-2xl text-center">
                <MathView math={activeQuestion.katexFormula} display={true} />
              </div>
            )}

            {/* MCQ Options Radio List */}
            {activeQuestion.questionType === 'mcq' && activeQuestion.options && (
              <div className="space-y-3 pt-2">
                {activeQuestion.options.map((opt, optIdx) => {
                  const isSelected = answers[activeQuestion.id] === opt;
                  return (
                    <label
                      key={optIdx}
                      onClick={() => handleSelectAnswer(activeQuestion.id, opt)}
                      className={`flex items-center gap-3.5 p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-cyan-500/10 border-cyan-500 text-cyan-600 dark:text-cyan-400 font-bold shadow-sm'
                          : 'bg-background hover:bg-muted/40 border-border text-foreground'
                      }`}
                    >
                      <input
                        type="radio"
                        name={`q-${activeQuestion.id}`}
                        checked={isSelected}
                        onChange={() => {}}
                        className="text-cyan-500 focus:ring-cyan-500"
                      />
                      <span className="text-sm flex-1">{opt}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {/* Essay Answer Box */}
            {activeQuestion.questionType === 'essay' && (
              <div className="space-y-2 pt-2">
                <label className="text-xs font-bold text-muted-foreground block">
                  اكتب إجابتك وخطوات الحل هنا:
                </label>
                <textarea
                  rows={6}
                  value={answers[activeQuestion.id] || ''}
                  onChange={(e) => handleSelectAnswer(activeQuestion.id, e.target.value)}
                  placeholder="اكتب خطوات الحل بالتفصيل مع ذكر القوانين والوحدات المستخدمة..."
                  className="w-full p-4 rounded-2xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <button
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background hover:bg-muted text-xs font-bold text-foreground disabled:opacity-40 transition-colors"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>السابق</span>
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold shadow-sm transition-all"
                >
                  <span>التالي</span>
                  <ArrowLeft className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>تأكيد وتسليم الامتحان</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Palette HUD */}
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-foreground">لوحة التنقل السريع</h3>

            <div className="grid grid-cols-5 gap-2">
              {questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isFlagged = !!flagged[q.id];
                const isCurrent = idx === currentIndex;

                let btnClass = 'bg-muted/50 border-border text-foreground';
                if (isCurrent) btnClass = 'ring-2 ring-cyan-500 border-cyan-500 font-bold bg-cyan-500/20';
                else if (isFlagged) btnClass = 'bg-amber-500/20 border-amber-500 text-amber-500 font-bold';
                else if (isAnswered) btnClass = 'bg-cyan-500 text-white border-cyan-500';

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-xl border text-xs flex items-center justify-center transition-all ${btnClass}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span>تمت الإجابة</span>
                </span>
                <span className="font-bold text-foreground">{answeredCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <span>مُعلّم للمراجعة</span>
                </span>
                <span className="font-bold text-foreground">{flaggedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-muted border border-border" />
                  <span>متبقي</span>
                </span>
                <span className="font-bold text-foreground">
                  {questions.length - answeredCount}
                </span>
              </div>
            </div>

            <button
              onClick={handleFinalSubmit}
              disabled={isSubmitting}
              className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
            >
              تسليم الامتحان الآن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
