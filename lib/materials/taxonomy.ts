/**
 * 6-Tier Educational Materials Taxonomy & Hierarchy Builder for Yalla Center.
 * Stage -> Grade -> Subject -> Unit -> Lesson -> Document.
 */

import { Material, Subject } from '@/lib/dal/types';

export interface StageDefinition {
  code: string;
  nameAr: string;
  grades: Array<{ code: string; nameAr: string }>;
}

export const EGYPTIAN_STAGES: StageDefinition[] = [
  {
    code: 'primary',
    nameAr: 'المرحلة الابتدائية',
    grades: [
      { code: '1_prim', nameAr: 'الصف الأول الابتدائي' },
      { code: '2_prim', nameAr: 'الصف الثاني الابتدائي' },
      { code: '3_prim', nameAr: 'الصف الثالث الابتدائي' },
      { code: '4_prim', nameAr: 'الصف الرابع الابتدائي' },
      { code: '5_prim', nameAr: 'الصف الخامس الابتدائي' },
      { code: '6_prim', nameAr: 'الصف السادس الابتدائي' },
    ],
  },
  {
    code: 'preparatory',
    nameAr: 'المرحلة الإعدادية',
    grades: [
      { code: '1_prep', nameAr: 'الصف الأول الإعدادي' },
      { code: '2_prep', nameAr: 'الصف الثاني الإعدادي' },
      { code: '3_prep', nameAr: 'الصف الثالث الإعدادي' },
    ],
  },
  {
    code: 'secondary',
    nameAr: 'المرحلة الثانوية',
    grades: [
      { code: '1_sec', nameAr: 'الصف الأول الثانوي' },
      { code: '2_sec', nameAr: 'الصف الثاني الثانوي' },
      { code: '3_sec', nameAr: 'الصف الثالث الثانوي (الثانوية العامة)' },
    ],
  },
];

export const DOCUMENT_CATEGORIES: Record<
  string,
  { code: string; nameAr: string; badgeClass: string }
> = {
  lecture_notes: {
    code: 'lecture_notes',
    nameAr: 'مذكرة شرح تفصيلية',
    badgeClass: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  },
  summary: {
    code: 'summary',
    nameAr: 'ملخص ومراجعة سريعة',
    badgeClass: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
  },
  exercises: {
    code: 'exercises',
    nameAr: 'تمارين وتطبيقات عملية',
    badgeClass: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
  },
  exam_bank: {
    code: 'exam_bank',
    nameAr: 'بنك أسئلة واختبارات',
    badgeClass: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  },
  formula_sheet: {
    code: 'formula_sheet',
    nameAr: 'ورقة قوانين ومفاهيم',
    badgeClass: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  },
};

export function getStageNameArabic(stageCode: string): string {
  const stage = EGYPTIAN_STAGES.find((s) => s.code === stageCode);
  return stage ? stage.nameAr : stageCode;
}

export function getGradeNameArabic(gradeCode: string): string {
  for (const stage of EGYPTIAN_STAGES) {
    const grade = stage.grades.find((g) => g.code === gradeCode);
    if (grade) return grade.nameAr;
  }
  return gradeCode;
}

export interface TaxonomyLessonNode {
  lessonName: string;
  materials: Material[];
}

export interface TaxonomyUnitNode {
  unitName: string;
  lessons: TaxonomyLessonNode[];
  totalMaterialsCount: number;
}

export interface TaxonomySubjectNode {
  subjectId: string;
  subjectNameAr: string;
  units: TaxonomyUnitNode[];
  totalMaterialsCount: number;
}

export interface TaxonomyGradeNode {
  gradeCode: string;
  gradeNameAr: string;
  subjects: TaxonomySubjectNode[];
  totalMaterialsCount: number;
}

export interface TaxonomyStageNode {
  stageCode: string;
  stageNameAr: string;
  grades: TaxonomyGradeNode[];
  totalMaterialsCount: number;
}

/**
 * Builds the complete 6-tier taxonomy tree from flat materials and subjects lists.
 */
export function buildTaxonomyTree(
  materials: Material[],
  subjects: Subject[]
): TaxonomyStageNode[] {
  const subjectMap = new Map<string, Subject>();
  for (const s of subjects) {
    subjectMap.set(s.id, s);
  }

  const result: TaxonomyStageNode[] = [];

  for (const stageDef of EGYPTIAN_STAGES) {
    const stageMaterials = materials.filter((m) => m.stage === stageDef.code);
    const gradeNodes: TaxonomyGradeNode[] = [];

    for (const gradeDef of stageDef.grades) {
      const gradeMaterials = stageMaterials.filter((m) => m.grade === gradeDef.code);

      // Find subjects for this stage/grade
      const relevantSubjects = subjects.filter(
        (s) => s.stage === stageDef.code && s.grade === gradeDef.code
      );

      // Group materials by subjectId
      const subjectIds = Array.from(
        new Set([
          ...relevantSubjects.map((s) => s.id),
          ...gradeMaterials.map((m) => m.subjectId),
        ])
      );

      const subjectNodes: TaxonomySubjectNode[] = [];

      for (const subjId of subjectIds) {
        const subjMaterials = gradeMaterials.filter((m) => m.subjectId === subjId);
        const subjInfo = subjectMap.get(subjId);
        const subjectNameAr = subjInfo?.nameAr || 'المادة الدراسية';

        // Group by Unit
        const unitMap = new Map<string, Material[]>();
        for (const m of subjMaterials) {
          const unit = m.unitName || 'الوحدة العامة';
          if (!unitMap.has(unit)) unitMap.set(unit, []);
          unitMap.get(unit)!.push(m);
        }

        const unitNodes: TaxonomyUnitNode[] = [];
        for (const [unitName, unitMaterials] of unitMap.entries()) {
          // Group by Lesson
          const lessonMap = new Map<string, Material[]>();
          for (const m of unitMaterials) {
            const lesson = m.lessonName || 'الدرس العام';
            if (!lessonMap.has(lesson)) lessonMap.set(lesson, []);
            lessonMap.get(lesson)!.push(m);
          }

          const lessonNodes: TaxonomyLessonNode[] = [];
          for (const [lessonName, lMaterials] of lessonMap.entries()) {
            lessonNodes.push({
              lessonName,
              materials: lMaterials,
            });
          }

          unitNodes.push({
            unitName,
            lessons: lessonNodes,
            totalMaterialsCount: unitMaterials.length,
          });
        }

        subjectNodes.push({
          subjectId: subjId,
          subjectNameAr,
          units: unitNodes,
          totalMaterialsCount: subjMaterials.length,
        });
      }

      gradeNodes.push({
        gradeCode: gradeDef.code,
        gradeNameAr: gradeDef.nameAr,
        subjects: subjectNodes,
        totalMaterialsCount: gradeMaterials.length,
      });
    }

    result.push({
      stageCode: stageDef.code,
      stageNameAr: stageDef.nameAr,
      grades: gradeNodes,
      totalMaterialsCount: stageMaterials.length,
    });
  }

  return result;
}
