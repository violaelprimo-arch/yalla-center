import fs from 'node:fs';
import path from 'node:path';
import { expect } from 'vitest';

export function resolveRepoPath(repoRelativePath: string): string {
  return path.resolve(process.cwd(), repoRelativePath);
}

export function assertRepoFileExists(repoRelativePath: string): string {
  const abs = resolveRepoPath(repoRelativePath);
  expect(
    fs.existsSync(abs),
    `Expected deliverable file to exist: ${repoRelativePath}`
  ).toBe(true);
  return abs;
}

export function readRepoFileText(repoRelativePath: string): string {
  const abs = assertRepoFileExists(repoRelativePath);
  return fs.readFileSync(abs, 'utf8');
}

export async function requireRepoModule<T = Record<string, any>>(
  repoRelativePath: string
): Promise<T> {
  const abs = assertRepoFileExists(repoRelativePath);
  // Normalize backslashes on Windows so Vite's module graph transforms TS/TSX and @/ aliases cleanly.
  const specifier = abs.replace(/\\/g, '/');
  const mod = await import(/* @vite-ignore */ specifier);
  return mod as T;
}
