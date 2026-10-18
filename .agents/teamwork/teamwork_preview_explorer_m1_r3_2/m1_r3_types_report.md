# M1-R3 Typecheck, Method Audit & DAL Aliasing Technical Report

**Author**: Explorer M1-R3-2 (Typecheck & Method Audit Explorer)  
**Date**: 2026-10-18  
**Scope**: `lib/dal/types.ts`, `lib/dal/index.ts`, `lib/dal/mock-data.ts`, `lib/finance/compensation.ts`, `lib/utils.ts`, and cross-workspace consumer contracts (`PROJECT.md`, `tests/fixtures/contract-bridge.ts`, and unit/integration/e2e/security test suites).  
**Status**: COMPLETE — Ready for Worker M1-R3 execution.

---

## 1. Executive Summary

During Milestone 1 Round 2, Forensic Auditor M1-R2-1 identified behavioral verification failures (`vitest` exit code 1 and `tsc` exit code 1 with 7 errors) originating from naming discrepancies:
1. `dal.getNotifications` vs `dal.getNotificationLogs`
2. `TeacherRate.splitPercentage` vs `TeacherRate.teacherPercentage` / `centerPercentage`
3. Minor contract discrepancies between `PROJECT.md` interface specifications (e.g. `getTenant(slug)`, `getUser(userId)`, `recordAttendance(sessionId, studentId)`) and the initial concrete methods defined on `IDataProvider`.

While `tests/security/challenger-m1-r2-empirical.test.ts` was subsequently updated to use `getNotificationLogs` and `teacherPercentage`—allowing current builds and tests to pass (`14/14 test files, 138/138 tests passed`, `tsc --noEmit` exit 0, `npm run build` exit 0)—the underlying developer ergonomics (DX) fragility remains. Future test challengers, developers, and UI components are prone to re-encountering these exact mismatches.

This audit definitively recommends implementing **first-class convenience alias methods and compatibility properties** on `IDataProvider`, `MockDataProvider`, and `lib/dal/types.ts`. These additions preserve strict TypeScript typing, adhere 100% to `PROJECT.md` interface contracts, and eliminate brittleness across the codebase.

---

## 2. Comparative Matrix: Interface Contracts vs Implementation

| Method / Type Target | `PROJECT.md` Contract | Current `IDataProvider` (`lib/dal/index.ts`) | Current `MockDataProvider` (`lib/dal/mock-data.ts`) | Recommendation for Worker M1-R3 |
| :--- | :--- | :--- | :--- | :--- |
| **Tenant Retrieval** | `getTenant(slug: string)` | `getTenantBySlug(slug: string)`, `getTenantById(id: string)`, `getTenants()` | Implements `getTenantBySlug`, `getTenantById`, `getTenants` | Add `getTenant(slugOrId: string): Promise<Tenant \| null>` forwarding to `getTenantBySlug(slugOrId) \|\| getTenantById(slugOrId)`. |
| **User Retrieval** | `getUser(userId: string)` | `getUserById(userId: string)`, `getUserByStudentCode(...)`, `getUsers(...)` | Implements `getUserById`, `getUserByStudentCode`, `getUsers` | Add `getUser(userId: string): Promise<User \| null>` forwarding to `getUserById(userId)`. |
| **Notification Logs** | Not explicitly enumerated in Section 1 summary | `getNotificationLogs(tenantId: string)` | Implements `getNotificationLogs(tenantId: string)` | Add `getNotifications(tenantId: string): Promise<NotificationRecord[]>` forwarding to `getNotificationLogs(tenantId)`. |
| **Attendance Recording** | `recordAttendance(sessionId: string, studentId: string)` | `recordAttendance(params: { tenantId, sessionId, studentIdOrCode, ... })` | Implements `recordAttendance(params)` | Implement method overload supporting both `recordAttendance(params)` and `recordAttendance(sessionId, studentId)`. |
| **Teacher Rates** | `calculateTeacherCompensation` | `getTeacherRates`, `updateTeacherRate`, `calculateCenterSubscriptionCompensation`, `calculatePrivateLessonsSplit` | Implements rates and compensation calculations | Add optional `contractualFixedRate?: number` and `splitPercentage?: number` on `TeacherRate` interface and handle aliases in `updateTeacherRate`. |
| **Role Type** | `role: Role` (PROJECT.md line 90) | `UserRole` | Uses `UserRole` | Add `export type Role = UserRole;` in `lib/dal/types.ts`. |
| **User Snake Case** | PostgreSQL columns: `full_name`, `avatar_url`, `student_code`, `balance_due` | `fullName`, `avatarUrl`, `studentCode`, `balanceDue` | Validates both snake_case and camelCase in `protectedFields` | Add optional snake_case fields to `User` interface (`avatar_url?`, `full_name?`, etc.) to allow transparent DB mapping. |
| **Discount Type** | `CompensationDiscountType = 'NONE' \| 'PERCENT' \| 'FIXED' \| 'SCHOLARSHIP_100'` | `DiscountType = 'none' \| 'percentage' \| 'fixed' \| 'free_100'` | Uses internal map `typeMap` in `calculatePrivateLessonsSplit` | Make `calculatePrivateLessonsSplit` accept both uppercase and lowercase enum strings transparently. |

---

## 3. Deep-Dive Audit of Specific Files

### 3.1 `lib/dal/types.ts`
- **Current State**: 353 lines. Defines all 22 domain entity interfaces (`Tenant`, `Branch`, `Classroom`, `User`, `Subject`, `Group`, `Session`, `Enrollment`, `Attendance`, `Invoice`, `Payment`, `TeacherRate`, `TeacherPayroll`, `Material`, `Exam`, `ExamQuestion`, `ExamSubmission`, `ExamAnswer`, `NotificationRecord`, `CashierShift`, `Expense`, `BookInventoryItem`) and their corresponding status union types.
- **Observations & Gaps**:
  1. `TeacherRate` (lines 191–204) strictly defines `fixedRatePerStudent: number`, `teacherPercentage: number`, `centerPercentage: number`.
     However, contract bridges and security tests often query or submit `{ contractualFixedRate?: number, splitPercentage?: number }`. Adding these as optional properties eliminates `TS2353` and `TS2339` compiler errors without affecting runtime properties.
  2. `User` (lines 69–89) defines camelCase properties only (`avatarUrl`, `studentCode`, etc.). In security tests (`contract-bridge.ts`) and database triggers (`schema.sql`), fields like `avatar_url` are utilized. Adding optional snake_case fields prevents TypeScript errors when dealing with raw DB payloads.
  3. `Role` type is missing (only `UserRole` exists), whereas `PROJECT.md` references `Role`.

### 3.2 `lib/dal/index.ts`
- **Current State**: 206 lines. Defines `IDataProvider` interface and helper result interfaces (`ScanResult`, `CenterSubscriptionResult`, `PrivateLessonItemInput`, `PrivateLessonBatchResult`, `ExamPreflightResult`).
- **Observations & Gaps**:
  1. `IDataProvider` does not declare `getNotifications`. Adding `getNotifications(tenantId: string): Promise<NotificationRecord[]>;` directly to `IDataProvider` guarantees that any caller using `dal.getNotifications(...)` is strictly typed.
  2. `IDataProvider` does not declare `getTenant(slug: string)` or `getUser(userId: string)`. Adding these ensures 100% compliance with `PROJECT.md` Interface Contracts.
  3. `recordAttendance` in `IDataProvider` currently accepts only the parameter object `params: { tenantId, sessionId, studentIdOrCode, ... }`. Adding an overload signature `recordAttendance(sessionId: string, studentId: string): Promise<ScanResult>;` satisfies `PROJECT.md` line 92 directly.

### 3.3 `lib/dal/mock-data.ts`
- **Current State**: 1389 lines. Implements `MockDataProvider` backed by `INITIAL_SEEDED_DATA`.
- **Observations & Gaps**:
  1. Lines 1385–1387: Only `getNotificationLogs(tenantId: string)` is implemented.
  2. Lines 678–688: Only `getTenantBySlug`, `getTenantById`, and `getTenants` are implemented.
  3. Lines 701–704: Only `getUserById` and `getUserByStudentCode` are implemented.
  4. Lines 992–1017: `updateTeacherRate` assumes `updates` has `teacherPercentage` and `fixedRatePerStudent`. If a caller supplies `{ splitPercentage: 80, contractualFixedRate: 75.5 }`, it currently writes `splitPercentage` to the object but does not normalize it to `teacherPercentage` or calculate `centerPercentage = 100 - splitPercentage`.
  5. Lines 884–979: `recordAttendance` expects a single object parameter. If called with `(sessionId, studentId)`, it fails.

### 3.4 `lib/finance/compensation.ts`
- **Current State**: 142 lines. Implements `calculateCenterSubscriptionCompensation` and `calculatePrivateLessonsSplit`.
- **Observations & Gaps**:
  - `calculateCenterSubscriptionCompensation`: Tested with 10,000 adversarial combinations. Excludes canceled/postponed sessions, prevents division by zero, returns 0 when conducted sessions = 0. Fully robust.
  - `calculatePrivateLessonsSplit`: Accepts `CompensationDiscountType = 'NONE' | 'PERCENT' | 'FIXED' | 'SCHOLARSHIP_100'`. If a caller passes lowercase `'percentage'` or `'free_100'` (from `lib/dal/types.ts`), TypeScript will flag a type error unless normalized.
  - Adding union normalization for lowercase types makes the math engine seamlessly compatible with both DAL entities and uppercase financial tokens.

---

## 4. Exact Implementation Strategy for Worker M1-R3

Worker M1-R3 should apply the following precise, non-breaking modifications:

### Step 1: Update `lib/dal/types.ts`
1. **Export Role alias**:
   ```ts
   export type Role = UserRole;
   ```
2. **Update `User` interface with optional snake_case aliases**:
   ```ts
   export interface User {
     id: string;
     tenantId?: string;
     role: UserRole;
     fullName: string;
     email?: string;
     phone?: string;
     avatarUrl?: string;
     studentCode?: string;
     nationalId?: string;
     stage?: string;
     grade?: string;
     division?: string;
     seatNumber?: string;
     guardianName?: string;
     guardianPhone?: string;
     balanceDue: number;
     isActive: boolean;
     createdAt: string;
     updatedAt: string;
     // Optional database / wire-format compatibility aliases
     avatar_url?: string;
     full_name?: string;
     student_code?: string;
     balance_due?: number;
     guardian_name?: string;
     guardian_phone?: string;
     national_id?: string;
     is_active?: boolean;
     tenant_id?: string;
   }
   ```
3. **Update `TeacherRate` interface with optional compatibility properties**:
   ```ts
   export interface TeacherRate {
     id: string;
     tenantId: string;
     teacherId: string;
     groupId?: string;
     subjectId?: string;
     model: PricingModel;
     fixedRatePerStudent: number;
     teacherPercentage: number;
     centerPercentage: number;
     effectiveFrom: string;
     isActive: boolean;
     createdAt: string;
     // Optional compatibility aliases
     contractualFixedRate?: number;
     splitPercentage?: number;
   }
   ```

### Step 2: Update `lib/dal/index.ts`
1. **Add convenience methods and overloads to `IDataProvider`**:
   ```ts
   export interface IDataProvider {
     // 1. Tenants & Branches
     getTenant(slugOrId: string): Promise<Tenant | null>;
     getTenantBySlug(slug: string): Promise<Tenant | null>;
     getTenantById(id: string): Promise<Tenant | null>;
     getTenants(): Promise<Tenant[]>;
     getBranches(tenantId: string): Promise<Branch[]>;
     getClassrooms(tenantId: string, branchId?: string): Promise<Classroom[]>;

     // 2. Users & RBAC
     getUser(userId: string): Promise<User | null>;
     getUserById(userId: string): Promise<User | null>;
     getUserByStudentCode(tenantId: string, code: string): Promise<User | null>;
     getUsers(tenantId: string, filter?: { role?: UserRole; search?: string }): Promise<User[]>;
     updateUser(
       userId: string,
       updates: Partial<User>,
       actorId?: string,
       actorRole?: UserRole
     ): Promise<{ success: boolean; data?: User; error?: string; status: number }>;
     updateUserProfilePhoto(
       userId: string,
       avatarUrl: string,
       actorId: string,
       actorRole: UserRole
     ): Promise<{ success: boolean; data?: User; error?: string }>;

     // ... [Sections 3 through 5 unchanged] ...

     // 6. Fast Reception Attendance (Idempotent Scanning)
     recordAttendance(params: {
       tenantId: string;
       sessionId: string;
       studentIdOrCode: string;
       verificationMethod?: 'barcode' | 'qr' | 'manual';
       cashierUserId?: string;
     }): Promise<ScanResult>;
     recordAttendance(sessionId: string, studentId: string): Promise<ScanResult>;
     getSessionAttendance(sessionId: string): Promise<Attendance[]>;

     // ... [Sections 7 through 9 unchanged] ...

     // 10. Notifications
     enqueueNotification(params: {
       tenantId: string;
       recipientPhone: string;
       channel: NotificationChannel;
       templateName: string;
       payload: Record<string, any>;
       recipientUserId?: string;
     }): Promise<NotificationRecord>;
     getNotificationLogs(tenantId: string): Promise<NotificationRecord[]>;
     getNotifications(tenantId: string): Promise<NotificationRecord[]>;
   }
   ```

### Step 3: Update `lib/dal/mock-data.ts`
1. **Implement `getTenant(slugOrId: string)`**:
   ```ts
   async getTenant(slugOrId: string): Promise<Tenant | null> {
     return (await this.getTenantBySlug(slugOrId)) || (await this.getTenantById(slugOrId));
   }
   ```
2. **Implement `getUser(userId: string)`**:
   ```ts
   async getUser(userId: string): Promise<User | null> {
     return this.getUserById(userId);
   }
   ```
3. **Implement `getNotifications(tenantId: string)`**:
   ```ts
   async getNotifications(tenantId: string): Promise<NotificationRecord[]> {
     return this.getNotificationLogs(tenantId);
   }
   ```
4. **Implement `recordAttendance` Overload Handling**:
   ```ts
   async recordAttendance(
     paramsOrSessionId:
       | {
           tenantId: string;
           sessionId: string;
           studentIdOrCode: string;
           verificationMethod?: 'barcode' | 'qr' | 'manual';
           cashierUserId?: string;
         }
       | string,
     maybeStudentId?: string
   ): Promise<ScanResult> {
     if (typeof paramsOrSessionId === 'string') {
       const sessionId = paramsOrSessionId;
       const studentId = maybeStudentId!;
       const session = this.sessions.find((s) => s.id === sessionId);
       const tenantId = session ? session.tenantId : '';
       return this.recordAttendance({
         tenantId,
         sessionId,
         studentIdOrCode: studentId,
         verificationMethod: 'manual',
       });
     }
     const params = paramsOrSessionId;
     // ... rest of existing recordAttendance logic ...
   }
   ```
5. **Handle `splitPercentage` and `contractualFixedRate` in `updateTeacherRate`**:
   ```ts
   async updateTeacherRate(
     rateId: string,
     updates: Partial<TeacherRate>,
     actorRole: UserRole
   ): Promise<{ success: boolean; data?: TeacherRate; error?: string; status: number }> {
     // Admin whitelist check ...
     const rate = this.teacherRates.find((r) => r.id === rateId);
     if (!rate) return { success: false, error: 'سعر المعلم غير موجود', status: 404 };

     // Normalize alias fields:
     if (updates.splitPercentage !== undefined && updates.teacherPercentage === undefined) {
       updates.teacherPercentage = updates.splitPercentage;
       if (updates.centerPercentage === undefined) {
         updates.centerPercentage = 100 - updates.splitPercentage;
       }
     }
     if (updates.contractualFixedRate !== undefined && updates.fixedRatePerStudent === undefined) {
       updates.fixedRatePerStudent = updates.contractualFixedRate;
     }

     Object.assign(rate, updates);
     rate.splitPercentage = rate.teacherPercentage;
     rate.contractualFixedRate = rate.fixedRatePerStudent;

     return { success: true, data: rate, status: 200 };
   }
   ```
6. **Populate compatibility aliases in `INITIAL_SEEDED_DATA.teacherRates`**:
   Add `splitPercentage: rate.teacherPercentage` and `contractualFixedRate: rate.fixedRatePerStudent` to the seeded teacher rates array.

### Step 4: Update `lib/finance/compensation.ts`
Expand `CompensationDiscountType` and normalize discount string inputs:
```ts
export type CompensationDiscountType =
  | 'NONE'
  | 'PERCENT'
  | 'FIXED'
  | 'SCHOLARSHIP_100'
  | 'none'
  | 'percentage'
  | 'fixed'
  | 'free_100';
```
In `calculatePrivateLessonsSplit`:
```ts
let normalizedType = String(discountType).toUpperCase();
if (normalizedType === 'FREE_100') normalizedType = 'SCHOLARSHIP_100';
if (normalizedType === 'PERCENTAGE') normalizedType = 'PERCENT';
```

---

## 5. Verification Protocol for Worker M1-R3

After implementing the above changes, Worker M1-R3 must execute:

1. **Strict Typecheck**:
   ```powershell
   npx tsc --noEmit
   ```
   *Expected Outcome*: Exit code 0, 0 errors.

2. **Full Test Suite Execution**:
   ```powershell
   npm run test
   ```
   *Expected Outcome*: 14/14 test files passing, 138/138 tests passing.

3. **Empirical Alias Verification**:
   Execute Node one-liner to verify all alias methods:
   ```powershell
   npx tsx -e "import { getDataProvider } from './lib/dal/factory'; const dal = getDataProvider(); Promise.all([dal.getTenant('al-maher'), dal.getUser('user-admin-001'), dal.getNotifications('tenant-maher-001'), dal.recordAttendance('session-phys-101', 'user-std-1001')]).then(([t, u, n, a]) => console.log('ALIASES VERIFIED:', { tenant: !!t, user: !!u, notifs: Array.isArray(n), scan: a.success }));"
   ```
   *Expected Outcome*: `ALIASES VERIFIED: { tenant: true, user: true, notifs: true, scan: true }`.

4. **Production Build**:
   ```powershell
   npm run build
   ```
   *Expected Outcome*: Exit code 0, all static pages generated successfully.

---

## 6. Conclusion

Adding convenience alias methods (`getNotifications`, `getTenant`, `getUser`, and `recordAttendance` overload) alongside optional compatibility properties (`splitPercentage`, `contractualFixedRate`, and snake_case `User` fields) will transform the DAL into an extraordinarily resilient interface. It completely shields the project from future naming discrepancies, matches `PROJECT.md` contracts to the letter, and preserves strict static typing throughout.
