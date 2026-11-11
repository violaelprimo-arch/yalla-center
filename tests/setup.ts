/**
 * Global Test Setup for Yalla Center Test Suite
 * Configures environment variables, sandboxed execution defaults,
 * and test lifecycle hooks.
 */

import '@testing-library/jest-dom';
import { beforeAll, afterAll } from 'vitest';

(process.env as Record<string, string | undefined>).NODE_ENV = 'test';
process.env.INTEGRITY_MODE = 'demo';
process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';

// Node 25/26 exposes a global `localStorage` getter that evaluates to undefined without `--localstorage-file`.
// Provide an in-memory Web Storage polyfill for Vitest when `globalThis.localStorage` is unavailable or incomplete.
if (
  typeof globalThis.localStorage === 'undefined' ||
  typeof globalThis.localStorage?.getItem !== 'function'
) {
  const backingStore = new Map<string, string>();
  const storageShim: Storage = {
    get length() {
      return backingStore.size;
    },
    clear() {
      backingStore.clear();
    },
    getItem(key: string) {
      return backingStore.has(String(key)) ? backingStore.get(String(key))! : null;
    },
    key(index: number) {
      return Array.from(backingStore.keys())[index] ?? null;
    },
    removeItem(key: string) {
      backingStore.delete(String(key));
    },
    setItem(key: string, value: string) {
      backingStore.set(String(key), String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: storageShim,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      writable: true,
      value: storageShim,
    });
  }
}

// Global error handler suppression for expected intentional test errors
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress expected HTTP 403 test output logs to keep test output clean
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('FORBIDDEN') ||
        args[0].includes('403') ||
        args[0].includes('UNINDEXED_SOURCE_DOCUMENTS') ||
        args[0].includes('INSUFFICIENT_SOURCE_DOCUMENTS'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
});

afterAll(() => {
  console.error = originalConsoleError;
});
