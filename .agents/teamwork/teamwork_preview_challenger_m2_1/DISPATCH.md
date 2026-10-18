## 2026-10-18T05:27:13Z
You are Challenger M2-1 (Security Guardrails Challenger) for Milestone 2 of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_challenger_m2_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
Worker M2 Handoff: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m2_2\handoff.md (you MUST read this file directly).

Your mission:
Empirically stress-test the 3-tier security guardrails in `lib/security/rbac.ts`, `middleware.ts`, `app/api/profile/update-photo/route.ts`, and `tests/security/m2-profile-guardrails.test.ts`:
1. Test student & teacher avatar photo update: ensure valid photo upload returns HTTP 200 OK.
2. Test student & teacher administrative field lockout: ensure attempting to update `fullName`, `studentCode`, `balanceDue`, `stage`, `grade`, `phone`, `role`, or any non-avatar key returns HTTP 403 Forbidden.
3. Test cross-tenant access: ensure actor with Center A credentials visiting Center B receives HTTP 403 Forbidden.
4. Test teacher privacy: ensure teacher attempting to inspect a peer teacher's statement or modify rates returns HTTP 403 Forbidden.
5. Run tests: `npm run test` and `npx tsc --noEmit`.
6. Report your explicit verdict: APPROVE or REQUEST_CHANGES.
7. Write your handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_challenger_m2_1\handoff.md`
Notify the orchestrator via send_message when complete.
