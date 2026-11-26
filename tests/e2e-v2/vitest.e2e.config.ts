import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [path.resolve(__dirname, 'setup.e2e.ts')],
    include: ['tests/e2e-v2/suites/**/*.e2e.{ts,tsx}'],
    alias: {
      '@': path.resolve(__dirname, '../../'),
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../'),
    },
  },
});
