## 2026-10-18T02:51:36Z
You are Worker M1-R3 for Milestone 1 (Foundation, Brand Design System & Core Database Schema) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_r3_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).

Read the three Iteration 3 Explorer reports before implementing:
1. `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r3_1\m1_r3_remediation_report.md`
2. `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r3_2\m1_r3_types_report.md`
3. `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m1_r3_3\m1_r3_harmonization_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks and exclusive file ownership:
1. `lib/dal/types.ts`:
   - In `TeacherRate` interface: add optional `splitPercentage?: number` property.
   - In `IDataProvider` interface: add `getNotifications?: (tenantId: string, limit?: number) => Promise<NotificationLog[]>`.
2. `lib/dal/mock-data.ts`:
   - Add `async getNotifications(tenantId: string, limit?: number): Promise<NotificationLog[]>` forwarding directly to `this.getNotificationLogs(tenantId, limit)`.
   - Ensure all seed teacher rates populated with `splitPercentage: teacherPercentage` as a compatibility property.
3. `tests/security/challenger-m1-r2-empirical.test.ts`:
   - Verify that all test cases compile cleanly and pass without runtime errors.
4. Verification:
   - Run `npx tsc --noEmit` and confirm exit code 0 (zero errors).
   - Run `npm run test` and confirm 14/14 test files and 138/138 tests pass (exit code 0).
   - Run `npm run lint` and confirm exit code 0.
   - Run `npm run build` and confirm Next.js production build compiles with exit code 0.
5. Record exact verification outputs and write your handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m1_r3_1\handoff.md`.
Notify the orchestrator via send_message when complete.
