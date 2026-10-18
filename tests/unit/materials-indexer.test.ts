import { describe, it, expect } from 'vitest';
import {
  countArabicWords,
  evaluateIndexingStatus,
  simulateTextExtraction,
  MIN_EXAM_WORD_COUNT,
} from '@/lib/materials/indexer';

describe('Milestone 5: Arabic Text Indexing & Word Count Tokenizer (FEAT-28 & AC-8)', () => {
  it('counts words accurately in standard Arabic text', () => {
    const text = 'ينص قانون كيرشوف الأول على حفظ الشحنة الكهربية في الدوائر المغلقة';
    const count = countArabicWords(text);
    expect(count).toBe(11);
  });

  it('normalizes Arabic diacritics (Tashkeel) without inflating word count', () => {
    const textWithTashkeel = 'يَنُصُّ قَانُونُ كِيرْشُوفَ الأَوَّلُ عَلَى حِفْظِ الشُّحْنَةِ الكَهْرَبِيَّةِ';
    const plainText = 'ينص قانون كيرشوف الأول على حفظ الشحنة الكهربية';

    expect(countArabicWords(textWithTashkeel)).toBe(countArabicWords(plainText));
  });

  it('removes Tatweel (Kashida) cleanly', () => {
    const textWithTatweel = 'قـــــانـــــون كـــــيـــــرشـــــوف';
    expect(countArabicWords(textWithTatweel)).toBe(2);
  });

  it('ignores isolated KaTeX formula expressions from semantic word counts', () => {
    const textWithMath = 'احسب شدة التيار من العلاقة $$I = \\frac{V}{R}$$ في الدائرة الموضحة';
    // Words: احسب (1), شدة (2), التيار (3), من (4), العلاقة (5), في (6), الدائرة (7), الموضحة (8)
    const count = countArabicWords(textWithMath);
    expect(count).toBe(8);
  });

  it('filters out standalone numbers from word count', () => {
    const textWithNumbers = 'قيمة المقاومة هي 50 أوم وفرق الجهد 220 فولت';
    // Words: قيمة, المقاومة, هي, أوم, وفرق, الجهد, فولت (7 words; 50 and 220 filtered)
    const count = countArabicWords(textWithNumbers);
    expect(count).toBe(7);
  });

  it('evaluates indexing status correctly based on threshold', () => {
    expect(evaluateIndexingStatus(250)).toBe('indexed');
    expect(evaluateIndexingStatus(200)).toBe('indexed');
    expect(evaluateIndexingStatus(199)).toBe('insufficient');
    expect(evaluateIndexingStatus(15)).toBe('insufficient');
    expect(evaluateIndexingStatus(0)).toBe('pending');
    expect(evaluateIndexingStatus(50, true)).toBe('failed');
  });

  it('simulates text extraction with words >= 200 qualifying for AC-8 preflight', () => {
    const result = simulateTextExtraction('قوانين كيرشوف', 'الفيزياء', 'secondary');
    expect(result.wordCount).toBeGreaterThanOrEqual(MIN_EXAM_WORD_COUNT);
    expect(result.status).toBe('indexed');
    expect(result.extractedText).toContain('المنهج المصري');
  });
});
