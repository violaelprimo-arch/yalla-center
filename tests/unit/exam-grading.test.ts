import { describe, it, expect } from 'vitest';
import { gradeExamSubmission } from '@/lib/exams/grading';
import { ExamQuestion } from '@/lib/dal/types';

describe('Milestone 5: Deterministic Auto-Grading Engine (FEAT-33)', () => {
  const sampleQuestions: ExamQuestion[] = [
    {
      id: 'q1',
      examId: 'ex-1',
      questionNumber: 1,
      questionText: 'وحدة قياس المقاومة الكهربية؟',
      questionType: 'mcq',
      options: ['فولت', 'أوم', 'أمبير', 'جول'],
      correctAnswer: 'أوم',
      marks: 10,
      orderIndex: 1,
    },
    {
      id: 'q2',
      examId: 'ex-1',
      questionNumber: 2,
      questionText: 'قانون كيرشوف الأول تطبيق لمبدأ حفظ:',
      questionType: 'mcq',
      options: ['الشحنة', 'الطاقة', 'الكتلة', 'السرعة'],
      correctAnswer: 'الشحنة',
      marks: 10,
      orderIndex: 2,
    },
    {
      id: 'q3',
      examId: 'ex-1',
      questionNumber: 3,
      questionText: 'علل: لماذا لا تتراكم الشحنات عند نقطة التفرع؟',
      questionType: 'essay',
      options: [],
      correctAnswer: 'تطبيقاً لمبدأ بقاء الشحنة الكهربية',
      marks: 10,
      orderIndex: 3,
    },
  ];

  it('grades 100% on objective questions and flags essay for teacher review', () => {
    const studentAnswers = {
      q1: 'أوم',
      q2: 'الشحنة',
      q3: 'إجابة الطالب المقالية هنا',
    };

    const result = gradeExamSubmission(sampleQuestions, studentAnswers);

    expect(result.totalQuestions).toBe(3);
    expect(result.objectiveCount).toBe(2);
    expect(result.subjectiveCount).toBe(1);
    expect(result.requiresManualReview).toBe(true);

    // 20 out of 30 points earned from objective questions
    expect(result.earnedPoints).toBe(20);
    expect(result.totalPoints).toBe(30);

    const essayResult = result.questionResults.find((r) => r.questionId === 'q3');
    expect(essayResult?.reviewStatus).toBe('pending_teacher_review');
    expect(essayResult?.isCorrect).toBeNull();
  });

  it('handles option index matching seamlessly', () => {
    const studentAnswers = {
      q1: 1, // index of 'أوم'
      q2: 0, // index of 'الشحنة'
    };

    const result = gradeExamSubmission(sampleQuestions, studentAnswers);
    expect(result.correctCount).toBe(2);
    expect(result.earnedPoints).toBe(20);
  });

  it('calculates 0% when all objective answers are incorrect', () => {
    const studentAnswers = {
      q1: 'فولت',
      q2: 'الطاقة',
    };

    const result = gradeExamSubmission(sampleQuestions, studentAnswers);
    expect(result.correctCount).toBe(0);
    expect(result.earnedPoints).toBe(0);
    expect(result.percentage).toBe(0);
  });
});
