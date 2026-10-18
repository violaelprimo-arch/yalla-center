## 2026-10-18T01:49:38Z
You are Worker M1-1 for Milestone 1 (Foundation, Brand Design System & Core Database Schema) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

The authoritative user request is at: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly before starting).
The project scope document is at: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).

Read the three comprehensive exploration reports prepared specifically for your implementation:
1. Build & Tooling: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_1\m1_build_report.md`
2. UI & Design System: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_2\m1_design_report.md`
3. Database & DAL: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_3\m1_db_dal_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation scope and exclusive file ownership:
1. Tooling & Dependencies:
   - Set up `package.json`, `tsconfig.json`, `next.config.mjs`, `tailwind.config.ts`, `postcss.config.mjs`.
   - Install all required dependencies (Next.js 14/15, React 18/19, Tailwind CSS, Lucide React, KaTeX, Vitest, clsx, tailwind-merge, etc.) cleanly without peer conflicts.
2. UI & Design System:
   - Configure Tailwind CSS with Cairo font, Arabic RTL support (`dir="rtl"`), and Midnight Navy (`#0B132B`) / Electric Cyan (`#00A3FF`) semantic color tokens.
   - Implement `app/globals.css` with dark/light theme CSS variables, `.card-elevated`, `.tabular-nums`, and KaTeX bidirectional styles.
   - Implement `app/layout.tsx` with `<html lang="ar" dir="rtl">`, Cairo font, theme script, and base metadata.
   - Implement `app/page.tsx` displaying the branded Yalla Center portal landing with links to `/owner` and `/center/al-maher` (demo center).
   - Implement `components/brand/brand-icon.tsx`, `brand-logo-dark.tsx`, `brand-logo-light.tsx`, and `brand-logo.tsx` referencing the official brand assets in `public/brand/` with exact aspect ratios preserved.
   - Implement `components/ui/math-view.tsx` with KaTeX LTR bidirectional isolation inside Arabic context, and `components/ui/rtl-icon.tsx`.
3. Database & DAL:
   - Implement `lib/supabase/schema.sql` with all 22 normalized 3NF tables, composite foreign keys, unique constraints (`UNIQUE(session_id, student_id)` on `attendance`), row-level trigger guardrail (`trg_enforce_user_guardrail` enforcing profile photo-only updates for students and teachers), and RLS policies.
   - Implement `lib/dal/index.ts` and `lib/dal/types.ts` defining the complete `IDataProvider` interface.
   - Implement `lib/dal/mock-data.ts` with the robust in-memory `MockDataProvider` and pre-seeded Egyptian Arabic educational dataset (tenants, branches, classrooms, staff, students, courses, groups, sessions, materials, exams, financial records) satisfying offline/demo execution (`NEXT_PUBLIC_INTEGRITY_MODE=demo`).
4. Verification:
   - Run the build command (`npm run build` or `pnpm build`).
   - Verify that the build succeeds with ZERO TypeScript and ESLint errors.
   - Record exact build and test verification outputs in your handoff report.
5. Write your complete handoff report to `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_1\handoff.md`.
Notify the orchestrator via send_message when complete.
