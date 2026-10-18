import { describe, it, expect } from 'vitest';
import { generateGroundedExam } from '@/lib/exams/generator';

describe('Milestone 5: Grounded AI Exam Generation Engine (FEAT-30 & AC-8)', () => {
  const samplePhysicsText = `ينص قانون كيرشوف الأول (قانون حفظ الشحنة الكهربية أو قانون نقطة التفرع) على أن المجموع الجبري للتيارات الكهربية الداخلة إلى أي نقطة تفرع في دائرة كهربية مغلقة يساوي المجموع الجبري للتيارات الكهربية الخارجة من نفس النقطة. ويمكن التعبير رياضياً عن هذا القانون بالصيغة: مجموع التيارات الداخلة يساوي مجموع التيارات الخارجة. يعتبر هذا القانون تطبيقاً مباشراً لمبدأ بقاء الشحنة الكهربية، حيث لا تتراكم الشحنات عند أي نقطة تفرع في السلك. أما قانون كيرشوف الثاني (قانون حفظ الطاقة أو قانون المسار المغلق) فينص على أن المجموع الجبري للقوى الدافعة الكهربية في أي مسار مغلق يساوي المجموع الجبري لفروق الجهد عبر المقاومات في ذلك المسار، وصيغته الرياضية هي: مجموع القوى الدافعة الكهربية يساوي مجموع حاصل ضرب شدة التيار في المقاومة. لحل مسائل كيرشوف نتبع الخطوات التالية: أولاً تحديد اتجاهات التيارات في فروع الدائرة، ثانياً تطبيق القانون الأول عند العقد، ثالثاً اختيار مسارات مغلقة وتطبيق القانون الثاني عليها مع مراعاة الإشارات، وأخيراً حل المعادلات الخطية الناتجة جبرياً باستخدام طريقة الحذف أو المحددات لحساب المجاهيل بدقة عالية. كما نؤكد على أن المقاومة النوعية لموصل معدني تعتمد فقط على نوع مادة الموصل ودرجة الحرارة، ولا تتغير بتغير طول السلك أو مساحة مقطعه، في حين أن التوصيلية الكهربية تمثل مقلوب المقاومة النوعية وتعتبر أيضاً خاصية فيزيائية مميزة للمادة عند ثبوت درجة الحرارة.`;

  it('generates an exam with draft status for teacher review (AC-8 invariant)', () => {
    const payload = generateGroundedExam({
      tenantId: 'tenant-1',
      teacherId: 't1',
      title: 'اختبار كيرشوف',
      subject: 'الفيزياء',
      grade: 'الصف الثالث الثانوي',
      durationMinutes: 30,
      sourceText: samplePhysicsText,
      questionCounts: { mcq: 3, shortAnswer: 1 },
    });

    expect(payload.exam).toBeDefined();
    expect(payload.exam.status).toBe('draft');
    expect(payload.exam.isAiGenerated).toBe(true);
    expect(payload.questions.length).toBe(4);
  });

  it('generates MCQs with exactly 4 options and 1 designated correct answer', () => {
    const payload = generateGroundedExam({
      tenantId: 'tenant-1',
      teacherId: 't1',
      title: 'اختبار تجريبي',
      subject: 'الفيزياء',
      grade: 'الصف الثالث الثانوي',
      durationMinutes: 25,
      sourceText: samplePhysicsText,
      questionCounts: { mcq: 2, shortAnswer: 0 },
    });

    const mcqs = payload.questions.filter((q) => q.questionType === 'mcq');
    expect(mcqs.length).toBe(2);

    for (const q of mcqs) {
      expect(q.options.length).toBe(4);
      expect(q.options).toContain(q.correctAnswer);
      expect(q.explanation).toBeDefined();
      expect(q.explanation?.length).toBeGreaterThan(10);
    }
  });

  it('embeds KaTeX mathematical formulas into generated questions', () => {
    const payload = generateGroundedExam({
      tenantId: 'tenant-1',
      teacherId: 't1',
      title: 'اختبار قوانين كيرشوف',
      subject: 'الفيزياء',
      grade: 'الصف الثالث الثانوي',
      durationMinutes: 30,
      sourceText: samplePhysicsText,
      questionCounts: { mcq: 2, shortAnswer: 1 },
    });

    const hasFormula = payload.questions.some((q) => !!q.katexFormula);
    expect(hasFormula).toBe(true);
  });

  it('throws an error with status 422 if source text has fewer than 200 words', () => {
    const shortText = 'نص دراسي قصير جداً لا يكفي لتوليد الامتحان.';
    expect(() =>
      generateGroundedExam({
        tenantId: 'tenant-1',
        teacherId: 't1',
        title: 'امتحان غير صالح',
        subject: 'الفيزياء',
        grade: '3 ث',
        durationMinutes: 20,
        sourceText: shortText,
      })
    ).toThrow();
  });
});
