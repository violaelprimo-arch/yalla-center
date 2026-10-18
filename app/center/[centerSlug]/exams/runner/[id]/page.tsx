import React from 'react';
import { notFound } from 'next/navigation';
import { getDataProvider } from '@/lib/dal/factory';
import { StudentExamRunner, ExamRunnerQuestion } from '@/components/exams/student-exam-runner';

export default async function ExamRunnerByIdPage({
  params,
}: {
  params: { centerSlug: string; id: string };
}) {
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(params.centerSlug);
  if (!tenant) return notFound();

  const data = await dal.getExamById(params.id);
  if (!data) return notFound();

  const { exam, questions } = data;

  const runnerQuestions: ExamRunnerQuestion[] = questions.map((q) => ({
    id: q.id,
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    katexFormula: q.katexFormula,
    questionType: q.questionType,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    marks: q.marks,
  }));

  return (
    <StudentExamRunner
      centerSlug={params.centerSlug}
      examId={exam.id}
      studentId="user-student-1001"
      studentName="أحمد محمد السيد (طالب تجريبي)"
      title={exam.title}
      subject={exam.subjectNameAr || 'الفيزياء الكهربية والحديثة'}
      grade={exam.grade || 'الصف الثالث الثانوي'}
      durationMinutes={exam.durationMinutes}
      totalMarks={exam.totalMarks}
      passMarks={exam.passMarks}
      instructions={exam.instructions}
      questions={runnerQuestions}
    />
  );
}
