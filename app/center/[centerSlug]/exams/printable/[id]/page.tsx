import React from 'react';
import { notFound } from 'next/navigation';
import { getDataProvider } from '@/lib/dal/factory';
import { PrintableExamSheet, PrintableExamQuestion } from '@/components/exams/printable-exam-sheet';

export default async function PrintableExamPage({
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

  const teacher = await dal.getUserById(exam.teacherId);
  const teacherName = teacher?.fullName || 'د. هاني نبيل (معلم فيزياء)';

  const printableQuestions: PrintableExamQuestion[] = questions.map((q) => ({
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
    <PrintableExamSheet
      centerSlug={params.centerSlug}
      centerName={tenant.nameAr}
      examTitle={exam.title}
      subject={exam.subjectNameAr || 'الفيزياء الكهربية والحديثة'}
      grade={exam.grade || 'الصف الثالث الثانوي (الثانوية العامة)'}
      teacherName={teacherName}
      teacherTitle="خبير المادة ومستشار إعداد الامتحانات"
      durationMinutes={exam.durationMinutes}
      totalMarks={exam.totalMarks}
      instructions={exam.instructions}
      questions={printableQuestions}
    />
  );
}
