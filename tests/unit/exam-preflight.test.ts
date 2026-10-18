import { describe, it, expect } from 'vitest';
import { validateExamPreflightInput } from '@/lib/exams/preflight';

describe('Milestone 5: AI Exam Preflight Validation Gate (FEAT-29 & AC-8)', () => {
  it('rejects exam generation when empty input is provided', () => {
    const result = validateExamPreflightInput({});
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.errorCode).toBe('EMPTY_SELECTION');
  });

  it('rejects exam generation when any document is unindexed', () => {
    const docs = [
      { id: 'd1', title: 'مذكرة كيرشوف', isIndexed: true, wordCount: 300 },
      { id: 'd2', title: 'مذكرة غير مفهرسة', isIndexed: false, wordCount: 250 },
    ];

    const result = validateExamPreflightInput({ documents: docs });
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.errorCode).toBe('UNINDEXED_SOURCE_DOCUMENTS');
    expect(result.unindexedDocTitles).toContain('مذكرة غير مفهرسة');
  });

  it('rejects exam generation when documents contain fewer than 200 words (PREFLIGHT_TEXT_TOO_SHORT)', () => {
    const docs = [
      { id: 'd1', title: 'ملاحظة موجزة', isIndexed: true, wordCount: 80 },
      { id: 'd2', title: 'ورقة قوانين', isIndexed: true, wordCount: 70 },
    ]; // Total = 150 words < 200

    const result = validateExamPreflightInput({ documents: docs });
    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.errorCode).toBe('PREFLIGHT_TEXT_TOO_SHORT');
    expect(result.totalWordCount).toBe(150);
  });

  it('rejects raw text input if fewer than 200 words (PREFLIGHT_TEXT_TOO_SHORT, HTTP 422)', () => {
    const shortText = 'هذا نص دراسي قصير جداً يحتوي على شرح بسيط لقانون أوم ولا يكفي لتوليد امتحان تربوي دقيق.';
    const result = validateExamPreflightInput({ rawText: shortText });

    expect(result.allowed).toBe(false);
    expect(result.httpStatus).toBe(422);
    expect(result.errorCode).toBe('PREFLIGHT_TEXT_TOO_SHORT');
    expect(result.totalWordCount).toBeLessThan(200);
  });

  it('approves exam generation when indexed documents meet or exceed 200 words', () => {
    const docs = [
      { id: 'd1', title: 'شرح كيرشوف الشامل', isIndexed: true, wordCount: 350 },
      { id: 'd2', title: 'مسائل نموذجية', isIndexed: true, wordCount: 220 },
    ];

    const result = validateExamPreflightInput({ documents: docs });
    expect(result.allowed).toBe(true);
    expect(result.httpStatus).toBe(200);
    expect(result.errorCode).toBeUndefined();
    expect(result.totalWordCount).toBe(570);
  });
});
