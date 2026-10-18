# Handoff Report — Grounded In-Session AI Exam Generation & Teacher Review Workflow (FEAT-33 & FEAT-34)

**Agent**: `teamwork_preview_explorer_m5_2` (Explorer M5-2)  
**Handoff Type**: Hard Handoff (Investigation & Architecture Complete)  
**Date**: October 18, 2026  
**Primary Report**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_2\m5_ai_exam_report.md`  

---

## 1. Observation

1. **Database Schema & RLS State (`lib/supabase/schema.sql`)**:
   - `exams` table is defined at line 322 with columns: `id`, `tenant_id`, `session_id`, `group_id NOT NULL`, `teacher_id`, `title`, `duration_minutes`, `total_marks`, `pass_marks`, `is_ai_generated`, `grounded_material_ids`, `status exam_status DEFAULT 'draft'`.
   - `exam_questions` is defined at line 342 with columns: `id`, `exam_id`, `question_number`, `question_text`, `katex_formula`, `question_type question_type DEFAULT 'mcq'`, `options JSONB DEFAULT '[]'`, `correct_answer`, `explanation`, `marks`, `order_index`.
   - In lines 540–544, `ALTER TABLE exams ENABLE ROW LEVEL SECURITY;` and `ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;` are executed, but lines 550–632 contain RLS policies only for `tenants`, `branches`, `classrooms`, `users`, `teacher_rates`, `teacher_payroll`, and `attendance`. **No RLS policies are defined for `exams` and `exam_questions`**.
   - `group_id` in `exams` is `NOT NULL`, which restricts creating exams at the subject/grade level before assigning to a specific group.

2. **Existing DAL & Mock Data State (`lib/dal/`)**:
   - `lib/dal/mock-data.ts` lines 2255–2295 implement `validateExamPreflight(sourceDocumentIds: string[])`:
     - Checks `EMPTY_SELECTION` if empty array.
     - Checks `UNINDEXED_SOURCE_DOCUMENTS` if any document has `indexStatus !== 'indexed'`.
     - Checks `INSUFFICIENT_SOURCE_DOCUMENTS` if `totalWordCount < 200`.
   - `lib/dal/mock-data.ts` lines 2297–2340 implement `createExamDraft`, which enforces `status: 'draft'`, sets `passMarks = totalMarks / 2`, and assigns questions with `orderIndex`.
   - Lines 2362–2372 implement `publishExam`, throwing `Forbidden: الطلاب لا يمكنهم نشر الامتحانات` if `actorRole === 'STUDENT'`.
   - Missing DAL methods: direct raw text preflight validation returning `PREFLIGHT_TEXT_TOO_SHORT` (HTTP 422), teacher question editing (`updateExamQuestion`), question reordering (`reorderExamQuestions`), and exam archival (`archiveExam`).

3. **Current Test Suite Execution**:
   - Executed `npx vitest run`:
     ```
     Test Files  29 passed (29)
          Tests  437 passed (437)
     ```
   - Existing exam test files:
     - `tests/integration/ai-exam-gate.test.ts` (6 tests passing): checks AC-8, unindexed rejection, < 200 words rejection (`INSUFFICIENT_SOURCE_DOCUMENTS`), and default draft review status.
     - `tests/e2e/printable-exam-layout.test.ts` (5 tests passing): verifies AC-9, official brand assets in `public/brand/`, top-left logo, top-right teacher, student info boxes, KaTeX in LTR container.
     - `tests/e2e/student-exam-runner.test.ts` (8 tests passing): tests automated MCQ scoring engine, countdown timer initialization, autosave payloads, and submission lock.

4. **Existing Frontend Routes & Components**:
   - `app/center/[centerSlug]/exams/page.tsx` is currently a placeholder page with a Milestone 5 badge.
   - `app/center/[centerSlug]/materials/page.tsx` and `app/center/[centerSlug]/sessions/page.tsx` are also placeholder pages.
   - `components/ui/math-view.tsx` is fully operational with KaTeX and strict LTR rendering (`dir="ltr"`).

---

## 2. Logic Chain

1. **Preflight Validation Gate Invariant**:
   - Observation 2 & Prompt Requirement: The preflight gate must reject source texts with < 200 words with error `PREFLIGHT_TEXT_TOO_SHORT` (HTTP 422).
   - Inference: We must provide a unified validator function (`validateExamPreflightInput`) capable of evaluating both indexed documents from `materials` and direct raw text input (for in-session lesson generation), returning HTTP 422 with `PREFLIGHT_TEXT_TOO_SHORT` when `wordCount < 200`.

2. **Grounded Anti-Hallucination AI Generation Engine**:
   - Observation 3 & Prompt Requirement: AI questions must be strictly grounded in the lesson text and never hallucinate outside facts. Supported question types are MCQs (4 choices, 1 correct choice, explanation) and Short Answer / Problem Solving questions.
   - Inference: We design a system prompt with strict grounding directives and citation requirements, coupled with a dual-provider implementation (`MockAiExamGenerator` for zero-credential demo execution and `OpenAiExamGenerator` when API key is provided).

3. **Teacher Review & Approval Workflow (FEAT-34)**:
   - Observation 1, 2, & 4: Newly generated exams must stay in `draft` status until explicitly reviewed and approved by the teacher.
   - Inference: The UI at `/center/[centerSlug]/exams` requires an Exam Studio featuring:
     - A preflight word count gauge displaying real-time progress toward the 200-word threshold.
     - A question review card enabling teachers to edit question text, live KaTeX formulas, options, and explanations.
     - Question reordering controls and individual marks adjustment (with automatic total marks and passing marks calculation).
     - A single-click transition to `published` status.

4. **Security & RBAC Guardrails**:
   - Observation 1, 2, & Prompt Requirement (AC-4, AC-5): Teachers can only create and edit exams for their assigned subjects; students cannot edit exams or view drafts (HTTP 403 Forbidden).
   - Inference: We designed concrete PostgreSQL RLS policies for `exams` and `exam_questions` and added role-checking middleware in API routes ensuring students attempting any exam modification receive HTTP 403.

---

## 3. Caveats

1. **Google Drive Integration**: Google Drive folder syncing for materials is part of FEAT-28. In demo integrity mode, text indexing is backed by mock materials seeded with extracted text content and word counts.
2. **LLM Provider Availability**: When no live OpenAI or Gemini API key is configured, the system relies on `MockAiExamGenerator`, which deterministically extracts sentences and produces grounded MCQs and problem-solving questions.
3. **No Unilateral Code Mutation**: Per explorer instructions, this investigation is read-only. No application code has been modified; all findings and architectures are documented in `m5_ai_exam_report.md` for the builder agents.

---

## 4. Conclusion

The architectural design for FEAT-33 and FEAT-34 is complete, robust, and aligned with all project constraints:
1. **Preflight Gate**: Formulated `validateExamPreflightInput` with 200-word minimum threshold and `PREFLIGHT_TEXT_TOO_SHORT` (HTTP 422).
2. **AI Generator Engine**: Formulated anti-hallucination prompts and data models for 4-choice MCQs and Short Answer questions with KaTeX support.
3. **Teacher Review Workflow**: Formulated the `draft -> published -> archived` lifecycle, question editing, marks recalculation, and reordering.
4. **DAL & Schema**: Outlined schema additions (`subject_id`, `grade`, nullable `group_id`), RLS policies, and DAL methods.
5. **UI & API Blueprint**: Formulated complete API routes and the responsive RTL Exam Studio UI at `/center/[centerSlug]/exams`.

---

## 5. Verification Method

1. **Verify Existing Tests**:
   Run the full test suite to confirm baseline stability:
   ```bash
   npx vitest run
   ```
   Expected: 29 test files passed, 437 tests passed.

2. **Verify Preflight Gate Tests**:
   Run the AI exam gate test:
   ```bash
   npx vitest run tests/integration/ai-exam-gate.test.ts
   ```
   Expected: 6 tests passed.

3. **Inspect Specification Artifacts**:
   - Open and inspect `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_2\m5_ai_exam_report.md`.
   - Confirm coverage of all 6 mission objectives (Preflight gate, Anti-hallucination AI engine, Dual question types, Teacher review lifecycle, DAL/Schema/RLS, and UI architecture).
