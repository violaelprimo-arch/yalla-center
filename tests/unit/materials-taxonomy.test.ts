import { describe, it, expect } from 'vitest';
import {
  EGYPTIAN_STAGES,
  getStageNameArabic,
  getGradeNameArabic,
  buildTaxonomyTree,
} from '@/lib/materials/taxonomy';
import { Material, Subject } from '@/lib/dal/types';

describe('Milestone 5: 6-Tier Materials Taxonomy Builder (FEAT-27)', () => {
  it('defines the three canonical Egyptian educational stages', () => {
    const codes = EGYPTIAN_STAGES.map((s) => s.code);
    expect(codes).toContain('primary');
    expect(codes).toContain('preparatory');
    expect(codes).toContain('secondary');
  });

  it('translates stage and grade codes to Arabic display names accurately', () => {
    expect(getStageNameArabic('secondary')).toBe('المرحلة الثانوية');
    expect(getGradeNameArabic('3_sec')).toContain('الثالث الثانوي');
    expect(getGradeNameArabic('1_prep')).toContain('الأول الإعدادي');
  });

  it('builds a hierarchical 6-tier taxonomy tree', () => {
    const mockSubjects: Subject[] = [
      {
        id: 'sub-phys-3sec',
        tenantId: 'tenant-1',
        nameAr: 'الفيزياء',
        stage: 'secondary',
        grade: '3_sec',
        createdAt: new Date().toISOString(),
      },
    ];

    const mockMaterials: Material[] = [
      {
        id: 'm1',
        tenantId: 'tenant-1',
        teacherId: 't1',
        stage: 'secondary',
        grade: '3_sec',
        subjectId: 'sub-phys-3sec',
        unitName: 'الوحدة الأولى: التيار الكهربي',
        lessonName: 'قانون أوم',
        title: 'مذكرة 1',
        fileUrl: '/m1.pdf',
        fileSizeBytes: 1000,
        fileType: 'application/pdf',
        wordCount: 300,
        indexStatus: 'indexed',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'm2',
        tenantId: 'tenant-1',
        teacherId: 't1',
        stage: 'secondary',
        grade: '3_sec',
        subjectId: 'sub-phys-3sec',
        unitName: 'الوحدة الأولى: التيار الكهربي',
        lessonName: 'قوانين كيرشوف',
        title: 'مذكرة 2',
        fileUrl: '/m2.pdf',
        fileSizeBytes: 2000,
        fileType: 'application/pdf',
        wordCount: 400,
        indexStatus: 'indexed',
        createdAt: new Date().toISOString(),
      },
    ];

    const tree = buildTaxonomyTree(mockMaterials, mockSubjects);

    expect(tree.length).toBe(3); // 3 stages
    const secStage = tree.find((s) => s.stageCode === 'secondary');
    expect(secStage).toBeDefined();
    expect(secStage?.totalMaterialsCount).toBe(2);

    const grade3 = secStage?.grades.find((g) => g.gradeCode === '3_sec');
    expect(grade3).toBeDefined();
    expect(grade3?.totalMaterialsCount).toBe(2);

    const subjectNode = grade3?.subjects.find((s) => s.subjectId === 'sub-phys-3sec');
    expect(subjectNode?.units.length).toBe(1);
    expect(subjectNode?.units[0].lessons.length).toBe(2);
  });
});
