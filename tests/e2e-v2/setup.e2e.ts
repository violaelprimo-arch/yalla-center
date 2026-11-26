import '../setup';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const ENV_KEYS = [
  'NODE_ENV',
  'INTEGRITY_MODE',
  'DATA_PROVIDER_MODE',
  'FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_APP_URL',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
] as const;

let envSnapshot: Record<string, string | undefined> = {};

// Mutable navigation state shared with ui-harness.tsx
export interface NextNavigationMockState {
  pathname: string;
  query: Record<string, string>;
  params: Record<string, string | string[]>;
  push: ReturnType<typeof vi.fn>;
  replace: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  back: ReturnType<typeof vi.fn>;
  forward: ReturnType<typeof vi.fn>;
  prefetch: ReturnType<typeof vi.fn>;
}

const DEFAULT_NAV_STATE: NextNavigationMockState = {
  pathname: '/center/al-maher',
  query: {},
  params: { centerSlug: 'al-maher' },
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  prefetch: vi.fn(),
};

const NAV_GLOBAL_KEY = '__YC_E2E_NEXT_NAV_STATE__';
(globalThis as Record<string, unknown>)[NAV_GLOBAL_KEY] = {
  ...DEFAULT_NAV_STATE,
};

export function getNextNavigationMockState(): NextNavigationMockState {
  return (globalThis as Record<string, unknown>)[NAV_GLOBAL_KEY] as NextNavigationMockState;
}

export function resetNextNavigationMockState(): void {
  const current = getNextNavigationMockState();
  current.pathname = '/center/al-maher';
  current.query = {};
  current.params = { centerSlug: 'al-maher' };
  current.push = vi.fn();
  current.replace = vi.fn();
  current.refresh = vi.fn();
  current.back = vi.fn();
  current.forward = vi.fn();
  current.prefetch = vi.fn();
}

vi.mock('next/navigation', () => {
  return {
    usePathname: () => getNextNavigationMockState().pathname,
    useParams: () => getNextNavigationMockState().params,
    useSearchParams: () => new URLSearchParams(getNextNavigationMockState().query),
    useRouter: () => {
      const s = getNextNavigationMockState();
      return {
        push: s.push,
        replace: s.replace,
        refresh: s.refresh,
        back: s.back,
        forward: s.forward,
        prefetch: s.prefetch,
      };
    },
    redirect: vi.fn((url: string) => {
      throw new Error(`NEXT_REDIRECT:${url}`);
    }),
    notFound: vi.fn(() => {
      throw new Error('NEXT_NOT_FOUND');
    }),
  };
});

// Media query state shared with ui-harness.tsx
export interface MatchMediaMockState {
  prefersReducedMotion: boolean;
  prefersDarkColorScheme: boolean;
  viewportWidth: number;
}

const MEDIA_GLOBAL_KEY = '__YC_E2E_MEDIA_STATE__';
(globalThis as Record<string, unknown>)[MEDIA_GLOBAL_KEY] = {
  prefersReducedMotion: false,
  prefersDarkColorScheme: false,
  viewportWidth: 1280,
} satisfies MatchMediaMockState;

export function getMatchMediaMockState(): MatchMediaMockState {
  return (globalThis as Record<string, unknown>)[MEDIA_GLOBAL_KEY] as MatchMediaMockState;
}

function installDomShims(): void {
  if (typeof window !== 'undefined') {
    window.matchMedia = vi.fn((query: string): MediaQueryList => {
      const state = getMatchMediaMockState();
      let matches = false;
      if (query.includes('prefers-reduced-motion: reduce')) {
        matches = state.prefersReducedMotion;
      } else if (query.includes('prefers-color-scheme: dark')) {
        matches = state.prefersDarkColorScheme;
      } else {
        const minMatch = query.match(/min-width:\s*(\d+)px/);
        const maxMatch = query.match(/max-width:\s*(\d+)px/);
        if (minMatch && maxMatch) {
          matches =
            state.viewportWidth >= Number(minMatch[1]) &&
            state.viewportWidth <= Number(maxMatch[1]);
        } else if (minMatch) {
          matches = state.viewportWidth >= Number(minMatch[1]);
        } else if (maxMatch) {
          matches = state.viewportWidth <= Number(maxMatch[1]);
        }
      }
      return {
        matches,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(() => true),
      };
    });
  }

  if (typeof HTMLDialogElement !== 'undefined') {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  }

  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}

installDomShims();

beforeEach(() => {
  envSnapshot = {};
  for (const key of ENV_KEYS) {
    envSnapshot[key] = process.env[key];
  }
  const media = getMatchMediaMockState();
  media.prefersReducedMotion = false;
  media.prefersDarkColorScheme = false;
  media.viewportWidth = 1280;
  resetNextNavigationMockState();
  installDomShims();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  for (const key of ENV_KEYS) {
    const prev = envSnapshot[key];
    if (prev === undefined) {
      delete process.env[key];
    } else {
      (process.env as Record<string, string | undefined>)[key] = prev;
    }
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function') {
    localStorage.clear();
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.classList.remove('dark');
    document.documentElement.removeAttribute('dir');
    document.documentElement.removeAttribute('lang');
  }
});
