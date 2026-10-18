/**
 * Arabic text indexing, semantic word tokenization, and status classification for Yalla Center.
 */

import { MaterialIndexStatus } from '@/lib/dal/types';

export const MIN_EXAM_WORD_COUNT = 200;

/**
 * Accurately counts semantic words in Arabic, English, and scientific text.
 * Strips Tashkeel (diacritics), Tatweel, KaTeX / LaTeX markup, and punctuation.
 */
export function countArabicWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;

  // 1. Remove LaTeX display and inline math blocks to count semantic text words
  const strippedMath = text
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^\$]*?\$/g, ' ');

  // 2. Remove Arabic diacritics (tashkeel: fatha, damma, kasra, sukun, tanween, dagger alif)
  const normalized = strippedMath.replace(/[\u064B-\u065F\u0670]/g, '');

  // 3. Remove tatweel (kashida)
  const cleanTatweel = normalized.replace(/\u0640/g, '');

  // 4. Tokenize by whitespace, hyphens, and standard Arabic/English punctuation
  const tokens = cleanTatweel
    .split(/[\s,،؛.:!?؟()[\]{}<>"'`\\/+=*^%~#$|]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !/^\d+$/.test(t)); // Filter out standalone isolated numbers

  return tokens.length;
}

/**
 * Classifies the material index status based on semantic word count.
 */
export function evaluateIndexingStatus(
  wordCount: number,
  hasError: boolean = false
): MaterialIndexStatus {
  if (hasError) return 'failed';
  if (wordCount >= MIN_EXAM_WORD_COUNT) return 'indexed';
  if (wordCount > 0 && wordCount < MIN_EXAM_WORD_COUNT) return 'insufficient';
  return 'pending';
}

/**
 * Simulates text extraction for newly linked or uploaded materials in demo mode.
 */
export function simulateTextExtraction(
  title: string,
  subject: string,
  stage: string = 'secondary'
): {
  extractedText: string;
  wordCount: number;
  status: MaterialIndexStatus;
} {
  const sampleAcademicText = `مذكرة دراسية تفصيلية لمقرر ${subject} بعنوان "${title}".
يشتمل هذا المحتوى الأكاديمي على شرح معمق للمفاهيم الأساسية، القوانين الفيزيائية والرياضية، والتطبيقات النموذجية وفق المنهج المصري المعتمد للمرحلة ${stage}.
في هذا الباب ندرس سلوك المنظومة وتفاعل عناصرها تحت تأثير المتغيرات المختلفة. من أهم القوانين التي تحكم هذه الظاهرة هو التناسب الطردي بين المتغيرات الأساسية عند ثبوت العوامل المحيطة، وتطبيق مبدأ بقاء الطاقة والشحنة في الأنظمة المغلقة.
تتوزع التطبيقات العملية في عدة نماذج:
أولاً، النموذج الخطي البسيط حيث تظل النسبة ثابتة مما يسهل حساب القيم المجهولة باستخدام معادلات الدرجة الأولى وقوانين التناسب المباشر.
ثانياً، التحليل المركب الذي يتطلب صياغة معادلات جبرية وتفاضلية وتطبيق شروط الاتزان الديناميكي وحساب القوى ومحصلة المتجهات.
ثالثاً، حل المسائل التدريبية المتدرجة التي تقيس مستويات التفكير العليا، والاستنتاج المنطقي، وربط المفاهيم النظرية بالتجارب المعملية الواقعية.
رابعاً، مراجعة الأخطاء الشائعة في التعويض الحسابي والتحويل بين وحدات القياس الدولية والتعامل مع الكسور والأسس العشرية.
يجب على الطالب مراعاة دقة القياس، وتدوين الوحدات الفيزيائية بوضوح، وكتابة خطوات الحل خطوة بخطوة للوصول إلى النتيجة النهائية الصحيحة.
كما يشتمل هذا الفصل على بنك أسئلة وتدريبات شاملة تغطي جميع مخرجات التعلم المستهدفة، مع التركيز على فهم العلاقات البيانية وتفسير المنحنيات واستنتاج العلاقات الرياضية بدقة واحترافية عالية.
هذا النص معد ومفهرس بالكامل لتوليد اختبارات إلكترونية وورقية دقيقة عبر منصة يلا سنتر مع دعم كامل للرموز والصيغ والمعادلات الرياضية ونماذج الإجابة النموذجية المعتمدة.`;

  const wordCount = countArabicWords(sampleAcademicText);
  const status = evaluateIndexingStatus(wordCount);

  return {
    extractedText: sampleAcademicText,
    wordCount,
    status,
  };
}
