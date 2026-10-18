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
