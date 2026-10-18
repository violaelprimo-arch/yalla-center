/**
 * Unified Preflight Validation Gate for AI Exam Generation in Yalla Center (AC-8).
 * Enforces strict pedagogical grounding and minimum 200 words threshold.
 */

import { countArabicWords, MIN_EXAM_WORD_COUNT } from '@/lib/materials/indexer';

export interface PreflightDocumentItem {
  id: string;
  title: string;
  isIndexed: boolean;
  wordCount: number;
}

export interface PreflightCheckResult {
  allowed: boolean;
  httpStatus: 200 | 422;
  errorCode?: 'PREFLIGHT_TEXT_TOO_SHORT' | 'UNINDEXED_SOURCE_DOCUMENTS' | 'EMPTY_SELECTION';
  messageArabic: string;
  totalWordCount: number;
  unindexedDocTitles?: string[];
}

/**
 * Validates whether the source documents or raw text satisfy the grounding criteria.
 */
export function validateExamPreflightInput(params: {
  rawText?: string;
  documents?: PreflightDocumentItem[];
}): PreflightCheckResult {
  // 1. Document-based input validation
  if (params.documents && params.documents.length > 0) {
    const unindexed = params.documents.filter((doc) => !doc.isIndexed);
    if (unindexed.length > 0) {
      return {
        allowed: false,
        httpStatus: 422,
        errorCode: 'UNINDEXED_SOURCE_DOCUMENTS',
        messageArabic: `المستندات التالية غير مفهرسة: ${unindexed.map((d) => d.title).join('، ')}. يرجى فهرسة المحتوى أولاً.`,
        totalWordCount: 0,
        unindexedDocTitles: unindexed.map((d) => d.title),
      };
    }

    const totalDocWords = params.documents.reduce((sum, d) => sum + (d.wordCount || 0), 0);
    if (totalDocWords < MIN_EXAM_WORD_COUNT) {
      return {
        allowed: false,
        httpStatus: 422,
        errorCode: 'PREFLIGHT_TEXT_TOO_SHORT',
        messageArabic: `محتوى المستندات المحددة غير كافٍ لتوليد اختبار تربوي دقيق (${totalDocWords} كلمة). الحد الأدنى المطلوب هو ${MIN_EXAM_WORD_COUNT} كلمة.`,
        totalWordCount: totalDocWords,
      };
    }

    return {
      allowed: true,
      httpStatus: 200,
      totalWordCount: totalDocWords,
      messageArabic: 'المستندات المحددة مؤهلة ومفهرسة بنجاح.',
    };
  }

  // 2. Direct raw text input validation
  if (params.rawText && params.rawText.trim().length > 0) {
    const wordCount = countArabicWords(params.rawText);
    if (wordCount < MIN_EXAM_WORD_COUNT) {
      return {
        allowed: false,
        httpStatus: 422,
        errorCode: 'PREFLIGHT_TEXT_TOO_SHORT',
        messageArabic: `نص المصدر المقدم قصير جداً (${wordCount} كلمة). الحد الأدنى المطلوب لتوليد اختبار مؤصل هو ${MIN_EXAM_WORD_COUNT} كلمة.`,
        totalWordCount: wordCount,
      };
    }

    return {
      allowed: true,
      httpStatus: 200,
      totalWordCount: wordCount,
      messageArabic: 'النص المصدري مؤهل لتوليد الاختبار.',
    };
  }

  // 3. Empty input
  return {
    allowed: false,
    httpStatus: 422,
    errorCode: 'EMPTY_SELECTION',
    messageArabic: 'يرجى تقديم نص دراسي أو اختيار مستندات مفهرسة لتوليد الاختبار.',
    totalWordCount: 0,
  };
}
