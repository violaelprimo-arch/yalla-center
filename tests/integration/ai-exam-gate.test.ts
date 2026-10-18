import { describe, it, expect } from 'vitest';
import {
  validateExamSourceGroundedness,
  createExamDraft,
  AcademicDocument,
} from '../fixtures/contract-bridge';

describe('Tier 3: Grounded AI Exam Generation Preflight Gate (AC-8)', () => {
  it('rejects exam generation when no source documents are provided (UNINDEXED_SOURCE_DOCUMENTS)', () => {
    const emptyDocs: AcademicDocument[] = [];

    const validation = validateExamSourceGroundedness(emptyDocs);

    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe('UNINDEXED_SOURCE_DOCUMENTS');
    expect(validation.totalWordCount).toBe(0);
    expect(validation.message).toMatch(/مفهرسة/);
  });

  it('rejects exam generation when any selected source document is unindexed', () => {
    const mixedDocs: AcademicDocument[] = [
      {
        id: 'doc-1',
        title: 'مقدمة في الميكانيكا',
        isIndexed: true,
        extractedWordCount: 500,
      },
      {
        id: 'doc-2',
        title: 'تمارين قانون نيوتن الثاني',
        isIndexed: false, // unindexed!
        extractedWordCount: 400,
      },
    ];

    const validation = validateExamSourceGroundedness(mixedDocs);

    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe('UNINDEXED_SOURCE_DOCUMENTS');
    expect(validation.totalWordCount).toBe(0);
  });

  it('rejects exam generation when indexed documents contain fewer than 200 words (INSUFFICIENT_SOURCE_DOCUMENTS)', () => {
    const sparseDocs: AcademicDocument[] = [
      {
        id: 'doc-sparse-1',
        title: 'ملاحظة قصيرة',
        isIndexed: true,
        extractedWordCount: 85,
      },
      {
        id: 'doc-sparse-2',
        title: 'تعريف سريع',
        isIndexed: true,
        extractedWordCount: 65,
      },
    ]; // Total = 150 words < 200 words threshold

    const validation = validateExamSourceGroundedness(sparseDocs);

    expect(validation.valid).toBe(false);
    expect(validation.errorCode).toBe('INSUFFICIENT_SOURCE_DOCUMENTS');
    expect(validation.totalWordCount).toBe(150);
    expect(validation.message).toMatch(/أقل من 200 كلمة/);
  });

  it('accepts exam generation when source documents are indexed and meet or exceed the 200-word threshold', () => {
    const validDocs: AcademicDocument[] = [
      {
        id: 'doc-complete-1',
        title: 'شرح المقاومة النوعية والتوصيلية الكهربية',
        isIndexed: true,
        extractedWordCount: 350,
      },
      {
        id: 'doc-complete-2',
        title: 'مسائل محلولة على قانون أوم',
        isIndexed: true,
        extractedWordCount: 450,
      },
    ]; // Total = 800 words

    const validation = validateExamSourceGroundedness(validDocs);

    expect(validation.valid).toBe(true);
    expect(validation.errorCode).toBeUndefined();
    expect(validation.totalWordCount).toBe(800);
  });

  it('places generated exams strictly into teacher review draft status before publishing', () => {
    const validDocs: AcademicDocument[] = [
      {
        id: 'doc-physics-ch1',
        title: 'الفصل الأول: الكهرباء التيارية',
        isIndexed: true,
        extractedWordCount: 620,
      },
    ];

    const examDraft = createExamDraft(
      'اختبار دوري - قانون أوم وقوانين كيرشوف',
      'فيزياء 3 ث',
      validDocs,
      10
    );

    // Invariants: Must default to pending_teacher_review and isPublished: false
    expect(examDraft.id).toBeDefined();
    expect(examDraft.reviewStatus).toBe('pending_teacher_review');
    expect(examDraft.isPublished).toBe(false);
    expect(examDraft.questionsCount).toBe(10);
    expect(examDraft.totalWordCount).toBe(620);
  });

  it('throws an error if createExamDraft is attempted with invalid or ungrounded sources', () => {
    const invalidDocs: AcademicDocument[] = [
      {
        id: 'doc-bad',
        title: 'مستند فارغ',
        isIndexed: false,
        extractedWordCount: 0,
      },
    ];

    expect(() =>
      createExamDraft('اختبار غير صالح', 'فيزياء', invalidDocs)
    ).toThrow('UNINDEXED_SOURCE_DOCUMENTS');
  });
});
