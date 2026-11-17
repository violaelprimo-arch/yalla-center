import { describe, expect, it } from 'vitest';
import { createCenterDataProvider } from '@/lib/dal/factory';
import { readMasterData } from '@/lib/dal/master-data';
import { buildGroup, normalizeGroupPricing, studentGroupFee } from '@/lib/timetable/group-schedule';
import { teacherInputSchema } from '@/lib/teachers/profile';
import type { Attendance, Session } from '@/lib/dal/types';

describe('Group-Level Teacher Accounting & Multi-Model Invariants', () => {
  const tenantId = 'tenant-maher-001';

  it('1 & 2 & 3: Teacher creation accepts multiple stages with zero forced financial values', () => {
    const validTeacherInput = {
      fullName: 'أ/ محمد إبراهيم التحريري',
      phone: '01012345678',
      phone2: '',
      avatarData: null,
      subjectIds: ['sub-math-3sec'],
      contracts: [
        { level: 'secondary', model: 'fixed_session', value: 0 },
        { level: 'preparatory', model: 'fixed_session', value: 0 },
      ],
      login: null,
      permissions: ['viewStudents', 'viewAccount'] as ('viewStudents' | 'viewAccount')[],
      tabs: ['account', 'students'] as ('account' | 'students')[],
    };

    const parsed = teacherInputSchema.safeParse(validTeacherInput);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.contracts).toHaveLength(2);
    expect(parsed.data.contracts.map((c) => c.level)).toEqual(['secondary', 'preparatory']);
  });

  it('4 & 5 & 6 & 7: Group pricing normalization validates all 4 accounting models cleanly', () => {
    // Model 1: Center (متوسط الحضور)
    const centerNorm = normalizeGroupPricing({
      model: 'center',
      teacherRate: 20,
      monthlyFee: 300,
    });
    expect(centerNorm.model).toBe('center');
    if (centerNorm.model === 'center') {
      expect(centerNorm.teacherRate).toBe(20);
      expect(centerNorm.monthlyFee).toBe(300);
    }
    expect(studentGroupFee({ pricing: centerNorm } as any)).toBe(300);

    // Model 2: Fixed session (أجر ثابت للحصة)
    const fixedNorm = normalizeGroupPricing({
      model: 'fixed_session',
      sessionFee: 250,
      centerFee: 50,
    });
    expect(fixedNorm.model).toBe('fixed_session');
    if (fixedNorm.model === 'fixed_session') {
      expect(fixedNorm.sessionFee).toBe(250);
      expect(fixedNorm.centerFee).toBe(50);
    }
    expect(studentGroupFee({ pricing: fixedNorm } as any)).toBe(250);

    // Model 3: Private percentage (نظام البرايفت - النسبة المئوية)
    const privateNorm = normalizeGroupPricing({
      model: 'private',
      monthlyFee: 500,
      teacherPercentage: 70,
      centerPercentage: 30,
    });
    expect(privateNorm.model).toBe('private');
    if (privateNorm.model === 'private') {
      expect(privateNorm.monthlyFee).toBe(500);
      expect(privateNorm.teacherPercentage).toBe(70);
      expect(privateNorm.centerPercentage).toBe(30);
    }
    expect(studentGroupFee({ pricing: privateNorm } as any)).toBe(500);

    // Model 4: Per attendee (أجر ثابت لكل طالب حاضر)
    const perAttendeeNorm = normalizeGroupPricing({
      model: 'per_attendee',
      ratePerStudent: 15,
      studentFee: 40,
    });
    expect(perAttendeeNorm.model).toBe('per_attendee');
    if (perAttendeeNorm.model === 'per_attendee') {
      expect(perAttendeeNorm.ratePerStudent).toBe(15);
      expect(perAttendeeNorm.studentFee).toBe(40);
    }
    expect(studentGroupFee({ pricing: perAttendeeNorm } as any)).toBe(40);
  });

  it('8 & 9 & 10: Teacher with multiple groups on different models calculates aggregated dues correctly', async () => {
    const dal = createCenterDataProvider(true);
    const teacherId = 'teacher-multi-test';
    const master = await readMasterData(dal, tenantId);
    const refs = {
      ...master,
      groups: dal.groups,
      classrooms: dal.classrooms,
      teachers: [{ id: teacherId, tenantId, fullName: 'أستاذ التجربة المتعددة', isActive: true, role: 'TEACHER' as const }],
    };

    // 1. Group 1: Center model (متوسط الحضور)
    const groupCenter = buildGroup(tenantId, {
      id: 'grp-center-1',
      version: 0,
      nameAr: 'مجموعة 1 سنتر',
      branchId: 'branch-nasr-city',
      stageId: 'secondary',
      gradeId: '3_sec',
      subjectId: 'sub-math-3sec',
      teacherId,
      weeklySlots: [{ id: 's1', scheduleDay: 0, startTime: '10:00', endTime: '12:00', classroomId: 'room-101' }],
      pricing: { model: 'center', teacherRate: 20, monthlyFee: 300 },
    }, refs);
    dal.groups.push(groupCenter);

    // 2. Group 2: Fixed session model (أجر ثابت للحصة)
    const groupFixed = buildGroup(tenantId, {
      id: 'grp-fixed-2',
      version: 0,
      nameAr: 'مجموعة 2 أجر ثابت',
      branchId: 'branch-nasr-city',
      stageId: 'secondary',
      gradeId: '3_sec',
      subjectId: 'sub-math-3sec',
      teacherId,
      weeklySlots: [{ id: 's2', scheduleDay: 1, startTime: '12:00', endTime: '14:00', classroomId: 'room-101' }],
      pricing: { model: 'fixed_session', sessionFee: 200, centerFee: 50 },
    }, refs);
    dal.groups.push(groupFixed);

    // 3. Group 3: Per attendee model (أجر لكل طالب حاضر)
    const groupAttendee = buildGroup(tenantId, {
      id: 'grp-attendee-3',
      version: 0,
      nameAr: 'مجموعة 3 لكل حاضر',
      branchId: 'branch-nasr-city',
      stageId: 'secondary',
      gradeId: '3_sec',
      subjectId: 'sub-math-3sec',
      teacherId,
      weeklySlots: [{ id: 's3', scheduleDay: 2, startTime: '14:00', endTime: '16:00', classroomId: 'room-101' }],
      pricing: { model: 'per_attendee', ratePerStudent: 10, studentFee: 30 },
    }, refs);
    dal.groups.push(groupAttendee);

    // Create completed sessions for Month 11, Year 2026
    const sessCenter: Session = {
      id: 'sess-c-1',
      tenantId,
      groupId: groupCenter.id,
      teacherId,
      sessionDate: '2026-11-01',
      startTime: '10:00',
      endTime: '12:00',
      status: 'completed',
      createdAt: '2026-11-01T00:00:00Z',
    };
    dal.sessions.push(sessCenter);

    // Add 40 attendees to Center session
    for (let i = 1; i <= 40; i++) {
      const att: Attendance = {
        id: `att-c-${i}`,
        tenantId,
        sessionId: sessCenter.id,
        studentId: `student-c-${i}`,
        status: 'present',
        scannedAt: '2026-11-01T10:15:00Z',
        verificationMethod: 'manual',
      };
      dal.attendance.push(att);
    }

    // 2 Fixed sessions -> 2 * 200 = 400 EGP
    dal.sessions.push({
      id: 'sess-f-1',
      tenantId,
      groupId: groupFixed.id,
      teacherId,
      sessionDate: '2026-11-02',
      startTime: '12:00',
      endTime: '14:00',
      status: 'completed',
      createdAt: '2026-11-02T00:00:00Z',
    });
    dal.sessions.push({
      id: 'sess-f-2',
      tenantId,
      groupId: groupFixed.id,
      teacherId,
      sessionDate: '2026-11-09',
      startTime: '12:00',
      endTime: '14:00',
      status: 'completed',
      createdAt: '2026-11-09T00:00:00Z',
    });

    // 1 Attendee session with 25 students -> 25 * 10 = 250 EGP
    const sessAtt: Session = {
      id: 'sess-a-1',
      tenantId,
      groupId: groupAttendee.id,
      teacherId,
      sessionDate: '2026-11-03',
      startTime: '14:00',
      endTime: '16:00',
      status: 'completed',
      createdAt: '2026-11-03T00:00:00Z',
    };
    dal.sessions.push(sessAtt);
    for (let i = 1; i <= 25; i++) {
      const att: Attendance = {
        id: `att-a-${i}`,
        tenantId,
        sessionId: sessAtt.id,
        studentId: `student-a-${i}`,
        status: 'present',
        scannedAt: '2026-11-03T14:15:00Z',
        verificationMethod: 'manual',
      };
      dal.attendance.push(att);
    }

    // Calculate monthly payroll statement
    const statement = await dal.calculateMonthlyTeacherPayroll({
      tenantId,
      teacherId,
      month: 11,
      year: 2026,
    });

    // Verify Center group compensation: 40 average attendance * 20 = 800 EGP
    const centerGroupStatement = statement.centerSubscription.groups.find((g) => g.groupId === groupCenter.id);
    expect(centerGroupStatement).toBeDefined();
    expect(centerGroupStatement?.compensationAmount).toBe(800);

    // Verify Fixed sessions: 2 sessions * 200 = 400 EGP
    const fixedSessions = (statement.lessonCompensation?.sessions ?? []).filter((s) => s.groupName === groupFixed.nameAr);
    expect(fixedSessions).toHaveLength(2);
    const fixedDue = fixedSessions.reduce((sum, s) => sum + s.teacherDue, 0);
    expect(fixedDue).toBe(400);

    // Verify Per Attendee session: 25 students * 10 = 250 EGP
    const attendeeSessions = (statement.lessonCompensation?.sessions ?? []).filter((s) => s.groupName === groupAttendee.nameAr);
    expect(attendeeSessions).toHaveLength(1);
    expect(attendeeSessions[0].teacherDue).toBe(250);

    // Gross compensation = 800 + 400 + 250 = 1450 EGP
    expect(statement.summary.grossCompensation).toBe(1450);
  });

  it('11 & 14: Teacher change preserves historical sessions and compensation for previous teacher', async () => {
    const dal = createCenterDataProvider(true);
    const teacherA = 'teacher-orig-A';
    const teacherB = 'teacher-repl-B';
    const master = await readMasterData(dal, tenantId);
    const refs = {
      ...master,
      groups: dal.groups,
      classrooms: dal.classrooms,
      teachers: [
        { id: teacherA, tenantId, fullName: 'المعلم الأصلي أ', isActive: true, role: 'TEACHER' as const },
        { id: teacherB, tenantId, fullName: 'المعلم البديل ب', isActive: true, role: 'TEACHER' as const },
      ],
    };

    // Group created with Teacher A on Nov 1
    const groupA = buildGroup(tenantId, {
      id: 'grp-transfer-test',
      version: 0,
      nameAr: 'مجموعة نقل المعلم',
      branchId: 'branch-nasr-city',
      stageId: 'secondary',
      gradeId: '3_sec',
      subjectId: 'sub-math-3sec',
      teacherId: teacherA,
      weeklySlots: [{ id: 'slot-t', scheduleDay: 0, startTime: '10:00', endTime: '12:00', classroomId: 'room-101' }],
      pricing: { model: 'fixed_session', sessionFee: 300, centerFee: 50 },
    }, refs, new Date('2026-11-01T08:00:00Z'));
    dal.groups.push(groupA);

    // Session 1 conducted under Teacher A on Nov 5
    dal.sessions.push({
      id: 'sess-transfer-1',
      tenantId,
      groupId: groupA.id,
      teacherId: teacherA,
      sessionDate: '2026-11-05',
      startTime: '10:00',
      endTime: '12:00',
      status: 'completed',
      createdAt: '2026-11-05T00:00:00Z',
    });

    // Group assigned to Teacher B with new pricing on Nov 10
    const groupB = buildGroup(tenantId, {
      id: groupA.id,
      version: 1,
      nameAr: 'مجموعة نقل المعلم',
      branchId: 'branch-nasr-city',
      stageId: 'secondary',
      gradeId: '3_sec',
      subjectId: 'sub-math-3sec',
      teacherId: teacherB,
      weeklySlots: [{ id: 'slot-t', scheduleDay: 0, startTime: '10:00', endTime: '12:00', classroomId: 'room-101' }],
      pricing: { model: 'fixed_session', sessionFee: 350, centerFee: 50 },
    }, { ...refs, groups: [groupA] }, new Date('2026-11-10T08:00:00Z'));
    // Replace in dal.groups
    const idx = dal.groups.findIndex((g) => g.id === groupA.id);
    dal.groups[idx] = groupB;

    // Session 2 conducted under Teacher B
    dal.sessions.push({
      id: 'sess-transfer-2',
      tenantId,
      groupId: groupB.id,
      teacherId: teacherB,
      sessionDate: '2026-11-12',
      startTime: '10:00',
      endTime: '12:00',
      status: 'completed',
      createdAt: '2026-11-12T00:00:00Z',
    });

    // Calculate payroll for Teacher A -> Should have 300 EGP from Session 1
    const stmtA = await dal.calculateMonthlyTeacherPayroll({
      tenantId,
      teacherId: teacherA,
      month: 11,
      year: 2026,
    });
    expect(stmtA.summary.grossCompensation).toBe(300);

    // Calculate payroll for Teacher B -> Should have 350 EGP from Session 2
    const stmtB = await dal.calculateMonthlyTeacherPayroll({
      tenantId,
      teacherId: teacherB,
      month: 11,
      year: 2026,
    });
    expect(stmtB.summary.grossCompensation).toBe(350);
  });

  it('Disbursement recording correctly updates teacher net remaining', async () => {
    const dal = createCenterDataProvider(true);
    const teacherId = 'teacher-payout-test';
    const master = await readMasterData(dal, tenantId);
    const refs = {
      ...master,
      groups: dal.groups,
      classrooms: dal.classrooms,
      teachers: [{ id: teacherId, tenantId, fullName: 'معلم الصرف', isActive: true, role: 'TEACHER' as const }],
    };

    const group = buildGroup(tenantId, {
      id: 'grp-disburse',
      version: 0,
      nameAr: 'مجموعة الصرف',
      branchId: 'branch-nasr-city',
      stageId: 'secondary',
      gradeId: '3_sec',
      subjectId: 'sub-math-3sec',
      teacherId,
      weeklySlots: [{ id: 's-d', scheduleDay: 0, startTime: '10:00', endTime: '12:00', classroomId: 'room-101' }],
      pricing: { model: 'fixed_session', sessionFee: 500, centerFee: 50 },
    }, refs);
    dal.groups.push(group);

    dal.sessions.push({
      id: 'sess-disburse-1',
      tenantId,
      groupId: group.id,
      teacherId,
      sessionDate: '2026-11-01',
      startTime: '10:00',
      endTime: '12:00',
      status: 'completed',
      createdAt: '2026-11-01T00:00:00Z',
    });

    // Gross = 500 EGP, Net = 500 EGP before payout
    let stmt = await dal.calculateMonthlyTeacherPayroll({
      tenantId,
      teacherId,
      month: 11,
      year: 2026,
    });
    expect(stmt.summary.netPayrollInvoiced).toBe(500);

    // Record an advance payment of 200 EGP
    await dal.recordTeacherAdvance({
      tenantId,
      teacherId,
      amount: 200,
      reason: 'دفعة نقدية تحت الحساب',
      disbursedByUserId: 'user-admin',
    });

    // Net remaining should now be 500 - 200 = 300 EGP
    stmt = await dal.calculateMonthlyTeacherPayroll({
      tenantId,
      teacherId,
      month: 11,
      year: 2026,
    });
    expect(stmt.summary.totalAdvances).toBe(200);
    expect(stmt.summary.netPayrollInvoiced).toBe(300);
  });
});
