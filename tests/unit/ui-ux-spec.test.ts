import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const SPEC_PATH = path.join(process.cwd(), 'docs/ui-ux-spec.md');

describe('UI/UX Specification & Page Map Completeness (docs/ui-ux-spec.md)', () => {
  it('exists and is non-empty', () => {
    expect(fs.existsSync(SPEC_PATH)).toBe(true);
    const content = fs.readFileSync(SPEC_PATH, 'utf8');
    expect(content.length).toBeGreaterThan(5000);
  });

  it('covers R4 design tokens, Cairo RTL, tabular-nums, KaTeX, reduced-motion, and immutable brand assets', () => {
    const spec = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const token of [
      '#0B132B',
      '#070B19',
      '#111A38',
      '#1C2541',
      '#0066FF',
      '#00A3FF',
      '#00C2FF',
      'Cairo',
      'dir="rtl"',
      '.tabular-nums',
      '.katex',
      'prefers-reduced-motion',
      'public/brand/yalla-center-icon.png',
      'public/brand/yalla-center-logo-dark.png',
      'public/brand/yalla-center-logo-light.png',
      'public/brand/yalla-center-wireframes.jpg',
    ]) {
      expect(spec).toContain(token);
    }
  });

  it('documents all 8 portals, public platform site, /site/[centerSlug], and /login', () => {
    const spec = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const portalOrRoute of [
      'Platform Owner',
      'Center Admin',
      'Branch Manager',
      'Receptionist',
      'Teacher',
      'Accountant',
      'Student',
      'Parent',
      '/login',
      '/site/[centerSlug]',
      '/owner',
      '/center/[centerSlug]',
      '/teacher/[centerSlug]',
      '/center/[centerSlug]/branch',
      '/center/[centerSlug]/reception',
      '/center/[centerSlug]/accountant',
      '/center/[centerSlug]/student-portal',
      '/center/[centerSlug]/parent-portal',
      '/center/[centerSlug]/website',
      '/center/[centerSlug]/settings',
      '/center/[centerSlug]/reports',
    ]) {
      expect(spec).toContain(portalOrRoute);
    }
  });

  it('documents RBAC matrix, multi-center isolation, teacher ownership, and self-photo whitelist', () => {
    const spec = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const contract of [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'RECEPTIONIST',
      'ACCOUNTANT',
      'TEACHER',
      'STUDENT',
      'PARENT',
      'memberships/{tenantId}_{uid}',
      'teacherId',
      'createdByUid',
      'validateProfilePhotoUpdate',
      'validateTeacherRateUpdate',
      'validateTeacherStatementAccess',
    ]) {
      expect(spec).toContain(contract);
    }
  });

  it('documents all 5 domain events, notification outbox, material 5-level folders, and financial engine', () => {
    const spec = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const entity of [
      'attendance.recorded',
      'grade.published',
      'payment.recorded',
      'group.updated',
      'material.published',
      'notification_outbox',
      'notification_deliveries',
      'audit_logs',
      'financial_audits',
      'lesson_grade_audits',
      'center_material_versions',
      'center_material_annotations',
      'stage -> grade -> subject -> unit -> lesson',
      'PricingModel',
      'SCHOLARSHIP_100',
    ]) {
      expect(spec).toContain(entity);
    }
  });

  it('includes complete Phase Dossiers for M1 through M6 with all 7 required subsections each', () => {
    const spec = fs.readFileSync(SPEC_PATH, 'utf8');
    for (const phase of ['Phase M1', 'Phase M2', 'Phase M3', 'Phase M4', 'Phase M5', 'Phase M6']) {
      expect(spec).toContain(phase);
    }

    const requiredSubsections = [
      '(a) Screens & Routes',
      '(b) User Workflows',
      '(c) Permission Matrix',
      '(d) Data Entities & Events',
      '(e) Components to Reuse',
      '(f) Files to Modify / Create',
      '(g) Acceptance Criteria',
    ];
    for (const sub of requiredSubsections) {
      const count = spec.split(sub).length - 1;
      expect(count).toBe(6);
    }
  });
});
