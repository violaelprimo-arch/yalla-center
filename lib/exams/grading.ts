/**
 * Deterministic Auto-Grading Engine for Yalla Center Examinations.
 * Automatically grades MCQs and True/False questions while flagging subjective
 * questions (essay/short_answer) for teacher manual review.
 */

import { ExamQuestion } from '@/lib/dal/types';

export interface QuestionGradingDetail {
  questionId: string;
  questionNumber: number;
  questionType: string;
  studentAnswer: string | number;
  correctAnswer: string;
  isCorrect: boolean | null; // null for subjective / pending
  pointsAwarded: number;
  maxPoints: number;
  explanation?: string;
  reviewStatus: 'auto_graded' | 'pending_teacher_review';
}

export interface ExamGradingResult {
  totalPoints: number;
  earnedPoints: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  objectiveCount: number;
  subjectiveCount: number;
  requiresManualReview: boolean;
  questionResults: QuestionGradingDetail[];
}

/**
 * Grades an exam submission deterministically.
 */
export function gradeExamSubmission(
  questions: ExamQuestion[],
  answers: Record<string, string | number>
): ExamGradingResult {
  const totalPoints = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
  let earnedPoints = 0;
  let correctCount = 0;
  let subjectiveCount = 0;
  let objectiveCount = 0;

  const questionResults: QuestionGradingDetail[] = questions.map((q) => {
    const studentAns = answers[q.id];

    // Subjective question handling
    if (q.questionType === 'essay') {
      subjectiveCount++;
      return {
        questionId: q.id,
        questionNumber: q.questionNumber,
        questionType: q.questionType,
        studentAnswer: studentAns ?? '',
        correctAnswer: q.correctAnswer,
        isCorrect: null, // Pending manual teacher grading
        pointsAwarded: 0,
        maxPoints: q.marks,
        explanation: q.explanation,
        reviewStatus: 'pending_teacher_review',
      };
    }

    // Objective question handling (MCQ / True/False)
    objectiveCount++;
    let isCorrect = false;

    if (studentAns !== undefined && studentAns !== null && studentAns !== '') {
      if (typeof studentAns === 'number' && Array.isArray(q.options)) {
        // Matched by option index
        const selectedText = q.options[studentAns];
        isCorrect =
          selectedText?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase() ||
          String(studentAns) === q.correctAnswer?.trim();
      } else {
        // Matched by string comparison
        const normStudent = String(studentAns).trim().toLowerCase();
        const normCorrect = String(q.correctAnswer).trim().toLowerCase();

        if (normStudent === normCorrect) {
          isCorrect = true;
        } else if (Array.isArray(q.options)) {
          // Check if student provided index as string
          const optIdx = parseInt(normStudent, 10);
          if (!isNaN(optIdx) && q.options[optIdx]) {
            isCorrect = q.options[optIdx].trim().toLowerCase() === normCorrect;
          }
        }
      }
    }

    const pointsAwarded = isCorrect ? q.marks : 0;
    if (isCorrect) {
      earnedPoints += pointsAwarded;
      correctCount++;
    }

    return {
      questionId: q.id,
      questionNumber: q.questionNumber,
      questionType: q.questionType,
      studentAnswer: studentAns ?? '',
      correctAnswer: q.correctAnswer,
      isCorrect,
      pointsAwarded,
      maxPoints: q.marks,
      explanation: q.explanation,
      reviewStatus: 'auto_graded',
    };
  });

  const percentage =
    totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 10000) / 100 : 0;

  return {
    totalPoints,
    earnedPoints,
    percentage,
    correctCount,
    totalQuestions: questions.length,
    objectiveCount,
    subjectiveCount,
    requiresManualReview: subjectiveCount > 0,
    questionResults,
  };
}
