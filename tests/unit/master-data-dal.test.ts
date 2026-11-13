import { describe, it, expect, beforeEach } from 'vitest';
import { MockDataProvider } from '@/lib/dal/mock-data';

describe('Master Data DAL (MockDataProvider)', () => {
  let dal: MockDataProvider;
  const tenantId = 'tenant-maher-001';

  beforeEach(() => {
    dal = new MockDataProvider();
  });

  describe('Branches Master Data', () => {
    it('returns seeded branches for the tenant', async () => {
      const branches = await dal.getBranches(tenantId);
      expect(branches.length).toBeGreaterThan(0);
      expect(branches[0]).toHaveProperty('nameAr');
      expect(branches[0].tenantId).toBe(tenantId);
    });

    it('creates a new branch with valid input', async () => {
      const newBranch = await dal.saveBranch(tenantId, {
        nameAr: 'فرع التجمع الخامس',
        address: 'شارع التسعين الجنوبي',
        phone: '01011112222',
        isActive: true,
      });

      expect(newBranch.id).toBeDefined();
      expect(newBranch.nameAr).toBe('فرع التجمع الخامس');
      expect(newBranch.address).toBe('شارع التسعين الجنوبي');
      expect(newBranch.phone).toBe('01011112222');

      const branches = await dal.getBranches(tenantId);
      expect(branches.some((b) => b.id === newBranch.id)).toBe(true);
    });

    it('updates an existing branch while strictly preserving its ID', async () => {
      const branches = await dal.getBranches(tenantId);
      const original = branches[0];

      const updated = await dal.saveBranch(tenantId, {
        id: original.id,
        nameAr: 'الفرع الرئيسي المحدث',
        address: 'العنوان الجديد',
        phone: '01099998888',
      });

      expect(updated.id).toBe(original.id);
      expect(updated.nameAr).toBe('الفرع الرئيسي المحدث');

      const reloaded = (await dal.getBranches(tenantId)).find((b) => b.id === original.id);
      expect(reloaded?.nameAr).toBe('الفرع الرئيسي المحدث');
    });

    it('requires branch name', async () => {
      await expect(
        dal.saveBranch(tenantId, {
          nameAr: '   ',
        })
      ).rejects.toThrow('اسم الفرع مطلوب');
    });

    it('blocks branch deletion when classrooms are attached', async () => {
      const branches = await dal.getBranches(tenantId);
      const branchWithRooms = branches.find((b) =>
        dal.classrooms.some((c) => c.tenantId === tenantId && c.branchId === b.id)
      );
      expect(branchWithRooms).toBeDefined();

      const result = await dal.deleteBranch(tenantId, branchWithRooms!.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('قاعات مرتبطة به');
    });

    it('deletes branch successfully when no classrooms or groups are attached', async () => {
      const emptyBranch = await dal.saveBranch(tenantId, {
        nameAr: 'فرع بدون قاعات',
      });

      const result = await dal.deleteBranch(tenantId, emptyBranch.id);
      expect(result.success).toBe(true);

      const branches = await dal.getBranches(tenantId);
      expect(branches.some((b) => b.id === emptyBranch.id)).toBe(false);
    });
  });

  describe('Educational Stages & Grades Master Data', () => {
    it('initializes default stages preserving exact legacy IDs and order', async () => {
      const stages = await dal.getStages(tenantId);
      expect(stages.length).toBe(3);

      const stageIds = stages.map((s) => s.id);
      expect(stageIds).toEqual(['primary', 'preparatory', 'secondary']);

      const secondary = stages.find((s) => s.id === 'secondary');
      expect(secondary).toBeDefined();
      expect(secondary?.grades.map((g) => g.id)).toEqual(['1_sec', '2_sec', '3_sec']);

      const thirdSec = secondary?.grades.find((g) => g.id === '3_sec');
      expect(thirdSec?.hasDivisions).toBe(true);
      expect(thirdSec?.divisions?.length).toBe(3);
    });

    it('creates a new stage with unique name', async () => {
      const newStage = await dal.saveStage(tenantId, {
        nameAr: 'مرحلة رياض الأطفال (KG)',
        order: 0,
      });

      expect(newStage.id).toBeDefined();
      expect(newStage.nameAr).toBe('مرحلة رياض الأطفال (KG)');

      const stages = await dal.getStages(tenantId);
      expect(stages.some((s) => s.id === newStage.id)).toBe(true);
    });

    it('rejects duplicate stage name', async () => {
      await expect(
        dal.saveStage(tenantId, {
          nameAr: 'المرحلة الثانوية',
        })
      ).rejects.toThrow('توجد مرحلة تعليمية بنفس الاسم بالفعل');
    });

    it('blocks stage deletion when subjects or students are associated', async () => {
      const result = await dal.deleteStage(tenantId, 'secondary');
      expect(result.success).toBe(false);
      expect(result.error).toContain('مواد دراسية');
    });

    it('creates a new grade inside a stage', async () => {
      const newGrade = await dal.saveGrade(tenantId, {
        stageId: 'primary',
        nameAr: 'صف تمهيدي إضافي',
        order: 7,
      });

      expect(newGrade.id).toBeDefined();
      expect(newGrade.stageId).toBe('primary');

      const stages = await dal.getStages(tenantId);
      const primary = stages.find((s) => s.id === 'primary');
      expect(primary?.grades.some((g) => g.id === newGrade.id)).toBe(true);
    });

    it('rejects duplicate grade name inside the same stage', async () => {
      await expect(
        dal.saveGrade(tenantId, {
          stageId: 'secondary',
          nameAr: 'الصف الثالث الثانوي',
        })
      ).rejects.toThrow('يوجد صف بنفس الاسم في هذه المرحلة بالفعل');
    });

    it('blocks grade deletion when subjects or students are linked', async () => {
      const result = await dal.deleteGrade(tenantId, '3_sec');
      expect(result.success).toBe(false);
      expect(result.error).toContain('مواد دراسية');
    });
  });

  describe('Subjects Master Data & Duplicate Rules', () => {
    it('returns subjects filtered by stage and grade', async () => {
      const allSubjects = await dal.getSubjects(tenantId);
      expect(allSubjects.length).toBeGreaterThan(0);

      const secondarySubjects = await dal.getSubjects(tenantId, { stage: 'secondary' });
      expect(secondarySubjects.every((s) => s.stage === 'secondary')).toBe(true);

      const thirdSecSubjects = await dal.getSubjects(tenantId, { grade: '3_sec' });
      expect(thirdSecSubjects.every((s) => s.grade === '3_sec')).toBe(true);
    });

    it('allows the same subject name across different grades', async () => {
      const mathPrep = await dal.saveSubject(tenantId, {
        nameAr: 'اللغة الإنجليزية التأسيسية',
        code: 'ENG-PREP',
        stage: 'preparatory',
        grade: '1_prep',
      });
      expect(mathPrep.id).toBeDefined();

      // Same name in different grade (secondary / 1_sec) MUST be allowed
      const mathSec = await dal.saveSubject(tenantId, {
        nameAr: 'اللغة الإنجليزية التأسيسية',
        code: 'ENG-SEC',
        stage: 'secondary',
        grade: '1_sec',
      });
      expect(mathSec.id).toBeDefined();
      expect(mathSec.id).not.toBe(mathPrep.id);
    });

    it('strictly prohibits duplicate subject names within the same grade', async () => {
      await dal.saveSubject(tenantId, {
        nameAr: 'الفيزياء المتقدمة',
        stage: 'secondary',
        grade: '3_sec',
      });

      await expect(
        dal.saveSubject(tenantId, {
          nameAr: 'الفيزياء المتقدمة',
          stage: 'secondary',
          grade: '3_sec',
        })
      ).rejects.toThrow('يوجد مادة بنفس الاسم في هذا الصف بالفعل');
    });

    it('blocks deleting a subject that has groups attached', async () => {
      const subjects = await dal.getSubjects(tenantId);
      const subjectWithGroup = subjects.find((s) =>
        dal.groups.some((g) => g.tenantId === tenantId && g.subjectId === s.id)
      );
      expect(subjectWithGroup).toBeDefined();

      const result = await dal.deleteSubject(tenantId, subjectWithGroup!.id);
      expect(result.success).toBe(false);
      expect(result.error).toContain('مجموعات مرتبطة بها');
    });
  });
});
