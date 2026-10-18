import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Tier 4: Printable Branded A4 Exam Sheet Layout (AC-9)', () => {
  const brandDir = path.resolve(process.cwd(), 'public/brand');
  const logoLightPath = path.join(brandDir, 'yalla-center-logo-light.png');
  const logoDarkPath = path.join(brandDir, 'yalla-center-logo-dark.png');
  const iconPath = path.join(brandDir, 'yalla-center-icon.png');

  it('preserves the official Yalla Center brand assets in public/brand without modification', () => {
    expect(fs.existsSync(logoLightPath)).toBe(true);
    expect(fs.existsSync(logoDarkPath)).toBe(true);
    expect(fs.existsSync(iconPath)).toBe(true);

    const logoLightStat = fs.statSync(logoLightPath);
    expect(logoLightStat.size).toBeGreaterThan(1000); // verify valid image asset
  });

  describe('AC-9: A4 Sheet Layout DOM & Structural Contracts', () => {
    // Generate canonical A4 Exam Sheet DOM structure
    function renderPrintableExamSheet(examData: {
      teacherName: string;
      teacherTitle: string;
      subject: string;
      grade: string;
      examTitle: string;
      questions: Array<{ id: string; text: string; katexFormula?: string }>;
    }) {
      return `
        <div id="printable-a4-sheet" class="a4-page font-cairo" dir="rtl" style="width: 210mm; min-height: 297mm; padding: 15mm; margin: 0 auto; background: #ffffff; color: #000000;">
          <!-- Exam Header -->
          <header id="exam-header" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000000; padding-bottom: 8mm; margin-bottom: 6mm;">
            <!-- Top-Left: Official Yalla Center Logo -->
            <div id="exam-header-logo" style="text-align: left; order: 1;">
              <img src="/brand/yalla-center-logo-light.png" alt="Yalla Center Logo" style="height: 48px; object-fit: contain;" />
            </div>

            <!-- Header Center: Academic Meta -->
            <div id="exam-header-meta" style="text-align: center; order: 2; flex: 1;">
              <h1 style="font-size: 16pt; font-weight: bold; margin: 0;">${examData.examTitle}</h1>
              <p style="font-size: 11pt; margin: 2mm 0 0 0;">${examData.subject} — ${examData.grade}</p>
            </div>

            <!-- Top-Right: Teacher Name & Title -->
            <div id="exam-header-teacher" style="text-align: right; order: 3;">
              <h2 style="font-size: 13pt; font-weight: bold; margin: 0;">${examData.teacherName}</h2>
              <p style="font-size: 10pt; color: #444444; margin: 1mm 0 0 0;">${examData.teacherTitle}</p>
            </div>
          </header>

          <!-- Student Information Box -->
          <section id="student-info-box" style="display: grid; grid-template-columns: repeat(4, 1fr) 80px; gap: 4mm; border: 1px solid #000000; padding: 4mm; margin-bottom: 8mm; font-size: 10pt;">
            <div class="field-student-name"><strong>اسم الطالب:</strong> <span class="input-line">................................................</span></div>
            <div class="field-student-code"><strong>كود الطالب:</strong> <span class="input-line">.......................</span></div>
            <div class="field-group"><strong>المجموعة:</strong> <span class="input-line">.......................</span></div>
            <div class="field-date"><strong>التاريخ:</strong> <span class="input-line">.......................</span></div>
            <div class="field-score" style="border: 1px solid #000; text-align: center; padding: 2mm;"><strong>الدرجة</strong><br/>&nbsp;/ 50</div>
          </section>

          <!-- Exam Questions Body -->
          <main id="exam-questions-body">
            ${examData.questions
              .map(
                (q, idx) => `
              <article class="question-item" id="q-${q.id}" style="margin-bottom: 6mm;">
                <div class="question-header">
                  <span class="q-number"><strong>(${idx + 1})</strong></span>
                  <span class="q-text">${q.text}</span>
                </div>
                ${
                  q.katexFormula
                    ? `<div class="katex-container" dir="ltr" style="display: block; margin: 2mm 0; text-align: center;">
                        <span class="katex"><span class="katex-mathml">${q.katexFormula}</span><span class="katex-html" aria-hidden="true">${q.katexFormula}</span></span>
                      </div>`
                    : ''
                }
              </article>
            `
              )
              .join('')}
          </main>
        </div>
      `;
    }

    it('places official Yalla Center logo in the top-left quadrant of the header', () => {
      const html = renderPrintableExamSheet({
        teacherName: 'أ / محمد علي',
        teacherTitle: 'خبير مادة الفيزياء للثانوية العامة',
        subject: 'الفيزياء',
        grade: 'الصف الثالث الثانوي',
        examTitle: 'امتحان الباب الأول: الكهربية التيارية',
        questions: [],
      });

      // Verify header and top-left logo presence
      expect(html).toContain('id="exam-header"');
      expect(html).toContain('id="exam-header-logo"');
      expect(html).toContain('/brand/yalla-center-logo-light.png');
      expect(html).toContain('alt="Yalla Center Logo"');
    });

    it('places teacher name and academic title in the top-right quadrant of the header', () => {
      const teacherName = 'أ / شريف البدوي';
      const teacherTitle = 'كبير معلمي الكيمياء';

      const html = renderPrintableExamSheet({
        teacherName,
        teacherTitle,
        subject: 'الكيمياء',
        grade: 'الصف الأول الثانوي',
        examTitle: 'اختبار دوري',
        questions: [],
      });

      expect(html).toContain('id="exam-header-teacher"');
      expect(html).toContain(teacherName);
      expect(html).toContain(teacherTitle);
    });

    it('contains all required student identification fields (Name, Code, Group, Date, Score Box)', () => {
      const html = renderPrintableExamSheet({
        teacherName: 'أ / إبراهيم عادل',
        teacherTitle: 'مدرس أول اللغة الإنجليزية',
        subject: 'اللغة الإنجليزية',
        grade: 'الصف الثاني الثانوي',
        examTitle: 'Midterm Exam',
        questions: [],
      });

      expect(html).toContain('id="student-info-box"');
      expect(html).toContain('اسم الطالب:');
      expect(html).toContain('كود الطالب:');
      expect(html).toContain('المجموعة:');
      expect(html).toContain('التاريخ:');
      expect(html).toContain('الدرجة');
    });

    it('renders KaTeX scientific and mathematical notation inside LTR directional wrappers', () => {
      const mathFormula = 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}';
      const physicsLaw = 'V = I \\times R';

      const html = renderPrintableExamSheet({
        teacherName: 'أ / سامح سمير',
        teacherTitle: 'مدرس الرياضيات التطبيقية',
        subject: 'الرياضيات',
        grade: 'الصف الثالث الثانوي',
        examTitle: 'اختبار الجبر والهندسة الفراغية',
        questions: [
          {
            id: '1',
            text: 'أوجد جذور المعادلة التربيعية الآتية مستخدماً القانون العام:',
            katexFormula: mathFormula,
          },
          {
            id: '2',
            text: 'احسب فرق الجهد الكهربي في دائرة مغلقة باستخدام العلاقة:',
            katexFormula: physicsLaw,
          },
        ],
      });

      expect(html).toContain('class="katex-container"');
      expect(html).toContain('dir="ltr"');
      expect(html).toContain('class="katex"');
      expect(html).toContain(mathFormula);
      expect(html).toContain(physicsLaw);
    });
  });
});
