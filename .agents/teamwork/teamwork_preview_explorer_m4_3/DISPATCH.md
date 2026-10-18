## 2026-10-18T06:27:50Z

You are Explorer M4-3 (Async Notification Queue & Dispatcher Explorer) for Milestone 4 of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m4_3
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Your mission for Milestone 4 (Fast Reception Attendance & Async Notification Engine):
1. Explore Non-Blocking Async Notification Queue Architecture (FEAT-28):
   - When attendance is scanned at reception, attendance scan returns immediately (<300ms) while notification dispatch is enqueued asynchronously.
   - Queue data model: `NotificationLog` (`id`, `tenantId`, `recipient`, `recipientPhone`, `channel` [WHATSAPP/FCM/SMS], `templateId`, `content`, `status` [pending/sent/failed], `sentAt`, `retryCount`, `errorDetails`).
2. Explore WhatsApp Cloud API & Web Push FCM Dispatcher (FEAT-29):
   - WhatsApp message formatting: personalized Arabic notification ("تم تسجيل حضور الطالب [اسم الطالب] في حصة [المادة] بتاريخ [الوقت] - سنتر [السنتر]").
   - Overdue balance warning integration ("تنبيه: متبقي مبلغ [المبلغ] ج.م مطلوب سداده").
   - Web Push FCM payload formatting for guardian mobile notifications.
3. Explore Notification Queue Live Inspector & Resend Console (FEAT-30):
   - Inspect `/center/[centerSlug]/notifications` page structure.
   - Live queue status counters (Pending, Sent, Failed, Today's Total).
   - Channel filtering (`ALL`, `WHATSAPP`, `FCM`, `SMS`) and status filtering (`ALL`, `PENDING`, `SENT`, `FAILED`).
   - Detailed payload inspector modal.
   - Manual 1-click resend action for failed or pending notifications.
4. Inspect `tests/integration/notifications.test.ts` and `lib/dal/index.ts` to ensure 100% test compatibility.
5. Design the complete notification engine, DAL methods, and UI page for Worker M4.
6. Write your complete findings report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m4_3\m4_notifications_report.md`
and write a standard handoff report `handoff.md` in your working directory.
Notify the orchestrator via send_message when complete.
