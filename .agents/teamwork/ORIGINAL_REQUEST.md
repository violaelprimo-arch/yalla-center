# Original User Request

## 2026-10-18T01:33:11Z

Build Yalla Center, a complete, production-ready, Arabic-first, multi-tenant educational center management SaaS platform developed by Yalla Codex. The platform features completely isolated Platform Owner and Center Administration portals, fast reception attendance, dual-system teacher compensation calculations, hierarchical Google Drive materials indexing, in-session AI examination generation, branded printable A4 exam exports, an online student exam platform, and asynchronous notification engines.

Working directory: d:\Software\YALLA CODEX\YALLA CENTER
Integrity mode: demo

## Requirements

### R1. Brand Identity & Visual Design System
- Preserve the official Yalla Center brand assets exactly as provided (`public/brand/yalla-center-icon.png`, `public/brand/yalla-center-logo-dark.png`, `public/brand/yalla-center-logo-light.png`). Do not modify typography, gradients, or aspect ratios.
- Implement Arabic RTL UI with Cairo font, deep navy sidebars, electric blue/cyan accents, and soft elevated cards matching the approved wireframes (`public/brand/yalla-center-wireframes.jpg`).
- Provide cohesive light and dark themes using centralized tokens, persisting user theme selection.

### R2. Multi-Tenant Architecture & Strict Role Boundaries
- Separate Platform Owner (`/owner`) and Educational Center (`/center/[centerSlug]`) portals with independent navigation, layouts, and role-based authorization.
- Support platform roles: Platform Owner, Center Administrator, Branch Manager, Receptionist, Accountant, Teacher, Parent, and Student.
- Enforce strict security guardrails: Students and teachers can upload and update only their own profile photo; all administrative data (names, codes, stages, grades, discounts, balances, enrollments, attendance, test scores) is strictly read-only for students and teachers across UI, server endpoints, and database RLS.
- Multi-branch and classroom schedule management with conflict prevention and timetable views.

### R3. Student Enrollment & Dual Teacher Compensation Engine
- Student enrollment with support for two payment models at the subject/group level: Center Subscription (نظام السنتر) and Private Lessons (نظام البرايفت), including percentage discounts, fixed-amount discounts, and 100% free enrollments.
- Center Subscription teacher compensation calculation: `Average Attendance = (Total Valid Attendance across Conducted Sessions) / (Conducted Sessions)`, `Compensation = Average Attendance × Contractual Fixed Rate`. Handled without division-by-zero, excluding canceled sessions.
- Private Lessons teacher compensation calculation: Split net eligible revenue (after discounts and free enrollments) between Center and Teacher based on agreed percentages, tracking invoiced vs. collected amounts.
- Financial management: invoices, partial payments, receipts, teacher advances, payroll review/approval/export, center expenses, book inventory, and cashier shift closing.

### R4. Fast Reception Attendance System
- Barcode/QR code scanning and student code lookup with immediate student verification (photo, group, class status, payment alert).
- Idempotent attendance logging preventing duplicate attendance scans for the same student within the same session.
- Automatic live updates to student attendance history, session statistics, teacher compensation tallies, and asynchronous parent notification events.

### R5. Hierarchical Teacher Materials & In-Session AI Exam Platform
- Teacher materials repository organized hierarchically (Stage → Grade → Subject → Unit → Lesson → Documents) with Google Drive folder linking, file uploads, and text indexing.
- AI exam generation integrated directly into the class session's Tests tab, creating exams strictly grounded in authorized indexed documents with teacher review, KaTeX mathematical notation, and answer keys.
- Branded printable A4 exam generation (Yalla Center logo top-left, Teacher name top-right, student name/code fields) and secure online student testing platform with countdown timer, autosave, and automated multiple-choice grading.

### R6. Asynchronous Notification Center & External Services
- Meta WhatsApp Business Cloud API integration and Firebase Cloud Messaging (PWA / Web push) with opt-in tracking, message queuing, and delivery logging.
- Guaranteed asynchronous, non-blocking execution: attendance recording, payment registration, and exam workflows must never block on external notification APIs.

### R7. Controlled Infrastructure & Data Safety
- Use Supabase PostgreSQL with fully normalized schema, Row Level Security (RLS), and transactional integrity.
- Never delete existing project files or production databases without authorization.
- Safely handle external integrations (WhatsApp, Google Drive, AI provider) with sandboxed/test modes when production credentials are not provided.

## Acceptance Criteria

### Financial Calculations & Data Integrity
- [ ] Unit tests verify Center Subscription calculation: 4 classes with attendances [12, 15, 11, 14] at rate 20 EGP yield exactly 260 EGP; canceled classes are excluded; zero conducted classes returns 0 without error.
- [ ] Unit tests verify Private Lessons calculation: 100 EGP price with 70/30 split yields 70 EGP / 30 EGP; 20% discount yields 56 EGP / 24 EGP; 100% free enrollment yields 0 EGP / 0 EGP without rounding leakage.
- [ ] Multi-tenant isolation test verifies Center A administrator or user cannot access or query Center B data.

### Security & Permission Guardrails
- [ ] Permission test verifies student can successfully update their own profile picture.
- [ ] Permission test verifies student attempting to update their name, student code, grade, or financial balance receives HTTP 403 Forbidden.
- [ ] Permission test verifies teacher cannot alter contractual salary rates or access another teacher's financial statements.

### Operational Workflows & UI
- [ ] Idempotent attendance test verifies that scanning a student code twice in the same session records exactly one attendance record.
- [ ] AI exam generator rejects exam creation if selected source materials are unindexed or insufficient, and places generated exams into teacher review before publishing.
- [ ] Printable A4 exam preview and PDF layout contains official Yalla Center logo top-left, teacher name top-right, student name and code inputs, and correctly formatted KaTeX math equations.
- [ ] Entire Next.js application builds without TypeScript or ESLint errors and is fully functional in Arabic RTL across desktop, tablet, and mobile breakpoints.
