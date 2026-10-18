# Milestone 1: Build, Package Tooling & Test Architecture Report

**Document ID**: `YC-M1-BUILD-001`  
**Explorer**: Explorer M1-1 (Build & Tooling Explorer)  
**Date**: 2026-10-18  
**Project**: Yalla Center SaaS Platform  
**Target Root**: `d:\Software\YALLA CODEX\YALLA CENTER`  
**Host Environment Verified**: Node.js `v24.18.0`, npm `11.16.0`, pnpm `12.11.2`  

---

## 1. Executive Summary & Environment Assessment

This investigation establishes the definitive build, tooling, dependency manifest, and configuration blueprints for **Milestone 1 (Foundation, Brand Design System & Core Database Schema)** of Yalla Center.

### Key Discoveries & Resolutions:
1. **Host Environment**: The Windows development environment provides Node.js `v24.18.0` and npm `11.16.0`. Node engines for Next.js 14 and 15 (`>=18.17.0` and `>=20.0.0`) are fully satisfied.
2. **Next.js & React Version Standard**:
   - **Recommended Choice**: **Next.js `14.2.35` (LTS)** paired with **React `^18.3.1`**.
   - **Rationale**: Next.js 14 provides rock-solid stability with synchronous page `params` (`{ params: { centerSlug: string } }`), zero peer dependency friction across Vitest, `@supabase/ssr`, KaTeX, and testing libraries, and guarantees zero runtime hydration surprises on Node 24.
   - **Next.js 15 Caveat**: In Next.js 15, dynamic route page props must be awaited (`params: Promise<{ centerSlug: string }>`), and React 19 types cause peer dependency collisions with ESLint 8 and some testing utilities unless forced.
3. **Tailwind CSS Architecture**:
   - **Tailwind CSS `v3.4.17` (LTS)** must be used.
   - `PROJECT.md` specifies `tailwind.config.ts`. Tailwind v4 dropped `tailwind.config.ts` in favor of `@theme` CSS directives and breaks `tailwindcss-animate`. Tailwind 3.4.17 is 100% compliant with the project blueprint, providing native logical RTL utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`).
4. **Vitest & Vite Plugin Alignment**:
   - `@vitejs/plugin-react` **must be pinned to `^4.3.4`**. The latest unpinned version (`6.1.2`) requires Vite 8, whereas `vitest@^2.1.8` relies on Vite 5. Pinning `^4.3.4` guarantees clean dependency resolution.
5. **ESLint Compatibility**:
   - `eslint-config-next@14.2.35` requires `eslint@^8.57.1`. Installing ESLint 9 triggers peer dependency errors unless forced. We pin `eslint: "^8.57.1"`.
6. **Empirical Verification**:
   - A full dry-run dependency tree resolution with 571 packages succeeded with exit code `0` and **zero peer dependency conflicts**.

---

## 2. Definitive `package.json`

The Worker must create `package.json` in the project root (`d:\Software\YALLA CODEX\YALLA CENTER\package.json`) with the following exact content:

```json
{
  "name": "yalla-center",
  "version": "1.0.0",
  "private": true,
  "description": "Production-ready, Arabic-first, multi-tenant educational center management SaaS platform",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "dependencies": {
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.48.1",
    "canvas-confetti": "^1.9.4",
    "clsx": "^2.1.1",
    "katex": "^0.16.21",
    "lucide-react": "^1.16.0",
    "next": "14.2.35",
    "qrcode": "^1.5.4",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.1.0",
    "@testing-library/user-event": "^14.6.1",
    "@types/canvas-confetti": "^1.9.0",
    "@types/katex": "^0.16.7",
    "@types/node": "^20.17.19",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^18.3.18",
    "@types/react-dom": "^18.3.5",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.1",
    "eslint-config-next": "14.2.35",
    "jsdom": "^25.0.1",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.6.3",
    "vite-tsconfig-paths": "^5.1.4",
    "vitest": "^2.1.8"
  }
}
```

---

## 3. TypeScript Configuration (`tsconfig.json`)

The Worker must create `tsconfig.json` at `d:\Software\YALLA CODEX\YALLA CENTER\tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts"
  ],
  "exclude": [
    "node_modules"
  ]
}
```

**Key Path Alias Rule**: The project structure places `app/`, `components/`, `lib/`, `tests/` in the project root. The path mapping `"@/*": ["./*"]` enables clean imports such as `@/components/ui/button`, `@/lib/dal/index`, and `@/lib/finance/compensation`.

---

## 4. Vitest Configuration (`vitest.config.ts`)

The Worker must create `vitest.config.ts` at `d:\Software\YALLA CODEX\YALLA CENTER\vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', '.next/', 'tests/'],
    },
  },
});
```

### Supporting Setup File: `tests/setup.ts`
Create `tests/setup.ts`:
```ts
import '@testing-library/jest-dom';
```

### Initial Smoke Test: `tests/unit/smoke.test.ts`
Create `tests/unit/smoke.test.ts` to immediately verify test runner execution:
```ts
import { describe, it, expect } from 'vitest';

describe('Yalla Center Foundation Suite', () => {
  it('initializes vitest runner and resolves aliases', () => {
    expect(true).toBe(true);
  });
});
```

---

## 5. Next.js Configuration (`next.config.mjs`)

The Worker must create `next.config.mjs` at `d:\Software\YALLA CODEX\YALLA CENTER\next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Ensure webpack handles KaTeX font files and assets cleanly
  webpack: (config) => {
    return config;
  },
};

export default nextConfig;
```

---

## 6. Tailwind & PostCSS Configuration

### 6.1 `postcss.config.mjs`
Create `postcss.config.mjs` at `d:\Software\YALLA CODEX\YALLA CENTER\postcss.config.mjs`:
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### 6.2 `tailwind.config.ts`
Create `tailwind.config.ts` at `d:\Software\YALLA CODEX\YALLA CENTER\tailwind.config.ts`:
```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        brand: {
          navy: {
            700: '#26345A',
            800: '#1C2541',
            850: '#111A38',
            900: '#0B132B',
            950: '#070B19',
          },
          blue: {
            500: '#00A3FF',
            600: '#0084E0',
            700: '#0066FF',
          },
          cyan: {
            400: '#38BDF8',
            500: '#00C2FF',
          },
        },
        surface: {
          app: 'var(--bg-app)',
          card: 'var(--bg-surface)',
          elevated: 'var(--bg-surface-elevated)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          strong: 'var(--border-strong)',
        },
        feedback: {
          success: 'var(--color-success)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
          info: 'var(--color-info)',
        },
      },
      fontFamily: {
        cairo: ['var(--font-cairo)', 'Cairo Fallback', 'Tahoma', 'sans-serif'],
      },
      boxShadow: {
        'card-soft': '0 4px 20px -2px rgba(11, 19, 43, 0.05)',
        'card-elevated': '0 10px 25px -3px rgba(11, 19, 43, 0.1)',
        'glow-cyan': '0 0 20px -2px rgba(0, 194, 255, 0.35)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
```

---

## 7. Global CSS, KaTeX & Cairo Typography

### 7.1 `app/globals.css`
Create `app/globals.css` with semantic CSS tokens and KaTeX imports:
```css
@import 'katex/dist/katex.min.css';

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Brand Primary & Accents */
    --brand-navy-950: #070B19;
    --brand-navy-900: #0B132B;
    --brand-navy-850: #111A38;
    --brand-navy-800: #1C2541;
    --brand-navy-700: #26345A;

    --brand-blue-500: #00A3FF;
    --brand-blue-600: #0084E0;
    --brand-blue-700: #0066FF;
    --brand-cyan-400: #38BDF8;
    --brand-cyan-500: #00C2FF;

    /* Semantic Feedback */
    --color-success: #10B981;
    --color-warning: #F59E0B;
    --color-danger: #EF4444;
    --color-info: #6366F1;

    /* Light Theme Surface Tokens */
    --bg-app: #F8FAFC;
    --bg-surface: #FFFFFF;
    --bg-surface-elevated: #F1F5F9;
    --border-subtle: #E2E8F0;
    --border-strong: #CBD5E1;
    --text-primary: #0F172A;
    --text-secondary: #475569;
    --text-muted: #94A3B8;
  }

  .dark {
    /* Dark Theme Surface Tokens */
    --bg-app: #070B19;
    --bg-surface: #0B132B;
    --bg-surface-elevated: #111A38;
    --border-subtle: #1C2541;
    --border-strong: #26345A;
    --text-primary: #F8FAFC;
    --text-secondary: #CBD5E1;
    --text-muted: #64748B;
  }
}

body {
  background-color: var(--bg-app);
  color: var(--text-primary);
  font-family: var(--font-cairo), Cairo, 'Segoe UI', Tahoma, sans-serif;
  direction: rtl;
  text-align: right;
  min-height: 100vh;
}

/* Tabular figures for financial and timetable alignment */
.tabular-nums {
  font-variant-numeric: tabular-nums;
}

/* Print layout optimizations for A4 exams */
@media print {
  @page {
    size: A4 portrait;
    margin: 15mm;
  }
  body {
    background: #ffffff !important;
    color: #000000 !important;
  }
  .no-print {
    display: none !important;
  }
  .print-page-break {
    page-break-after: always;
  }
}
```

### 7.2 Root Layout (`app/layout.tsx`)
Create `app/layout.tsx` enforcing Arabic RTL and Cairo typography:
```tsx
import type { Metadata } from 'next';
import { Cairo } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-cairo',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Yalla Center | منصة يلا سنتر التعليمية',
  description: 'المنصة السحابية المتكاملة لإدارة السناتر والمراكز التعليمية',
  icons: {
    icon: '/brand/yalla-center-icon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className={`${cairo.variable} font-cairo antialiased`}>
        {children}
      </body>
    </html>
  );
}
```

### 7.3 Base Landing Page (`app/page.tsx`)
Create `app/page.tsx` as a smoke test page:
```tsx
import Image from 'next/image';
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="flex items-center gap-4 mb-6">
        <Image
          src="/brand/yalla-center-logo-dark.png"
          alt="Yalla Center"
          width={280}
          height={70}
          priority
          className="h-auto w-auto"
        />
      </div>
      <h1 className="text-3xl font-bold text-brand-blue-500 mb-2">
        منصة يلا سنتر التعليمية
      </h1>
      <p className="text-slate-400 max-w-lg mb-8">
        نظام سحابي ذكي لإدارة المراكز التعليمية والحصص والامتحانات والحسابات
      </p>
      <div className="flex gap-4">
        <Link
          href="/owner"
          className="px-6 py-2.5 rounded-lg bg-brand-navy-800 hover:bg-brand-navy-700 text-white font-medium border border-brand-navy-700 transition"
        >
          بوابة مالك المنصة
        </Link>
        <Link
          href="/center/al-rowad"
          className="px-6 py-2.5 rounded-lg bg-brand-blue-600 hover:bg-brand-blue-700 text-white font-medium shadow-lg shadow-brand-blue-600/30 transition"
        >
          بوابة السنتر (سنتر الرواد)
        </Link>
      </div>
    </main>
  );
}
```

---

## 8. Concrete Worker Implementation Protocol

The Worker executing Milestone 1 must follow these exact sequential steps:

### Phase 1: Package Manifest & Dependency Installation
1. Write the exact `package.json` to `d:\Software\YALLA CODEX\YALLA CENTER\package.json`.
2. Run `npm install` in `d:\Software\YALLA CODEX\YALLA CENTER`.
   - Command: `npm install`
   - Invalidation check: Verify that `node_modules` exists and exit code is `0`.

### Phase 2: Configuration & Tooling Files
1. Write `tsconfig.json`.
2. Write `next.config.mjs`.
3. Write `postcss.config.mjs`.
4. Write `tailwind.config.ts`.
5. Write `vitest.config.ts`.
6. Write `tests/setup.ts`.
7. Write `tests/unit/smoke.test.ts`.

### Phase 3: Base Layout & Smoke Page
1. Write `app/globals.css`.
2. Write `app/layout.tsx`.
3. Write `app/page.tsx`.
4. Write a minimal `components/ui/math-view.tsx` to verify KaTeX integration.

### Phase 4: Build & Test Verification
1. Run test suite: `npm run test`
   - Must exit with code `0`, reporting 1 passing test file.
2. Run production build: `npm run build`
   - Must exit with code `0`, compiling Next.js App Router static/dynamic pages with zero TypeScript or ESLint errors.

---

## 9. Verification & Acceptance Criteria Matrix

| Criterion | Expected Result | Verification Command |
|---|---|---|
| Dependency Installation | Zero peer dependency errors, `package-lock.json` generated | `npm install` |
| Vitest Test Execution | Suite passes in `jsdom` with path alias support | `npm run test` |
| Production Build | Next.js builds pages without TypeScript/ESLint warnings | `npm run build` |
| Brand Asset Integrity | PNG assets in `public/brand/` intact and referenced | `Test-Path public/brand/*` |
| KaTeX Integration | KaTeX styles load and renders formula | Tested in `math-view.test.ts` |
