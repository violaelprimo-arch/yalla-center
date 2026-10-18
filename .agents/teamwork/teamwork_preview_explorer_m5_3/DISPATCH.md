## 2026-10-18T07:07:06Z
You are Explorer M5-3 (KaTeX Printable A4 & Online Exam Runner Explorer) for Milestone 5 of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_3
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Your mission for Milestone 5 (Hierarchical Materials & In-Session AI Exam Platform):
1. Explore Branded Printable A4 Exam Generator with KaTeX Math (FEAT-35):
   - Official Yalla Center branded header with `public/brand/yalla-center-logo-light.png` or `yalla-center-logo-dark.png`.
   - Header elements: Center name, teacher name, subject, exam title, date, duration, total marks, student name and seat number fillable box.
   - Two-column or structured printable layout with standard A4 margins, page break control (`page-break-inside: avoid;`).
   - Math & formula rendering: Integration of `components/ui/math-view.tsx` with KaTeX in Arabic RTL layout.
   - Separate printable Answer Key Sheet (نموذج الإجابة وتوزيع الدرجات).
2. Explore Online Timed Exam Runner & Auto-Grading (FEAT-36):
   - Student exam runner at `/center/[centerSlug]/exams/[examId]/run` (or interactive modal runner):
     - Live countdown timer with visual warning at < 5 minutes.
     - Question navigation bar (answered, unanswered, flagged for review).
     - Auto-submission on timer expiration.
     - Objective questions (MCQ) auto-graded immediately upon submission with score and percentage calculated.
     - Subjective questions flagged for teacher manual review.
3. Inspect existing KaTeX components and math tests (`components/ui/math-view.tsx`, `tests/unit/math-view.test.tsx`).
4. Design the printable CSS stylesheet, print modal, online runner state machine, and auto-grader.
5. Write your complete findings report to:
   `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_3\m5_runner_print_report.md`
   and write standard handoff report `handoff.md`.
Notify the orchestrator via send_message when complete.
