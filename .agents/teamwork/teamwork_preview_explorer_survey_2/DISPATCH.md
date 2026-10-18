## 2026-10-18T01:36:25Z
You are Architecture Explorer Survey 2.
Your working directory is: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_2
The authoritative user request is at: d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\ORIGINAL_REQUEST.md (you MUST read this file directly).
Project root: d:\Software\YALLA CODEX\YALLA CENTER
Brand assets directory: d:\Software\YALLA CODEX\YALLA CENTER\public\brand

Your objective is to investigate the technical architecture, stack, UI/UX design tokens, and infrastructure:
1. Examine existing brand assets in public/brand (yalla-center-icon.png, yalla-center-logo-dark.png, yalla-center-logo-light.png, yalla-center-wireframes.jpg).
2. Formulate the technical stack architecture: Next.js 14/15 App Router, TypeScript, Tailwind CSS, Cairo font, Arabic RTL first-class configuration, Lucide icons, KaTeX math rendering, theme persistence (dark/light with deep navy and electric blue/cyan accents).
3. Formulate the Multi-Tenant architecture: Platform Owner portal (/owner), Center portal (/center/[centerSlug]), route structures, authentication/authorization middleware, tenant context provider, and layout isolation.
4. Formulate the Supabase PostgreSQL database architecture: normalized relational schema, tables (tenants, users, branches, classrooms, courses/subjects, groups, sessions, enrollments, attendance, invoices, payments, teacher_rates, teacher_payroll, materials, exam_questions, exams, notifications), Row Level Security (RLS) policies, and a robust sandboxed/mock fallback layer for offline/demo operation.
5. Define the Greenfield Code Layout (directory tree, module boundaries, shared libraries, server actions/API routes, components).
6. Write your complete findings to:
`d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_survey_2\survey_architecture_report.md`
and write a standard handoff report `handoff.md` in your working directory.
When finished, notify the orchestrator via send_message.
