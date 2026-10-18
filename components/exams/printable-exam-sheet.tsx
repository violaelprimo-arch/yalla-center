'use client';

import React, { useState } from 'react';
import { MathView } from '@/components/ui/math-view';
import { Printer, Columns, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export interface PrintableExamQuestion {
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

export interface PrintableExamProps {
  centerSlug: string;
  centerName?: string;
  examTitle: string;
  subject: string;
  grade: string;
  teacherName: string;
  teacherTitle?: string;
  durationMinutes: number;
  totalMarks: number;
  instructions?: string;
  questions: PrintableExamQuestion[];
}

export function PrintableExamSheet({
  centerSlug,
  centerName = 'سنتر الماهر النموذجي',
  examTitle,
  subject,
  grade,
  teacherName,
  teacherTitle = 'خبير المادة التعليمية',
  durationMinutes,
  totalMarks,
  instructions = 'أجب عن جميع الأسئلة التالية بدقة مع كتابة خطوات الحل.',
  questions,
}: PrintableExamProps) {
  const [twoColumn, setTwoColumn] = useState(false);
  const [includeAnswerKey, setIncludeAnswerKey] = useState(true);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 py-6 px-4">
      {/* Floating Control Toolbar (Hidden when printing) */}
      <div className="no-print max-w-[210mm] mx-auto mb-6 p-4 bg-card border border-border rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/center/${centerSlug}/exams`}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg border border-border bg-background"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>العودة للأستوديو</span>
          </Link>
          <div className="h-4 w-px bg-border" />
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-500" />
            <span>معاينة ورقة الامتحان A4 الرسمية</span>
          </h2>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={twoColumn}
              onChange={(e) => setTwoColumn(e.target.checked)}
              className="rounded border-border text-cyan-500 focus:ring-cyan-500"
            />
            <Columns className="w-3.5 h-3.5" />
            <span>تنسيق عمودين (توفير ورق)</span>
          </label>

          <label className="flex items-center gap-1.5 cursor-pointer font-medium">
            <input
              type="checkbox"
              checked={includeAnswerKey}
              onChange={(e) => setIncludeAnswerKey(e.target.checked)}
              className="rounded border-border text-cyan-500 focus:ring-cyan-500"
            />
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>تضمين نموذج الإجابة</span>
          </label>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold px-4 py-2 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة الورقة (Ctrl+P)</span>
          </button>
        </div>
      </div>

      {/* Official A4 Canvas Sheet */}
      <div
        id="printable-a4-sheet"
        className="a4-page font-cairo shadow-2xl mx-auto bg-white text-black"
        dir="rtl"
        style={{
          width: '210mm',
          minHeight: '297mm',
          padding: '15mm',
          margin: '0 auto',
          background: '#ffffff',
          color: '#000000',
        }}
      >
        {/* Exam Header (Quad Architecture) */}
        <header
          id="exam-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '2px solid #000000',
            paddingBottom: '8mm',
            marginBottom: '6mm',
          }}
        >
          {/* Top-Left: Official Yalla Center Logo */}
          <div id="exam-header-logo" style={{ textAlign: 'left', order: 1 }}>
            <img
              src="/brand/yalla-center-logo-light.png"
              alt="Yalla Center Logo"
              style={{ height: '48px', objectFit: 'contain' }}
            />
            <div style={{ fontSize: '9pt', color: '#555555', marginTop: '1mm' }}>
              {centerName}
            </div>
          </div>

          {/* Header Center: Academic Meta */}
          <div id="exam-header-meta" style={{ textAlign: 'center', order: 2, flex: 1 }}>
            <h1 style={{ fontSize: '16pt', fontWeight: 'bold', margin: 0 }}>{examTitle}</h1>
            <p style={{ fontSize: '11pt', margin: '2mm 0 0 0' }}>
              {subject} — {grade}
            </p>
            <div style={{ fontSize: '9pt', color: '#444444', marginTop: '1.5mm' }}>
              الزمن: {durationMinutes} دقيقة | الدرجة الكلية: {totalMarks} درجة
            </div>
          </div>

          {/* Top-Right: Teacher Name & Academic Title */}
          <div id="exam-header-teacher" style={{ textAlign: 'right', order: 3 }}>
            <h2 style={{ fontSize: '13pt', fontWeight: 'bold', margin: 0 }}>{teacherName}</h2>
            <p style={{ fontSize: '10pt', color: '#444444', margin: '1mm 0 0 0' }}>
              {teacherTitle}
            </p>
          </div>
        </header>

        {/* Student Identification & Seat Box */}
        <section
          id="student-info-box"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr) 80px',
            gap: '4mm',
            border: '1px solid #000000',
            padding: '4mm',
            marginBottom: '8mm',
            fontSize: '10pt',
          }}
        >
          <div className="field-student-name">
            <strong>اسم الطالب:</strong> <span className="input-line">................................................</span>
          </div>
          <div className="field-student-code">
            <strong>كود الطالب:</strong> <span className="input-line">.......................</span>
          </div>
          <div className="field-group">
            <strong>المجموعة:</strong> <span className="input-line">.......................</span>
          </div>
          <div className="field-date">
            <strong>التاريخ:</strong> <span className="input-line">.......................</span>
          </div>
          <div
            className="field-score"
            style={{
              border: '1px solid #000',
              textAlign: 'center',
              padding: '2mm',
            }}
          >
            <strong>الدرجة</strong>
            <br />
            &nbsp;/ {totalMarks}
          </div>
        </section>

        {instructions && (
          <div
            style={{
              fontSize: '9.5pt',
              background: '#f8f9fa',
              border: '1px dashed #666666',
              padding: '2mm 4mm',
              marginBottom: '6mm',
            }}
          >
            <strong>تعليمات الاختبار:</strong> {instructions}
          </div>
        )}

        {/* Questions Body */}
        <main
          id="exam-questions-body"
          style={
            twoColumn
              ? {
                  columnCount: 2,
                  columnGap: '8mm',
                  columnRule: '1px dashed #d1d5db',
                }
              : {}
          }
        >
          {questions.map((q, idx) => (
            <article
              key={q.id}
              className="question-item"
              id={`q-${q.id}`}
              style={{
                marginBottom: '6mm',
                breakInside: 'avoid',
                pageBreakInside: 'avoid',
              }}
            >
              <div className="question-header" style={{ display: 'flex', gap: '2mm' }}>
                <span className="q-number" style={{ fontWeight: 'bold' }}>
                  ({idx + 1})
                </span>
                <span className="q-text" style={{ flex: 1, lineHeight: 1.5 }}>
                  {q.questionText}
                </span>
                <span
                  style={{
                    fontSize: '9pt',
                    color: '#666666',
                    whiteSpace: 'nowrap',
                  }}
                >
                  [{q.marks} درجات]
                </span>
              </div>

              {q.katexFormula && (
                <div
                  className="katex-container"
                  dir="ltr"
                  style={{ display: 'block', margin: '2mm 0', textAlign: 'center' }}
                >
                  <MathView math={q.katexFormula} display={true} />
                </div>
              )}

              {/* MCQ Options Rendering */}
              {q.questionType === 'mcq' && q.options && q.options.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '2mm 4mm',
                    marginTop: '2mm',
                    marginRight: '6mm',
                    fontSize: '10pt',
                  }}
                >
                  {q.options.map((opt, optIdx) => {
                    const letters = ['(أ)', '(ب)', '(ج)', '(د)'];
                    return (
                      <div
                        key={optIdx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2mm',
                        }}
                      >
                        <span style={{ fontWeight: 'bold', color: '#333' }}>
                          {letters[optIdx] || `(${optIdx + 1})`}
                        </span>
                        <span>{opt}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Essay Space */}
              {q.questionType === 'essay' && (
                <div
                  style={{
                    marginTop: '3mm',
                    marginRight: '6mm',
                    border: '1px dashed #aaaaaa',
                    height: '24mm',
                    borderRadius: '2mm',
                    padding: '2mm',
                    color: '#888888',
                    fontSize: '9pt',
                  }}
                >
                  مكان إجابة الطالب وخطوات الحل:
                </div>
              )}
            </article>
          ))}
        </main>

        {/* Separate Answer Key Sheet */}
        {includeAnswerKey && (
          <div
            id="printable-answer-key"
            style={{
              breakBefore: 'page',
              pageBreakBefore: 'always',
              marginTop: '15mm',
              paddingTop: '8mm',
              borderTop: '2px solid #000000',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '6mm' }}>
              <h2 style={{ fontSize: '15pt', fontWeight: 'bold', margin: 0 }}>
                يلا سنتر — نموذج الإجابة الرسمي وتوزيع الدرجات والمعايير
              </h2>
              <p style={{ fontSize: '10pt', color: '#555555', marginTop: '1.5mm' }}>
                امتحان: {examTitle} | المادة: {subject} | المعلم: {teacherName} | الدرجة الكلية:{' '}
                {totalMarks} درجة
              </p>
            </div>

            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '9.5pt',
              }}
            >
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #000' }}>
                  <th style={{ border: '1px solid #ccc', padding: '2mm', width: '35px' }}>#</th>
                  <th style={{ border: '1px solid #ccc', padding: '2mm', width: '80px' }}>النوع</th>
                  <th style={{ border: '1px solid #ccc', padding: '2mm' }}>الإجابة النموذجية</th>
                  <th style={{ border: '1px solid #ccc', padding: '2mm' }}>
                    خطوات الحل والتعليل العلمي
                  </th>
                  <th style={{ border: '1px solid #ccc', padding: '2mm', width: '60px' }}>
                    الدرجة
                  </th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q, idx) => (
                  <tr key={q.id} style={{ borderBottom: '1px solid #ddd' }}>
                    <td style={{ border: '1px solid #ccc', padding: '2mm', textAlign: 'center' }}>
                      {idx + 1}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '2mm', textAlign: 'center' }}>
                      {q.questionType === 'mcq'
                        ? 'اختيار من متعدد'
                        : q.questionType === 'true_false'
                        ? 'صواب وخطأ'
                        : 'مقالي وحل مسائل'}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '2mm', fontWeight: 'bold' }}>
                      {q.correctAnswer}
                    </td>
                    <td style={{ border: '1px solid #ccc', padding: '2mm' }}>
                      {q.explanation || 'مطابق لمنهج الوزارة.'}
                      {q.katexFormula && (
                        <div dir="ltr" style={{ marginTop: '1mm', textAlign: 'start' }}>
                          <MathView math={q.katexFormula} display={false} />
                        </div>
                      )}
                    </td>
                    <td
                      style={{
                        border: '1px solid #ccc',
                        padding: '2mm',
                        textAlign: 'center',
                        fontWeight: 'bold',
                      }}
                    >
                      {q.marks}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
