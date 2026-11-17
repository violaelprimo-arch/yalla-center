import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Users, Profiles & System Usernames Firestore Security Rules Invariants', () => {
  const rules = readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8');

  it('declares assumed data models for users and system_usernames', () => {
    expect(rules).toContain('Collection: users');
    expect(rules).toContain('Subcollection: profile/{profileDocId}');
    expect(rules).toContain('Collection: system_usernames');
    expect(rules).toContain('Document ID: {username}');
  });

  it('declares helper functions: isOwner, isCenterAdminForDoc, isSafeProfileUpdate, isValidUserDoc, isValidUsernameData', () => {
    expect(rules).toContain('function isOwner(userId)');
    expect(rules).toContain('function isCenterAdminForDoc(docData)');
    expect(rules).toContain('function isSafeProfileUpdate()');
    expect(rules).toContain('function isValidUserDoc(data)');
    expect(rules).toContain('function isValidUsernameData(data, username)');
  });

  it('declares match blocks for users/{userId}, users/{userId}/profile, and system_usernames/{username}', () => {
    expect(rules).toContain('match /users/{userId}');
    expect(rules).toContain('match /users/{userId}/profile/{profileDocId}');
    expect(rules).toContain('match /system_usernames/{username}');
  });

  it('enforces immutable tenant isolation and safe self-profile updates on users/{userId}', () => {
    expect(rules).toMatch(/match \/users\/\{userId\}\s*\{/);
    expect(rules).toContain('allow read: if isOwner(userId) || isCenterAdminForDoc(resource.data);');
    expect(rules).toContain('isSafeProfileUpdate()');
    expect(rules).toContain("request.resource.data.role != 'PLATFORM_OWNER'");
  });

  it('enforces safe self-profile updates and tenant isolation on users/{userId}/profile/{profileDocId}', () => {
    expect(rules).toMatch(/match \/users\/\{userId\}\/profile\/\{profileDocId\}\s*\{/);
    expect(rules).toContain('allow read: if isOwner(userId) || isCenterAdminForDoc(resource.data);');
    expect(rules).toContain('isSafeProfileUpdate()');
  });

  it('enforces uniqueness checking read and staff-admin write restrictions on system_usernames/{username}', () => {
    expect(rules).toMatch(/match \/system_usernames\/\{username\}\s*\{/);
    expect(rules).toContain('allow read: if isSignedIn();');
    expect(rules).toContain('isValidUsernameData(request.resource.data, username)');
  });

  describe('Emulated Decision Logic for User Profile & System Usernames', () => {
    type AuthContext = {
      uid: string | null;
      role?: string;
      tenantId?: string;
      isActive?: boolean;
    };

    function evalUserRead(auth: AuthContext, docUserId: string, docData: Record<string, unknown>): boolean {
      if (!auth.uid) return false;
      if (auth.uid === docUserId) return true;
      if (auth.role === 'PLATFORM_OWNER') return true;
      if (auth.isActive && auth.role === 'CENTER_ADMIN' && auth.tenantId === docData.tenantId) {
        return true;
      }
      return false;
    }

    function evalUserSelfUpdate(
      auth: AuthContext,
      docUserId: string,
      currentDoc: Record<string, unknown>,
      updatedDoc: Record<string, unknown>
    ): boolean {
      if (!auth.uid || auth.uid !== docUserId) return false;
      const allowedKeys = new Set(['avatarUrl', 'photoUrl', 'avatar_url', 'updatedAt']);
      const allKeys = new Set([...Object.keys(currentDoc), ...Object.keys(updatedDoc)]);
      const affectedKeys: string[] = [];
      for (const k of allKeys) {
        if (currentDoc[k] !== updatedDoc[k]) {
          affectedKeys.push(k);
        }
      }
      if (!affectedKeys.every((k) => allowedKeys.has(k))) {
        return false;
      }
      for (const key of ['avatarUrl', 'photoUrl', 'avatar_url']) {
        if (key in updatedDoc && updatedDoc[key] !== null) {
          if (typeof updatedDoc[key] !== 'string' || (updatedDoc[key] as string).length > 2048) {
            return false;
          }
        }
      }
      return true;
    }

    function evalUsernameCreate(
      auth: AuthContext,
      pathUsername: string,
      data: Record<string, unknown>
    ): boolean {
      if (!auth.uid) return false;
      const isPlatformOwner = auth.role === 'PLATFORM_OWNER';
      const isCenterAdmin = auth.isActive && auth.role === 'CENTER_ADMIN' && auth.tenantId === data.tenantId;
      if (!isPlatformOwner && !isCenterAdmin) return false;

      if (data.username !== pathUsername) return false;
      if (typeof data.username !== 'string' || data.username.length < 3 || data.username.length > 64) {
        return false;
      }
      if (typeof data.tenantId !== 'string' || data.tenantId.length === 0 || data.tenantId.length > 128) {
        return false;
      }
      return true;
    }

    const studentAlice: AuthContext = { uid: 'std-alice', role: 'STUDENT', tenantId: 'tenant-1' };
    const studentBob: AuthContext = { uid: 'std-bob', role: 'STUDENT', tenantId: 'tenant-1' };
    const centerAdminTenant1: AuthContext = { uid: 'admin-1', role: 'CENTER_ADMIN', tenantId: 'tenant-1', isActive: true };
    const centerAdminTenant2: AuthContext = { uid: 'admin-2', role: 'CENTER_ADMIN', tenantId: 'tenant-2', isActive: true };
    const platformOwner: AuthContext = { uid: 'po-1', role: 'PLATFORM_OWNER' };
    const unauthenticated: AuthContext = { uid: null };

    const aliceDoc = {
      id: 'std-alice',
      tenantId: 'tenant-1',
      role: 'STUDENT',
      fullName: 'Alice Walker',
      avatarUrl: 'https://example.com/alice.png',
      balanceDue: 150,
      studentCode: 'STD-100',
    };

    it('allows signed-in user to read own profile document, center admin of same tenant, and platform owner', () => {
      expect(evalUserRead(studentAlice, 'std-alice', aliceDoc)).toBe(true);
      expect(evalUserRead(centerAdminTenant1, 'std-alice', aliceDoc)).toBe(true);
      expect(evalUserRead(platformOwner, 'std-alice', aliceDoc)).toBe(true);
    });

    it('rejects cross-user, cross-tenant admin, and unauthenticated reads on user profile', () => {
      expect(evalUserRead(studentBob, 'std-alice', aliceDoc)).toBe(false);
      expect(evalUserRead(centerAdminTenant2, 'std-alice', aliceDoc)).toBe(false);
      expect(evalUserRead(unauthenticated, 'std-alice', aliceDoc)).toBe(false);
    });

    it('allows student to update safe avatarUrl/photoUrl fields within size limits', () => {
      const safeUpdate = { ...aliceDoc, avatarUrl: 'https://example.com/alice-new.png' };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, safeUpdate)).toBe(true);

      const nullAvatar = { ...aliceDoc, avatarUrl: null };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, nullAvatar)).toBe(true);
    });

    it('rejects student self-update when altering administrative, role, or financial fields', () => {
      // Escalating role
      const roleHack = { ...aliceDoc, role: 'CENTER_ADMIN' };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, roleHack)).toBe(false);

      // Resetting debt
      const debtHack = { ...aliceDoc, balanceDue: 0 };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, debtHack)).toBe(false);

      // Modifying studentCode
      const codeHack = { ...aliceDoc, studentCode: 'STD-999' };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, codeHack)).toBe(false);

      // Cross-tenant migration
      const tenantHack = { ...aliceDoc, tenantId: 'tenant-2' };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, tenantHack)).toBe(false);
    });

    it('rejects resource exhaustion DoS attack (>2048 chars) on avatarUrl', () => {
      const massivePayload = { ...aliceDoc, avatarUrl: 'https://cdn.com/' + 'a'.repeat(3000) };
      expect(evalUserSelfUpdate(studentAlice, 'std-alice', aliceDoc, massivePayload)).toBe(false);
    });

    it('validates system_usernames writes: allowed for Center Admin and Platform Owner, rejected for students and cross-tenant admins', () => {
      const usernamePayload = {
        username: 'prof-smith',
        tenantId: 'tenant-1',
        teacherId: 'teacher-101',
        uid: 'uid-teacher-101',
      };

      // Center admin of tenant-1 can create
      expect(evalUsernameCreate(centerAdminTenant1, 'prof-smith', usernamePayload)).toBe(true);
      // Platform owner can create
      expect(evalUsernameCreate(platformOwner, 'prof-smith', usernamePayload)).toBe(true);
      // Student cannot create
      expect(evalUsernameCreate(studentAlice, 'prof-smith', usernamePayload)).toBe(false);
      // Center admin of tenant-2 cannot create for tenant-1
      expect(evalUsernameCreate(centerAdminTenant2, 'prof-smith', usernamePayload)).toBe(false);
      // Mismatched username
      expect(evalUsernameCreate(centerAdminTenant1, 'wrong-name', usernamePayload)).toBe(false);
      // Username too short (<3 chars)
      expect(evalUsernameCreate(centerAdminTenant1, 'ab', { ...usernamePayload, username: 'ab' })).toBe(false);
    });
  });
});
