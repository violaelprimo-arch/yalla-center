# YALLA CENTER — Milestone 2 Portal & Multi-Tenant Routing Architecture Report

**Author**: Explorer M2-1 (Routing & Portal Architecture Explorer)  
**Date**: 2026-10-18  
**Project**: Yalla Center SaaS Platform  
**Target Milestone**: Milestone 2 (Multi-Tenant Architecture, Portals & Strict Security Guardrails)  
**Working Directory**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m2_1`  

---

## 1. Executive Summary

Milestone 2 establishes the core multi-tenant portal infrastructure for Yalla Center, isolating the Platform Owner (`/owner`) from the Educational Center workspaces (`/center/[centerSlug]`). This report delivers the complete architectural design, layout specifications, dynamic tenant resolution mechanics, role-tailored navigation across all 8 platform roles, and concrete file boundaries for Worker M2.

All designs strictly comply with:
- **Authoritative Requirements**: `ORIGINAL_REQUEST.md` (R1 Brand Identity, R2 Multi-Tenant Architecture & Strict Role Boundaries).
- **Project Scope**: `PROJECT.md` (FEAT-07 Multi-Tenant URL Routing, FEAT-08 Tenant Resolution Middleware, FEAT-09 8-Role RBAC Model, FEAT-12 Center-to-Center Tenant Isolation).
- **Acceptance Criteria**: AC-3 (Multi-tenant isolation), AC-10 (Arabic RTL, Cairo typography, responsive viewports, clean Next.js build).
- **Visual Design System**: Official Midnight Navy (`#0B132B`), Electric Cyan (`#00A3FF`), Cairo font typography, RTL layout, and soft elevated cards (`.card-elevated`).

---

## 2. Multi-Tenant URL & Routing Architecture

### 2.1 Route Partitioning Overview

```
app/
├── (auth)/
│   └── login/                     # Centralized authentication & tenant redirection
├── owner/                         # PLATFORM OWNER SUPER-ADMIN PORTAL
│   ├── layout.tsx                 # Super-admin layout (OwnerSidebar, OwnerHeader)
│   ├── page.tsx                   # Global overview, cross-tenant KPIs, system health
│   ├── centers/
│   │   └── page.tsx               # Tenant centers management CRUD (status, plan, branches)
│   └── subscriptions/
│       └── page.tsx               # SaaS subscription tiers, MRR analytics, billing cycles
├── center/
│   └── [centerSlug]/              # TENANT-ISOLATED EDUCATIONAL CENTER WORKSPACE
│       ├── layout.tsx             # Dynamic tenant resolution Server Component + TenantProvider
│       ├── page.tsx               # Role-customized center dashboard & live timetable
│       ├── branches/              # Multi-branch & classroom schedules (with Explorer M2-3)
│       ├── students/              # Student directory & enrollment management
│       ├── teachers/              # Teacher roster & contractual compensation configuration
│       ├── reception/             # Fast reception attendance & barcode scanner HUD
│       ├── sessions/              # Class sessions & in-session tests tab
│       ├── materials/             # 6-tier hierarchical materials & Google Drive indexing
│       ├── exams/                 # Grounded AI exam generator & printable A4 export
│       ├── finance/               # Invoicing, receipts, teacher payroll & cashier shifts
│       ├── notifications/         # Real-time WhatsApp/FCM queue inspector
│       └── profile/               # Dedicated profile view (strictly guarded: photo-only for students/teachers)
├── layout.tsx                     # Root Layout: Cairo font, dir="rtl", theme script
└── globals.css                    # Design tokens & KaTeX BiDi styles
```

### 2.2 Dynamic Tenant Resolution Mechanism

In Next.js 14/15 App Router, tenant resolution operates in a two-stage pipeline:

1. **Edge Middleware (`middleware.ts`)**:
   - Intercepts requests targeting `/center/:path*`.
   - Extracts `:centerSlug`.
   - Validates slug format (alphanumeric and dashes, `^[a-z0-9-]+$`).
   - Injects the header `x-tenant-slug` into the downstream request headers.
   - If user visits root `/` or unknown paths, provides routing or passes through.

2. **Server Component Tenant Resolver (`app/center/[centerSlug]/layout.tsx`)**:
   - Receives dynamic route param `params: { centerSlug: string }`.
   - Calls DAL: `const tenant = await getDataProvider().getTenantBySlug(params.centerSlug)`.
   - **Resolution Invariants**:
     - **Tenant Not Found (`tenant === null`)**: Renders an Arabic 404 screen (`TenantNotFoundView`) with a clear message and a button to return to `/` or view available demo centers (`/center/al-maher`, `/center/al-rowad`).
     - **Tenant Suspended (`tenant.isActive === false`)**: Renders an Arabic 403 suspension notice (`TenantSuspendedView`) advising the administrator to contact platform billing.
     - **Tenant Valid (`tenant.isActive === true`)**:
       - Fetches tenant branches: `getDataProvider().getBranches(tenant.id)`.
       - Fetches tenant demo users: `getDataProvider().getUsers(tenant.id)`.
       - Hydrates the client-side `<TenantProvider>` with `{ tenant, branches, initialUsers }`.

```tsx
// Pattern for app/center/[centerSlug]/layout.tsx
import { getDataProvider } from '@/lib/dal';
import { TenantProvider } from '@/components/layout/tenant-context';
import { TenantLayout } from '@/components/layout/tenant-layout';
import { TenantNotFoundView } from '@/components/layout/tenant-not-found';
import { TenantSuspendedView } from '@/components/layout/tenant-suspended';

interface CenterLayoutProps {
  children: React.ReactNode;
  params: { centerSlug: string };
}

export default async function CenterDynamicLayout({ children, params }: CenterLayoutProps) {
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(params.centerSlug);

  if (!tenant) {
    return <TenantNotFoundView slug={params.centerSlug} />;
  }

  if (!tenant.isActive) {
    return <TenantSuspendedView tenant={tenant} />;
  }

  const [branches, users] = await Promise.all([
    dal.getBranches(tenant.id),
    dal.getUsers(tenant.id),
  ]);

  return (
    <TenantProvider tenant={tenant} branches={branches} initialUsers={users}>
      <TenantLayout>
        {children}
      </TenantLayout>
    </TenantProvider>
  );
}
```

---

## 3. Design System & Arabic Cairo RTL Layout

### 3.1 Color Palette & Token Hierarchy

The design system directly implements the tokens specified in `ORIGINAL_REQUEST.md` and already configured in `app/globals.css` and `tailwind.config.ts`:

| Element | Light Mode | Dark Mode | CSS Token | Description |
|:---|:---|:---|:---|:---|
| **Persistent Sidebar** | `#0B132B` | `#0B132B` | `--sidebar-background` | Deep Midnight Navy, persistent across both themes for strong brand anchor |
| **Sidebar Accent / Active** | `#00A3FF` | `#00A3FF` | `--brand-cyan-600` | Electric Cyan glow, active border indicator, active item background tint |
| **Sidebar Border** | `#1C2541` | `#1C2541` | `--sidebar-border` | Subtle navy border separator |
| **App Background** | `#F8FAFC` | `#070B19` | `--background` | Ultra-clean slate light / Obsidian Night dark |
| **Card Surface** | `#FFFFFF` | `#0B132B` | `--card` | Crisp white in light mode / Midnight Navy in dark mode |
| **Card Elevated** | `#F1F5F9` | `#111A38` | `--card-elevated` | Soft elevated secondary surface |
| **Primary Buttons / Badges** | `#00A3FF` | `#00A3FF` | `--primary` | Vibrant Electric Cyan with white text |
| **Success Feedback** | `#10B981` | `#10B981` | `--color-success` | Emerald green (active badges, successful scans) |
| **Warning / Alert** | `#F59E0B` | `#F59E0B` | `--color-warning` | Amber (pending payments, shift warning) |
| **Destructive / Error** | `#EF4444` | `#EF4444` | `--destructive` | Crimson red (absent, overdue, forbidden actions) |

### 3.2 Arabic RTL Rules & Best Practices

1. **Directionality**: Document root `<html lang="ar" dir="rtl">` ensures all natural flow is right-to-left.
2. **Sidebar Placement**: Placed on the **right** side of the screen in desktop viewports (`w-64 fixed right-0 top-0 bottom-0 border-l border-border`).
3. **Main Content Offset**: `pr-64` in desktop mode so content starts directly adjacent to the right sidebar without overlap.
4. **Direction-Aware Chevrons & Arrows**:
   - Navigation links, breadcrumbs, and back buttons use `RTLIcon` (`components/ui/rtl-icon.tsx`) with `rtl:rotate-180` to point in the correct semantic direction.
5. **Numbers & Currencies**:
   - Currency display formatted as `ج.م` (جنيه مصري) with `.tabular-nums` class for uniform financial tabular alignment.
6. **Mathematical Isolation**:
   - Any formulas or expressions rendered with KaTeX must use strict `dir="ltr"` isolation (`<span dir="ltr">...</span>` or `<MathView />`) to prevent Arabic BiDi character inversion.

---

## 4. Tenant Context & State Management (`TenantProvider`)

### 4.1 Interface Contract (`components/layout/tenant-context.tsx`)

```typescript
import React from 'react';
import { Tenant, Branch, User, UserRole } from '@/lib/dal/types';

export interface TenantContextType {
  tenant: Tenant;
  branches: Branch[];
  activeBranch: Branch | null;
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string | null) => void;
  currentUser: User;
  currentRole: UserRole;
  setCurrentUser: (user: User) => void;
  switchRole: (role: UserRole) => void;
  availableUsers: User[];
  isOwnerMode: boolean;
}
```

### 4.2 Interactive Role-Switching Engine (Demo Mode)

For seamless inspection and demonstration of the 8 roles without multiple browser logins:
- `TenantProvider` seeds its available users list from the mock database.
- It provides a `switchRole(role: UserRole)` handler:
  1. Finds the first seeded user in the tenant with that role (e.g. `user-admin-maher` for `CENTER_ADMIN`, `user-teacher-math` for `TEACHER`, `user-student-1001` for `STUDENT`, `user-recep-001` for `RECEPTIONIST`, etc.).
  2. If the user selects `PLATFORM_OWNER`, it sets `isOwnerMode: true` and activates the global owner profile (`user-owner-001`).
  3. Updates `currentUser` and `currentRole` in state.
  4. Reactively updates the sidebar navigation items, header role badge, and dashboard widgets in <10ms.

---

## 5. Role-Tailored Navigation Architecture (8 Platform Roles)

### 5.1 Route & Permission Matrix

The platform supports 11 primary operational modules under `/center/[centerSlug]`. The table below outlines exact route permissions and visibility across the 8 roles:

| # | Route | Arabic Title | Icon (Lucide) | Target Roles | Access Level |
|:---:|:---|:---|:---|:---|:---|
| 1 | `/center/[slug]` | لوحة التحكم | `LayoutDashboard` | All 8 Roles | Role-customized dashboard |
| 2 | `/center/[slug]/branches` | الفروع والقاعات | `Building2` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER` | Multi-branch CRUD & timetable conflict checker |
| 3 | `/center/[slug]/students` | شؤون الطلاب والتسجيل | `GraduationCap` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `ACCOUNTANT`, `RECEPTIONIST` | Student directory, enrollment, barcodes |
| 4 | `/center/[slug]/teachers` | المعلمون وحسابات الحصص | `Briefcase` | `PLATFORM_OWNER`, `CENTER_ADMIN` | Teacher roster, contractual rates (Admin only) |
| 5 | `/center/[slug]/reception` | الاستقبال والحضور السريع | `QrCode` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `RECEPTIONIST`, `STUDENT`, `PARENT` | Fast scan HUD for staff; personal log for student/parent |
| 6 | `/center/[slug]/sessions` | الحصص والمجموعات | `CalendarClock` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `TEACHER`, `STUDENT`, `PARENT` | Class schedule, attendance rosters, in-session tests |
| 7 | `/center/[slug]/materials` | بنك الملازم والمذكرات | `FolderTree` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `TEACHER`, `STUDENT` | 6-tier materials, Google Drive sync, downloads |
| 8 | `/center/[slug]/exams` | الامتحانات الذكية والطباعة | `FileSpreadsheet` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `TEACHER`, `STUDENT`, `PARENT` | AI generator for teachers; online runner for students; printable A4 |
| 9 | `/center/[slug]/finance` | الخزينة والمالية | `Wallet` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER`, `ACCOUNTANT`, `TEACHER`, `STUDENT`, `PARENT` | Scoped by role: Admin/Accountant=full; Teacher=own statement; Student=own fees |
| 10 | `/center/[slug]/notifications` | مركز الإشعارات والواتساب | `Bell` | `PLATFORM_OWNER`, `CENTER_ADMIN`, `BRANCH_MANAGER` | WhatsApp/FCM live delivery log & queue inspector |
| 11 | `/center/[slug]/profile` | الملف الشخصي | `UserCircle` | All 8 Roles | Photo update ONLY for students/teachers; admin fields 403 locked |

### 5.2 Role Specificities & Guardrails

1. **`PLATFORM_OWNER`**:
   - In `/owner`: Full access to global platform controls, centers CRUD, SaaS billing.
   - In `/center/[centerSlug]`: Display a persistent top banner: *"أنت تتصفح كمالك للمنصة (وصول شامل) — [العودة لبوابة المالك]"*.

2. **`CENTER_ADMIN`**:
   - Complete operational control within their specific tenant.
   - Cannot view or access other tenants (`/center/al-rowad` returns 403 Forbidden).

3. **`BRANCH_MANAGER`**:
   - Access scoped to assigned branch (e.g. `branch-nasr-city`).
   - Header branch selector locks to their branch by default.
   - Cannot modify global teacher base contractual rates.

4. **`ACCOUNTANT`**:
   - Finance-centric workspace: Invoices, payments, receipts, cashier shifts closing, teacher payroll calculation & approval.
   - Cannot modify course materials or exam questions.

5. **`RECEPTIONIST`**:
   - Immediate access to `/center/[centerSlug]/reception` (Fast barcode scan HUD).
   - High-contrast student verification card (photo, active group, payment alert).
   - Can close cashier shift. Cannot modify student grades, stages, or discounts.

6. **`TEACHER`**:
   - Sees only their assigned groups, materials, and exams.
   - Dedicated "كشف حسابي" tab under finance showing Center Subscription average attendance formula or Private Lessons split.
   - **Profile Guardrail**: Can update **only** profile photo (`avatar_url`). All other fields disabled with lock icons.

7. **`STUDENT`**:
   - Sees their timetable, online exam runner, personal attendance history, and fee balance.
   - **Profile Guardrail**: Can update **only** profile photo (`avatar_url`). Attempting to alter student code, name, grade, or balance receives HTTP 403 Forbidden.

8. **`PARENT`**:
   - Sees linked children's attendance logs, upcoming sessions, exam scores, and tuition receipts.

---

## 6. Platform Owner Super-Admin Portal (`/owner`)

### 6.1 Layout Architecture (`app/owner/layout.tsx`)
- Wrapped in `OwnerLayout`:
  - `OwnerSidebar`: Midnight Navy background (`#0B132B`), official Yalla Center logo with dark theme, navigation items:
    1. **لوحة القيادة المركزية** (`/owner`) — Icon: `LayoutDashboard`
    2. **إدارة السناتر والمراكز** (`/owner/centers`) — Icon: `Building2`
    3. **باقات الاشتراكات والفوترة** (`/owner/subscriptions`) — Icon: `CreditCard`
    4. **العودة للواجهة الرئيسية** (`/`) — Icon: `Home`
  - `OwnerHeader`:
    - Platform Owner badge: *"مالك المنصة — م. إسلام خليل"*
    - System health indicator (Green pulse: *"السيرفر متصل"*).
    - Quick link: *"تصفح السناتر كمعاينة"*
    - Theme toggle.

### 6.2 Pages Specification

#### 1. Global Overview (`app/owner/page.tsx`)
- **Aggregated Metric Cards (4 Cards)**:
  1. *المراكز التعليمية المسجلة*: `2` مراكز نشطة (100% نسبة التشغيل).
  2. *إجمالي الطلاب المقيدين*: `1,450+` طالب عبر جميع السناتر.
  3. *الدخل الشهري للمنصة (MRR)*: `18,500 ج.م` من الاشتراكات السحابية.
  4. *حالات الحضور المسجلة*: `24,800+` عملية حضور ناجحة.
- **System Health & Security Monitor**:
  - PostgreSQL 3NF: متصل (22 جدولاً نشطاً مع RLS)
  - WhatsApp Business Cloud API: جاهز (Queue 0ms latency)
  - Firebase Cloud Messaging: متصل
  - Sandbox Mode: مفعل للتشغيل الذاتي السلس (Demo Integrity)
- **Active Centers Overview Table**:
  - Column headers: اسم السنتر، المعرف (Slug)، الخطة، الفروع، الطلاب، الحالة (نشط/معلق)، الإجراءات.
  - Action button: *"دخول بيئة السنتر ←"* navigating directly to `/center/[slug]`.

#### 2. Centers Management (`app/owner/centers/page.tsx`)
- **Search & Filter Controls**: Search by center name or slug, filter by plan (Starter, Pro, Enterprise), filter by status (Active / Suspended).
- **"إضافة سنتر تعليمي جديد" Modal**:
  - Fields: اسم السنتر بالعربية، الاسم بالإنجليزية، الرابط المخصص (Slug)، رقم الهاتف، العنوان، باقة الاشتراك.
  - Submits to API or updates mock tenant list, immediately generating the new center route `/center/[newSlug]`.
- **Center Action Row**:
  - زر تبديل الحالة: تفعيل / تعليق السنتر (Toggle active status).
  - زر تعديل بيانات السنتر.
  - زر تصفح السنتر في نافذة جديدة.

#### 3. SaaS Subscriptions & Billing (`app/owner/subscriptions/page.tsx`)
- **Subscription Tier Cards**:
  1. **باقة البداية (Starter)**: 1,500 ج.م / شهرياً (حتى 200 طالب، فرع واحد).
  2. **باقة المحترفين (Pro)**: 3,500 ج.م / شهرياً (حتى 1,000 طالب، 3 فروع، تكامل واتساب).
  3. **باقة المؤسسات (Enterprise)**: 7,500 ج.م / شهرياً (طلاب غير محدود، فروع متعددة، دعم فني 24/7).
- **Active Subscriptions Log**:
  - جدول الاشتراكات ومواعيد التجديد، الفواتير الصادرة، وسجل الدفعات الإلكترونية.

---

## 7. Educational Center Workspace (`/center/[centerSlug]`)

### 7.1 Layout Architecture (`app/center/[centerSlug]/layout.tsx`)
- **Sidebar (`components/layout/sidebar.tsx`)**:
  - Sticky right sidebar with deep navy `#0B132B`.
  - Brand header: Official `<BrandLogo theme="dark" width={150} height={38} />` + Center Name in Cairo bold + Plan Pill Badge.
  - Dynamic navigation list filtered by `currentRole`.
  - User footer card:
    - User Avatar with status dot.
    - User Full Name & Role Badge in distinctive colors.
    - Quick logout / role switch trigger.
- **Top Header (`components/layout/header.tsx`)**:
  - Breadcrumbs indicating current route.
  - Branch Selector Dropdown: Switches active branch (`branch-nasr-city` vs `branch-heliopolis`).
  - **Demo Role Switcher Widget**: Quick select element allowing reviewers to switch between any of the 8 roles in 1 click.
  - Theme toggle (Light/Dark).
  - User profile dropdown menu with link to `/center/[centerSlug]/profile`.

### 7.2 Center Overview Dashboard (`app/center/[centerSlug]/page.tsx`)

Customized dynamically depending on `currentRole`:

#### When viewing as `CENTER_ADMIN` or `BRANCH_MANAGER`:
- **Header & Quick Action Bar**:
  - Welcome greeting: *"مرحباً بك في لوحة تحكم سنتر الماهر النموذجي"*
  - Quick action buttons:
    - `[مسح حضور سريع بالباركود]` (Electric Cyan primary button linking to `/center/[slug]/reception`)
    - `[تسجيل طالب جديد]` (linking to `/center/[slug]/students`)
    - `[جدول حصص اليوم]` (linking to `/center/[slug]/sessions`)
    - `[إغلاق مناوبة الكاشير]` (linking to `/center/[slug]/finance`)
- **4 Key Stat Cards**:
  1. *الطلاب المقيدون*: `850` طالب (+12% هذا الشهر).
  2. *حضور اليوم*: `142` طالب حاضر من أصل `160` متوقعين (88.7%).
  3. *المتحصلات النقدية اليوم*: `11,360 ج.م` (خزينة اليوم).
  4. *الامتحانات وبنك الأسئلة*: `24` امتحان نشط (بما فيها اختبارات الذكاء الاصطناعي).
- **Main Grid**:
  - *Right Column (65% width)*: جدول حصص اليوم الميدانية (Session cards with start time, teacher, subject, classroom, capacity, and live status badge).
  - *Left Column (35% width)*: رادار الحضور المباشر (Recent reception scans with student photo, name, code, group, and time).

#### When viewing as `TEACHER`:
- Personalized header: *"مرحباً أ. أحمد الشناوي — مدرس الرياضيات"*
- Active teaching groups schedule for today.
- Monthly accrued compensation preview (Average attendance calculation summary).
- Direct buttons to generate AI Exam from indexed materials and view student attendance sheets.

#### When viewing as `STUDENT`:
- Personalized student card: Photo, Name (*أحمد محمد علي*), Code (`STD-1001`), Stage & Grade (*الثانوية العامة - الصف الثالث الثانوي*).
- Upcoming session alert: *"حصتك القادمة: مراجعة الجبر والتفاضل — اليوم الساعة 02:00 م (قاعة د. زويل 1)"*.
- Financial balance card: *"الرصيد المالي: 0.00 ج.م (تم السداد بالكامل)"*.
- Link to available online tests.

---

## 8. Exact Implementation Steps & File Boundaries for Worker M2

Worker M2 should implement the following concrete files and components in order:

### Phase 1: Shared UI Primitives (`components/ui/`)
1. `components/ui/button.tsx`: Polymorphic button supporting `primary` (Electric Cyan), `secondary` (Midnight Navy), `outline`, `ghost`, `destructive`, and size variants.
2. `components/ui/card.tsx`: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter using `.card-elevated`.
3. `components/ui/badge.tsx`: Pill badge with variants (`cyan`, `navy`, `success`, `warning`, `destructive`, `outline`).
4. `components/ui/select.tsx`: RTL-compatible custom dropdown selector.
5. `components/ui/dialog.tsx`: Accessible modal dialog for modals (e.g. creating a new center).

### Phase 2: Navigation & Layout Components (`components/layout/`)
1. `components/layout/tenant-context.tsx`: Complete `TenantProvider`, `useTenant` hook, state for `activeBranch`, `currentRole`, `currentUser`, and `switchRole`.
2. `components/layout/sidebar.tsx`: Persistent Midnight Navy sidebar with 8-role filtered navigation items and official dark logo.
3. `components/layout/header.tsx`: Sticky top bar with branch dropdown, demo role switcher, theme toggle, and user menu.
4. `components/layout/tenant-layout.tsx`: Client container bringing together Sidebar, Header, mobile drawer, and main content area.
5. `components/layout/tenant-not-found.tsx`: High-polish Arabic 404 screen for invalid tenant slugs with links to known centers.
6. `components/layout/tenant-suspended.tsx`: High-polish Arabic warning screen for suspended tenant centers.
7. `components/layout/owner-sidebar.tsx`: Super-admin sidebar for `/owner` routes.
8. `components/layout/owner-header.tsx`: Super-admin header for `/owner` routes.
9. `components/layout/owner-layout.tsx`: Layout container for `/owner`.

### Phase 3: Platform Owner Portal Routes (`app/owner/`)
1. `app/owner/layout.tsx`: Server component applying `OwnerLayout`.
2. `app/owner/page.tsx`: Global overview dashboard with platform KPIs, health metrics, and active centers summary.
3. `app/owner/centers/page.tsx`: Center management CRUD with search, filter, active/suspended toggle, and create center modal.
4. `app/owner/subscriptions/page.tsx`: SaaS subscription plans, revenue analytics, and renewal tracking.

### Phase 4: Educational Center Workspace Routes (`app/center/[centerSlug]/`)
1. `app/center/[centerSlug]/layout.tsx`: Dynamic tenant resolver calling `getTenantBySlug` and hydrating `TenantProvider`.
2. `app/center/[centerSlug]/page.tsx`: Multi-role center overview dashboard with role-tailored KPI cards, quick action buttons, and today's timetable.
3. Placeholder/stub routes for all navigation destinations:
   - `app/center/[centerSlug]/branches/page.tsx` (Coordinates with Explorer M2-3 for timetable conflict algorithm)
   - `app/center/[centerSlug]/students/page.tsx`
   - `app/center/[centerSlug]/teachers/page.tsx`
   - `app/center/[centerSlug]/reception/page.tsx`
   - `app/center/[centerSlug]/sessions/page.tsx`
   - `app/center/[centerSlug]/materials/page.tsx`
   - `app/center/[centerSlug]/exams/page.tsx`
   - `app/center/[centerSlug]/finance/page.tsx`
   - `app/center/[centerSlug]/notifications/page.tsx`
   - `app/center/[centerSlug]/profile/page.tsx` (Coordinates with Explorer M2-2 for HTTP 403 guardrails & avatar-only uploads)

### Phase 5: Routing Middleware & API Endpoints
1. `middleware.ts`: Next.js middleware extracting `centerSlug`, setting `x-tenant-slug`, and protecting routes.
2. `app/api/owner/centers/route.ts`: API route for creating and updating tenant centers.

---

## 9. Concrete Code Specifications for Worker M2

### 9.1 Tenant Context Blueprint (`components/layout/tenant-context.tsx`)

```tsx
'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { Tenant, Branch, User, UserRole } from '@/lib/dal/types';

export interface TenantContextType {
  tenant: Tenant;
  branches: Branch[];
  activeBranch: Branch | null;
  activeBranchId: string | null;
  setActiveBranchId: (id: string | null) => void;
  currentUser: User;
  currentRole: UserRole;
  setCurrentUser: (user: User) => void;
  switchRole: (role: UserRole) => void;
  availableUsers: User[];
  isOwnerMode: boolean;
}

const TenantContext = createContext<TenantContextType | null>(null);

export function TenantProvider({
  children,
  tenant,
  branches,
  initialUsers,
}: {
  children: React.ReactNode;
  tenant: Tenant;
  branches: Branch[];
  initialUsers: User[];
}) {
  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    branches[0]?.id || null
  );

  const [availableUsers] = useState<User[]>(initialUsers);

  // Default initial user to Center Admin
  const defaultAdmin = useMemo(
    () => initialUsers.find((u) => u.role === 'CENTER_ADMIN') || initialUsers[0],
    [initialUsers]
  );

  const [currentUser, setCurrentUser] = useState<User>(defaultAdmin);
  const [isOwnerMode, setIsOwnerMode] = useState<boolean>(false);

  const activeBranch = useMemo(
    () => branches.find((b) => b.id === activeBranchId) || null,
    [branches, activeBranchId]
  );

  const switchRole = (role: UserRole) => {
    if (role === 'PLATFORM_OWNER') {
      setIsOwnerMode(true);
      const ownerUser: User = {
        id: 'user-owner-001',
        role: 'PLATFORM_OWNER',
        fullName: 'م. إسلام خليل (مدير المنصة)',
        email: 'owner@yallacenter.com',
        avatarUrl: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e',
        balanceDue: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCurrentUser(ownerUser);
      return;
    }

    setIsOwnerMode(false);
    const foundUser = availableUsers.find((u) => u.role === role);
    if (foundUser) {
      setCurrentUser(foundUser);
    } else {
      // Synthesize demo user if none exists in seed
      setCurrentUser({
        id: `demo-${role.toLowerCase()}`,
        tenantId: tenant.id,
        role,
        fullName: `مستخدم تجريبي (${role})`,
        balanceDue: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        branches,
        activeBranch,
        activeBranchId,
        setActiveBranchId,
        currentUser,
        currentRole: currentUser.role,
        setCurrentUser,
        switchRole,
        availableUsers,
        isOwnerMode,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
```

### 9.2 Navigation Registry Specification (`components/layout/nav-items.ts`)

```typescript
import {
  LayoutDashboard,
  Building2,
  GraduationCap,
  Briefcase,
  QrCode,
  CalendarClock,
  FolderTree,
  FileSpreadsheet,
  Wallet,
  Bell,
  UserCircle,
  LucideIcon,
} from 'lucide-react';
import { UserRole } from '@/lib/dal/types';

export interface CenterNavItem {
  id: string;
  titleAr: string;
  href: (slug: string) => string;
  icon: LucideIcon;
  roles: UserRole[];
  badge?: string;
}

export const CENTER_NAV_ITEMS: CenterNavItem[] = [
  {
    id: 'dashboard',
    titleAr: 'لوحة التحكم',
    href: (slug) => `/center/${slug}`,
    icon: LayoutDashboard,
    roles: [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
      'RECEPTIONIST',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
  },
  {
    id: 'branches',
    titleAr: 'الفروع والقاعات',
    href: (slug) => `/center/${slug}/branches`,
    icon: Building2,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER'],
  },
  {
    id: 'students',
    titleAr: 'شؤون الطلاب',
    href: (slug) => `/center/${slug}/students`,
    icon: GraduationCap,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'RECEPTIONIST'],
  },
  {
    id: 'teachers',
    titleAr: 'شؤون المعلمين',
    href: (slug) => `/center/${slug}/teachers`,
    icon: Briefcase,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN'],
  },
  {
    id: 'reception',
    titleAr: 'الاستقبال والحضور',
    href: (slug) => `/center/${slug}/reception`,
    icon: QrCode,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'RECEPTIONIST', 'STUDENT', 'PARENT'],
    badge: 'سريع',
  },
  {
    id: 'sessions',
    titleAr: 'الحصص والمجموعات',
    href: (slug) => `/center/${slug}/sessions`,
    icon: CalendarClock,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'TEACHER', 'STUDENT', 'PARENT'],
  },
  {
    id: 'materials',
    titleAr: 'المذكرات والملازم',
    href: (slug) => `/center/${slug}/materials`,
    icon: FolderTree,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'TEACHER', 'STUDENT'],
  },
  {
    id: 'exams',
    titleAr: 'الامتحانات التوليدية',
    href: (slug) => `/center/${slug}/exams`,
    icon: FileSpreadsheet,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'TEACHER', 'STUDENT', 'PARENT'],
    badge: 'AI',
  },
  {
    id: 'finance',
    titleAr: 'الخزينة والمالية',
    href: (slug) => `/center/${slug}/finance`,
    icon: Wallet,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'TEACHER', 'STUDENT', 'PARENT'],
  },
  {
    id: 'notifications',
    titleAr: 'مركز الإشعارات',
    href: (slug) => `/center/${slug}/notifications`,
    icon: Bell,
    roles: ['PLATFORM_OWNER', 'CENTER_ADMIN', 'BRANCH_MANAGER'],
  },
  {
    id: 'profile',
    titleAr: 'الملف الشخصي',
    href: (slug) => `/center/${slug}/profile`,
    icon: UserCircle,
    roles: [
      'PLATFORM_OWNER',
      'CENTER_ADMIN',
      'BRANCH_MANAGER',
      'ACCOUNTANT',
      'RECEPTIONIST',
      'TEACHER',
      'STUDENT',
      'PARENT',
    ],
  },
];
```

---

## 10. Verification Method & Test Plan

To independently verify Worker M2's implementation:

1. **Vitest Test Suite Verification**:
   ```bash
   npx vitest run tests/security/rbac-guardrails.test.ts
   npx vitest run
   ```
   Ensures AC-3, AC-4, AC-5, AC-6 continue to pass 100% with zero regressions.

2. **Next.js Production Build Verification**:
   ```bash
   npx next build
   ```
   Ensures:
   - Dynamic route `/center/[centerSlug]` builds cleanly.
   - `/owner`, `/owner/centers`, and `/owner/subscriptions` compile with 0 TypeScript/ESLint errors.
   - Arabic RTL styling and metadata hydrate without console warnings.

3. **Interactive Visual Spot-Check**:
   - Visit `http://localhost:3000/owner` -> verify Platform Owner KPIs, centers table, and SaaS tiers.
   - Visit `http://localhost:3000/center/al-maher` -> verify Deep Midnight Navy sidebar, Cairo typography, Electric Cyan active state, and branch selector.
   - Use the Role Switcher in header: Switch to `TEACHER`, `STUDENT`, `RECEPTIONIST`, `ACCOUNTANT`, and verify the sidebar navigation updates dynamically and immediately.
   - Visit an invalid tenant URL `http://localhost:3000/center/invalid-center-xyz` -> verify the custom Arabic 404 screen renders cleanly with a link back to valid centers.

---

## 11. Coordination Notes with Peer Explorers

- **Explorer M2-2 (Security Guardrails & RBAC)**:
  - We have reserved the route `/center/[centerSlug]/profile` with photo-only edit rights for students/teachers.
  - The navigation items automatically hide administrative modules for unauthorized roles.
  - If a student directly navigates to `/center/[centerSlug]/teachers` or `/finance`, the page/layout must return a 403 Forbidden Access Guard.
- **Explorer M2-3 (Branch & Timetable Conflict)**:
  - We have reserved `/center/[centerSlug]/branches` in the navigation for `CENTER_ADMIN` and `BRANCH_MANAGER`.
  - The `TenantContext` provides `branches`, `activeBranchId`, and `setActiveBranchId` to synchronize branch selection seamlessly with their timetable view.
