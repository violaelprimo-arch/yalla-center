## 2026-10-18T07:14:48Z
You are Worker M5 for Milestone 5 (Hierarchical Materials & In-Session AI Exam Platform) of Yalla Center.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m5_1
Project root is: d:\Software\YALLA CODEX\YALLA CENTER

Authoritative user request: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project scope: d:\Software\YALLA CODEX\YALLA CENTER\PROJECT.md (you MUST read this file directly).
E2E Test Readiness: d:\Software\YALLA CODEX\YALLA CENTER\TEST_READY.md (you MUST read this file directly).

Read the three Explorer M5 reports before implementing:
1. Materials Taxonomy Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_1\m5_materials_report.md`
2. AI Exam Generation Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_2\m5_ai_exam_report.md`
3. Printable A4 & Runner Blueprint: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_3\m5_runner_print_report.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your implementation tasks and exclusive file ownership:
1. Materials Domain & Google Drive Indexing:
   - Implement `lib/materials/drive.ts`: Google Drive URL parser and regex file ID extractor.
   - Implement `lib/materials/indexer.ts`: Text indexing, Arabic word count tokenizer, status classifier (`indexed` >= 200, `insufficient` < 200, `pending`, `failed`).
   - Implement `lib/materials/taxonomy.ts`: 6-tier hierarchy builder (`Stage -> Grade -> Subject -> Unit -> Lesson -> Document`).
   - Implement `app/api/center/[centerSlug]/materials/route.ts`: API route for listing materials and adding Google Drive linked materials.
2. AI Exam Generation & Preflight Gate:
   - Implement `lib/exams/preflight.ts`: Unified preflight validation gate enforcing minimum 200 words (`PREFLIGHT_TEXT_TOO_SHORT`, HTTP 422).
   - Implement `lib/exams/generator.ts`: Grounded AI exam generation engine producing 4-choice MCQs and short answer questions with KaTeX formulas, strictly grounded in lesson text.
   - Implement `lib/exams/grading.ts`: Deterministic auto-grader for objective questions and manual review flagging for subjective questions.
   - Implement `app/api/center/[centerSlug]/exams/route.ts`, `app/api/center/[centerSlug]/exams/generate/route.ts`, `app/api/center/[centerSlug]/exams/publish/route.ts`, `app/api/center/[centerSlug]/exams/submit/route.ts`.
3. Data Access Layer & Mock Data:
   - In `lib/dal/types.ts`: Update `Material`, `Exam`, `ExamQuestion`, `ExamSubmission`, `ExamAnswer`.
   - In `lib/dal/index.ts`: Add `createMaterial`, `updateMaterial`, `generateAiExam`, `updateExamQuestion`, `reorderExamQuestions`, `publishExam`, `archiveExam`, `submitExam`.
   - In `lib/dal/mock-data.ts`: Implement these methods and expand mock materials and exams with authentic Egyptian secondary school physics/math lessons.
4. Interactive UI Components & Pages:
   - Implement `app/center/[centerSlug]/materials/page.tsx`: Complete 6-tier materials workspace with Tree View, Folder Explorer Grid, Breadcrumbs, Instant Search, Cascading Filters (Stage -> Grade -> Subject), Google Drive linking modal, and text inspector modal with `MathView`.
   - Implement `app/center/[centerSlug]/exams/page.tsx`: Complete Exam Studio page with exam list, Preflight word count gauge, AI exam generation modal, Teacher question review/editor (editing choices, formulas, marks, reordering), publish action, and printable sheet trigger.
   - Implement `components/exams/printable-exam-sheet.tsx`: Branded printable A4 sheet with official logo (`yalla-center-logo-light.png`), `#exam-header`, `#exam-header-logo`, `#exam-header-teacher`, `#student-info-box`, KaTeX formulas wrapped in LTR spans, two-column layout, and separate printable Answer Key Sheet.
   - Implement `app/center/[centerSlug]/exams/[examId]/run/page.tsx` & `components/exams/student-exam-runner.tsx`: Online timed exam runner with drift-free countdown timer, visual warning (< 5 min amber, < 1 min red), dual-tier autosave (LocalStorage + DAL), auto-submission on timeout, and immediate auto-grading score display.
5. Tests & Verification Gates:
   - Run `npx tsc --noEmit` and confirm exit code 0 (zero errors).
   - Run `npm run test` and confirm all test suites pass with 100% pass rate (exit code 0).
   - Run `npm run lint` and confirm exit code 0.
   - Run `npm run build` and confirm clean Next.js production build with exit code 0.
6. Write your complete handoff report to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_worker_m5_1\handoff.md`.
Notify the orchestrator via send_message when complete.
