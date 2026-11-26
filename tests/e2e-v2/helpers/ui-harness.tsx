import * as React from 'react';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { expect } from 'vitest';
import { render, type RenderResult } from '@testing-library/react';
import { resolveRepoPath, requireRepoModule } from './module-loader';
import {
  getMatchMediaMockState,
  getNextNavigationMockState,
} from '../setup.e2e';

export interface BrandAssetBaseline {
  path: string;
  byteLength: number;
  sha256: string;
}

export const BRAND_ASSET_BASELINES: readonly BrandAssetBaseline[] = [
  {
    path: 'public/brand/yalla-center-icon.png',
    byteLength: 138885,
    sha256: 'A669BE7CA7D4CAD20D7F8431D0E27532CA2D76DCB1BBDBFE6345DA36C42B27BB',
  },
  {
    path: 'public/brand/yalla-center-logo-dark.png',
    byteLength: 99378,
    sha256: 'DE5E3647F161F1634C6DAD015016D3CDF64F21EBA75464F160AAF9D4FB90C3A7',
  },
  {
    path: 'public/brand/yalla-center-logo-light.png',
    byteLength: 81901,
    sha256: '0A49C7F8197134F736749C1EBEC442520AE5B444B94A5CB333BEA44F34DD7E7A',
  },
  {
    path: 'public/brand/yalla-center-wireframes.jpg',
    byteLength: 341920,
    sha256: '8D611B96EA0C164BD34AEDF571C5A630072F9E4A944742CC1F3237D9D3BF970B',
  },
] as const;

export function assertBrandAssetsUnmodified(): void {
  for (const asset of BRAND_ASSET_BASELINES) {
    const absPath = resolveRepoPath(asset.path);
    expect(
      fs.existsSync(absPath),
      `Official brand asset missing: ${asset.path}`
    ).toBe(true);
    const bytes = fs.readFileSync(absPath);
    expect(
      bytes.byteLength,
      `Brand asset byte length modified: ${asset.path}`
    ).toBe(asset.byteLength);
    const digest = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
    expect(
      digest,
      `Brand asset SHA-256 modified: ${asset.path}`
    ).toBe(asset.sha256);
  }
}

export function setViewportWidth(px: number): void {
  getMatchMediaMockState().viewportWidth = px;
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: px,
    });
    Object.defineProperty(window, 'outerWidth', {
      configurable: true,
      writable: true,
      value: px,
    });
    if (document.documentElement) {
      Object.defineProperty(document.documentElement, 'clientWidth', {
        configurable: true,
        writable: true,
        value: px,
      });
    }
    window.dispatchEvent(new Event('resize'));
  }
}

export function setReducedMotion(enabled: boolean): void {
  getMatchMediaMockState().prefersReducedMotion = enabled;
}

export function setTheme(mode: 'dark' | 'light'): void {
  getMatchMediaMockState().prefersDarkColorScheme = mode === 'dark';
  if (typeof document !== 'undefined' && document.documentElement) {
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    localStorage.setItem('yalla-theme', mode);
  }
}

export interface RenderWithNextContextOptions {
  pathname?: string;
  query?: Record<string, string>;
  params?: Record<string, string | string[]>;
  tenant?: Record<string, unknown>;
  branches?: Array<Record<string, unknown>>;
  initialUsers?: Array<Record<string, unknown>>;
}

export async function renderWithNextContext(
  ui: React.ReactElement,
  options: RenderWithNextContextOptions = {}
): Promise<RenderResult> {
  const nav = getNextNavigationMockState();
  if (options.pathname !== undefined) nav.pathname = options.pathname;
  if (options.query !== undefined) nav.query = options.query;
  if (options.params !== undefined) nav.params = options.params;

  let element = ui;
  if (options.tenant) {
    const mod = await requireRepoModule<{
      TenantProvider: React.ComponentType<{
        tenant: Record<string, unknown>;
        branches: Array<Record<string, unknown>>;
        initialUsers: Array<Record<string, unknown>>;
        children?: React.ReactNode;
      }>;
    }>('components/layout/tenant-provider.tsx');
    const TenantProvider = mod.TenantProvider;
    element = React.createElement(
      TenantProvider,
      {
        tenant: options.tenant,
        branches: options.branches ?? [],
        initialUsers: options.initialUsers ?? [],
      },
      ui
    );
  }

  return render(element);
}
