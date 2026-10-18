## 2026-10-18T06:35:46Z
You are Worker M4 for Milestone 4 (Fast Reception Attendance & Async Notification Engine) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m4_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Read the three Explorer M4 reports before implementing:
1. Reception HUD & Scanner Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m4_1\m4_reception_report.md`
2. Attendance Idempotency Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m4_2\m4_idempotency_report.md`
3. Notification Queue & Resend Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m4_3\m4_notifications_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks and exclusive file ownership:
1. Data Access Layer & Types:
   - In `lib/dal/types.ts`: Add `AttendanceScanResponse`, `SessionAttendanceStats`, update `StudentAttendanceDetail`.
   - In `lib/dal/index.ts`: Add `recordAttendanceScan`, `getSessionAttendanceStats` to `IDataProvider`.
   - In `lib/dal/mock-data.ts`: Implement `recordAttendanceScan` (synchronously appending to `this.attendance` before notification dispatch to prevent event-loop race conditions), `getSessionAttendanceStats`, `getStudentAttendanceHistory`, and enrich `INITIAL_SEEDED_DATA.notifications` with realistic items. Ensure `recordAttendance` delegates or harmonizes with `recordAttendanceScan` without breaking existing tests.
2. Attendance Domain & Audio:
   - Implement `lib/attendance/audio.ts`: Procedural Web Audio API sound engine (synthesizing C6-E6-G6 for Success, dual 580Hz/720Hz for Warning, descending 220Hz->110Hz for Error) with zero MP3 assets.
   - Implement `lib/attendance/checkin.ts`: Export `recordReceptionScan`, `calculateSessionStats`, and `ReceptionAttendanceStore` (maintaining 100% compatibility with contract bridge and `tests/integration/attendance-idempotency.test.ts`).
   - Implement `app/api/center/[centerSlug]/attendance/scan/route.ts`: Fast attendance scan API endpoint.
3. Notification Domain & Formatter:
   - Implement `lib/notifications/types.ts`: Types for notifications, channels, and jobs.
   - Implement `lib/notifications/formatter.ts`: Standardized Arabic WhatsApp message formatters (including overdue balance alert `\n⚠️ تنبيه: متبقي مبلغ [المبلغ] ج.م مطلوب سداده`) and FCM push payload formatters.
   - Implement `lib/notifications/queue.ts`: Asynchronous in-memory queue engine with sub-20ms guarantee, transaction isolation, sandboxed delivery simulation, and resend capability.
   - Implement `app/api/center/[centerSlug]/notifications/route.ts` & `app/api/center/[centerSlug]/notifications/resend/route.ts`: API endpoints for listing notifications and 1-click resend.
4. Interactive UI Components & Pages:
   - Implement `components/attendance/barcode-listener.tsx`: Window-level hardware laser scanner listener (<50ms inter-keystroke interval, Enter termination, 80ms inactivity timeout).
   - Implement `components/attendance/camera-qr-scanner.tsx`: Camera QR scanner modal with live video stream and BarcodeDetector.
   - Implement `components/attendance/verification-hud.tsx`: High-contrast Arabic RTL cards for Green Success ("حضور مؤكد"), Amber Warning (overdue balance banner with quick "تحصيل فوري" shortcut), and Red Error.
   - Implement `components/attendance/quick-payment-modal.tsx`: Rapid collection modal linked to `dal.recordPayment()`.
   - Implement `components/attendance/session-selector.tsx`: Branch & active session selector.
   - Implement `components/attendance/live-stats-ring.tsx`: Real-time circular SVG attendance progress ring.
   - Implement `components/attendance/manual-checkin-table.tsx`: Searchable student table with 1-click manual check-in button.
   - Implement `components/attendance/recent-scans-feed.tsx`: Chronological reverse attendance stream.
   - Implement `app/center/[centerSlug]/reception/page.tsx`: Complete fast reception console with Midnight Navy `#0B132B` / Electric Cyan `#00A3FF` styling, Web Audio procedural chimes, Verification HUD, live stats ring, manual fallback, and quick payment.
   - Implement `app/center/[centerSlug]/notifications/page.tsx`: Live Queue Inspector & Resend Console with 4 KPI cards (Pending, Sent, Failed, Today's Total), channel and status filters, realistic WhatsApp chat bubble payload inspector, and 1-click manual resend.
5. Tests & Verification Gates:
   - Implement `tests/unit/reception-attendance.test.ts` (verifying barcode buffer, HUD states, overdue warnings, Web Audio trigger calls, and stats).
   - Run `npx tsc --noEmit` and confirm exit code 0 (zero errors).
   - Run `npm run test` and confirm all test suites pass with 100% pass rate (exit code 0).
   - Run `npm run lint` and confirm exit code 0.
   - Run `npm run build` and confirm clean Next.js production build with exit code 0.
6. Write your complete handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m4_1\handoff.md`.
Notify the orchestrator via send_message when complete.
