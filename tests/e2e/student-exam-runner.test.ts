import { describe, it, expect, beforeEach } from 'vitest';
import { gradeExamSubmission, QuestionItem } from '../fixtures/contract-bridge';

describe('Tier 4: Online Student Examination Platform Runner', () => {
  const sampleQuestions: QuestionItem[] = [
    {
      id: 'q1',
      text: 'ما هي وحدة قياس المقاومة الكهربية في النظام الدولي؟',
      points: 10,
      correctOptionIndex: 1, // الأوم
      options: ['الفولت', 'الأوم', 'الأمبير', 'الجول'],
    },
    {
      id: 'q2',
      text: 'إذا تضاعف طول سلك من مادة موصلة مع ثبات مساحة مقطعه، فإن مقاومته الكهربية:',
      points: 10,
      correctOptionIndex: 0, // تتضاعف
      options: ['تتضاعف', 'تقل إلى النصف', 'تظل ثابتة', 'تزداد لأربعة أمثال'],
    },
    {
      id: 'q3',
      text: 'قانون كيرشوف الأول يعبر عن قانون بقاء:',
      points: 10,
      correctOptionIndex: 2, // الشحنة الكهربية
      options: ['الطاقة', 'كمية الحركة', 'الشحنة الكهربية', 'الجهد الكهربي'],
    },
    {
      id: 'q4',
      text: 'توصيل المقاومات على التوازي يستخدم للحصول على:',
      points: 10,
      correctOptionIndex: 3, // مقاومة مكافئة صغيرة
      options: [
        'مقاومة مكافئة كبيرة',
        'فرق جهد متغير',
        'شدة تيار ثابتة في كل فرع',
        'مقاومة مكافئة صغيرة لزيادة شدة التيار الكلي',
      ],
    },
  ];

  describe('Automated MCQ Scoring Engine', () => {
    it('calculates 100% score (40/40 points) when all answers are correct', () => {
      const studentAnswers = {
        q1: 1, // Correct
        q2: 0, // Correct
        q3: 2, // Correct
        q4: 3, // Correct
      };

      const result = gradeExamSubmission(sampleQuestions, studentAnswers);

      expect(result.totalQuestions).toBe(4);
      expect(result.correctCount).toBe(4);
      expect(result.totalPoints).toBe(40);
      expect(result.earnedPoints).toBe(40);
      expect(result.percentage).toBe(100.0);
    });

    it('calculates partial score accurately (e.g. 3 out of 4 correct = 75%)', () => {
      const studentAnswers = {
        q1: 1, // Correct (10 pts)
        q2: 0, // Correct (10 pts)
        q3: 0, // Incorrect (selected 'الطاقة' instead of 'الشحنة')
        q4: 3, // Correct (10 pts)
      };

      const result = gradeExamSubmission(sampleQuestions, studentAnswers);

      expect(result.totalQuestions).toBe(4);
      expect(result.correctCount).toBe(3);
      expect(result.totalPoints).toBe(40);
      expect(result.earnedPoints).toBe(30);
      expect(result.percentage).toBe(75.0);
    });

    it('calculates 0% score when all answers are incorrect or unselected', () => {
      const studentAnswers = {
        q1: 0,
        q2: 1,
        q3: 1,
        q4: 0,
      };

      const result = gradeExamSubmission(sampleQuestions, studentAnswers);

      expect(result.correctCount).toBe(0);
      expect(result.earnedPoints).toBe(0);
      expect(result.percentage).toBe(0.0);
    });

    it('handles unanswered questions gracefully without throwing errors', () => {
      const partialAnswers = {
        q1: 1, // only 1 question answered
      };

      const result = gradeExamSubmission(sampleQuestions, partialAnswers);

      expect(result.totalQuestions).toBe(4);
      expect(result.correctCount).toBe(1);
      expect(result.earnedPoints).toBe(10);
      expect(result.percentage).toBe(25.0);
    });
  });

  describe('Countdown Timer & Autosave Engine Invariants', () => {
    class ExamRunnerState {
      public remainingSeconds: number;
      public isSubmitted: boolean = false;
      public autosavedPayloads: Record<string, number>[] = [];
      public answers: Record<string, number> = {};

      constructor(durationMinutes: number) {
        this.remainingSeconds = durationMinutes * 60;
      }

      public tick(): void {
        if (this.remainingSeconds > 0 && !this.isSubmitted) {
          this.remainingSeconds--;
          if (this.remainingSeconds === 0) {
            this.submit();
          }
        }
      }

      public selectOption(questionId: string, optionIndex: number): void {
        if (this.isSubmitted) {
          throw new Error('Cannot change answers after exam submission');
        }
        this.answers[questionId] = optionIndex;
        // Trigger autosave
        this.autosavedPayloads.push({ ...this.answers });
      }

      public submit(): void {
        this.isSubmitted = true;
      }
    }

    it('initializes countdown timer correctly from exam duration in minutes', () => {
      const runner = new ExamRunnerState(45); // 45 minutes
      expect(runner.remainingSeconds).toBe(2700);
      expect(runner.isSubmitted).toBe(false);
    });

    it('automatically submits exam when timer reaches 0', () => {
      const runner = new ExamRunnerState(1); // 1 minute = 60s
      runner.remainingSeconds = 1;

      expect(runner.isSubmitted).toBe(false);
      runner.tick(); // remaining becomes 0
      expect(runner.remainingSeconds).toBe(0);
      expect(runner.isSubmitted).toBe(true);
    });

    it('records autosave events on every answer selection', () => {
      const runner = new ExamRunnerState(30);

      runner.selectOption('q1', 1);
      expect(runner.answers['q1']).toBe(1);
      expect(runner.autosavedPayloads.length).toBe(1);

      runner.selectOption('q2', 0);
      expect(runner.answers['q2']).toBe(0);
      expect(runner.autosavedPayloads.length).toBe(2);
    });

    it('locks exam against answer mutation once submitted', () => {
      const runner = new ExamRunnerState(30);
      runner.selectOption('q1', 1);
      runner.submit();

      expect(runner.isSubmitted).toBe(true);
      expect(() => runner.selectOption('q1', 2)).toThrow(/after exam submission/i);
    });
  });
});
