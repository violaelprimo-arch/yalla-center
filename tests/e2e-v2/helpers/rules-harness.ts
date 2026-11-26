import fs from 'node:fs';
import { expect } from 'vitest';
import { resolveRepoPath } from './module-loader';

export function loadFirestoreRulesText(): string {
  const abs = resolveRepoPath('firestore.rules');
  expect(fs.existsSync(abs), 'firestore.rules must exist at repository root').toBe(true);
  return fs.readFileSync(abs, 'utf8');
}

export function extractRuleMatchBlock(rulesText: string, collectionName: string): string {
  const escaped = collectionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matcher = new RegExp(`match\\s+/${escaped}/\\{[^}]+\\}\\s*\\{`, 'm');
  const match = matcher.exec(rulesText);
  if (!match || match.index === undefined) {
    return '';
  }

  const startIdx = match.index;
  const openBraceIdx = startIdx + match[0].length - 1;
  let depth = 0;
  for (let i = openBraceIdx; i < rulesText.length; i += 1) {
    const ch = rulesText[i];
    if (ch === '{') {
      depth += 1;
    } else if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return rulesText.slice(startIdx, i + 1);
      }
    }
  }
  return rulesText.slice(startIdx);
}

export function assertRulesBlock(
  pattern: RegExp | string,
  description: string,
  rulesText = loadFirestoreRulesText()
): void {
  if (typeof pattern === 'string') {
    expect(rulesText.includes(pattern), `firestore.rules missing invariant: ${description}`).toBe(
      true
    );
  } else {
    expect(pattern.test(rulesText), `firestore.rules missing invariant: ${description}`).toBe(true);
  }
}

export function assertRulesNoPublicReadOn(
  collections: string[],
  rulesText = loadFirestoreRulesText()
): void {
  for (const col of collections) {
    const block = extractRuleMatchBlock(rulesText, col);
    expect(block, `Expected match block for collection /${col}/{id} in firestore.rules`).not.toBe('');
    const hasPublicRead = /allow\s+(?:read|get|list)[^;]*:\s*if\s+true\s*;/.test(block);
    expect(
      hasPublicRead,
      `Collection /${col} must NOT allow unauthenticated public read (allow read: if true;)`
    ).toBe(false);
  }
}

export function assertRulesCollectionImmutable(
  collectionName: string,
  rulesText = loadFirestoreRulesText()
): void {
  const block = extractRuleMatchBlock(rulesText, collectionName);
  expect(
    block,
    `Expected immutable audit collection /${collectionName}/{id} in firestore.rules`
  ).not.toBe('');
  const combinedDeny = /allow\s+(?:update\s*,\s*delete|delete\s*,\s*update)\s*:\s*if\s+false\s*;/.test(
    block
  );
  const separateDeny =
    /allow\s+update\s*:\s*if\s+false\s*;/.test(block) &&
    /allow\s+delete\s*:\s*if\s+false\s*;/.test(block);
  expect(
    combinedDeny || separateDeny,
    `Collection /${collectionName} must enforce immutable append-only rules (allow update, delete: if false;)`
  ).toBe(true);
}

export function assertRulesNoSelfBootstrapOnStaffMemberships(
  rulesText = loadFirestoreRulesText()
): void {
  const block = extractRuleMatchBlock(rulesText, 'staff_memberships');
  if (!block) return;
  const allowsSelfCreate =
    /allow\s+create[^;]*request\.auth\.uid\s*==\s*uid/.test(block) ||
    /allow\s+write[^;]*request\.auth\.uid\s*==\s*uid/.test(block);
  expect(
    allowsSelfCreate,
    'staff_memberships must NOT allow any signed-in user to self-create (request.auth.uid == uid)'
  ).toBe(false);
}

export function assertRulesTeacherOwnershipOn(
  collectionName: string,
  rulesText = loadFirestoreRulesText()
): void {
  const block = extractRuleMatchBlock(rulesText, collectionName);
  expect(
    block,
    `Expected match block for teacher-owned collection /${collectionName}/{id}`
  ).not.toBe('');
  const hasTeacherOwnership =
    /teacherId/.test(block) || /createdByUid/.test(block) || /matchesTeacher/.test(block);
  expect(
    hasTeacherOwnership,
    `Collection /${collectionName} must enforce teacher ownership checks (teacherId / createdByUid)`
  ).toBe(true);
}
