# Handoff Report — Explorer M2-1 (Routing & Portal Architecture Explorer)

## 1. Observation

1. **Routing State**:
   - `app/` contained only `layout.tsx`, `page.tsx`, and `globals.css` (verified via `find_by_name` on `app/`). Neither `/owner` nor `/center/[centerSlug]` routes existed yet.
   - `app/page.tsx` (lines 44-93) already contained outbound links to `/owner`, `/center/al-maher`, and `/center/al-rowad`, which currently return 404 until Milestone 2 implements them.
2. **Design Tokens & Theme Assets**:
   - `app/globals.css` (lines 8-120) configures `--sidebar-background: 225 59% 11%` (`#0B132B` Midnight Navy), `--primary: 202 100% 50%` (`#00A3FF` Electric Cyan), and elevated card utilities `.card-elevated` (lines 140-153).
   - `components/brand/brand-logo.tsx` (lines 21-46) provides an adaptive brand logo with `theme="dark"` for deep navy sidebars.
   - `components/ui/rtl-icon.tsx` (lines 15-26) flips directional icons automatically for Arabic RTL (`rtl:rotate-180`).
3. **Data Access Layer & Seed Data**:
   - `lib/dal/mock-data.ts` (lines 45-74) seeds two active tenant centers: `tenant-maher-001` (`al-maher`) and `tenant-rowad-002` (`al-rowad`).
   - `lib/dal/mock-data.ts` (lines 76-95) seeds multiple branches for Al-Maher (`branch-nasr-city`, `branch-heliopolis`).
   - `lib/dal/mock-data.ts` (lines 118-251) seeds users covering `PLATFORM_OWNER`, `CENTER_ADMIN`, `RECEPTIONIST`, `ACCOUNTANT`, `TEACHER`, and `STUDENT`.
   - `lib/dal/factory.ts` (lines 6-12) instantiates a singleton `MockDataProvider` enabling 100% offline and demo execution.
4. **Test & Build Readiness**:
   - Running `npx vitest run` executed 15 test files with 161 passing tests in 14.43s (0 failures, 0 skipped).
   - Running `npx next build` compiled successfully and generated static pages without TypeScript or ESLint errors.

## 2. Logic Chain

1. **From Observation 1**: Because `/owner` and `/center/[centerSlug]` are linked from the landing page but do not exist in `app/`, Milestone 2 must establish these route hierarchies using Next.js App Router conventions.
2. **From Observation 2**: Because `--sidebar-background` is `#0B132B` Midnight Navy and `--primary` is `#00A3FF` Electric Cyan, the navigation sidebar must apply these tokens persistently across both light and dark modes to maintain the brand anchor approved in `ORIGINAL_REQUEST.md`.
3. **From Observation 3**: Because `lib/dal/mock-data.ts` provides `getTenantBySlug(slug)`, `getBranches(tenantId)`, and `getUsers(tenantId)`, dynamic tenant resolution should occur in a Server Component layout at `app/center/[centerSlug]/layout.tsx`, hydrating a client `<TenantProvider>` to provide context to all child routes.
4. **From Observation 3 & Security Requirements (AC-4, AC-5, AC-6)**: Because the platform serves 8 distinct roles, navigation in `Sidebar` must be dynamically filtered by `currentRole`. A demo role-switcher widget in `Header` will allow immediate testing of all 8 roles without manual credential management.
5. **From Observation 4**: Because all 161 tests pass and `next build` succeeds, all proposed components and routes must adhere to strict TypeScript types from `lib/dal/types.ts` to ensure zero compilation or hydration regressions.

## 3. Caveats

- **Scope Boundary with Explorer M2-2**: Explorer M2-2 covers detailed HTTP 403 guardrail enforcement, profile photo-only upload API routes (`/api/profile/update-photo`), and DAL security methods. This report specifies the UI integration and layout guardrails for `/center/[centerSlug]/profile`.
- **Scope Boundary with Explorer M2-3**: Explorer M2-3 covers the classroom timetable scheduling and conflict prevention algorithm. This report provides the layout placement at `/center/[centerSlug]/branches` and branch synchronization in `TenantContext`.
- **External Network Fallback**: In demo mode, external network calls (WhatsApp Cloud API, Google Drive API) remain sandboxed; mock tenants `al-maher` and `al-rowad` serve as primary validation fixtures.

## 4. Conclusion

The multi-tenant routing and portal architecture for Milestone 2 is fully specified and ready for implementation by Worker M2:
- **Platform Owner Portal (`/owner`)**: Global overview dashboard, tenant centers management CRUD, and SaaS subscriptions analytics.
- **Center Workspaces (`/center/[centerSlug]`)**: Dynamic tenant resolution, Arabic 404/Suspension fallbacks, persistent Midnight Navy sidebar with Cairo typography, and Electric Cyan accents.
- **Tenant Context (`TenantProvider`)**: Centralized multi-branch selector and 1-click 8-role demo switcher.
- **Concrete Blueprint**: Full architecture published to `m2_portal_report.md` with step-by-step implementation phases and component code templates.

## 5. Verification Method

To independently verify Worker M2's implementation:

1. **Execute Vitest Test Suite**:
   ```bash
   npx vitest run tests/security/rbac-guardrails.test.ts
   npx vitest run
   ```
   *Expected*: 100% pass rate (161+ tests passing, 0 failures).

2. **Execute Next.js Production Build**:
   ```bash
   npx next build
   ```
   *Expected*: Zero TypeScript, ESLint, or dynamic route compilation errors; exit code 0.

3. **Visual Route Inspection**:
   - Inspect `/owner` -> Platform metrics, centers table, subscriptions.
   - Inspect `/center/al-maher` -> Midnight Navy sidebar, branch switcher (`Nasr City` / `Heliopolis`), Cairo RTL layout.
   - Inspect role switcher in header -> switch between all 8 roles; verify sidebar navigation filters immediately.
   - Inspect `/center/unknown-center-xyz` -> custom Arabic 404 screen renders with links to `/center/al-maher` and `/center/al-rowad`.
