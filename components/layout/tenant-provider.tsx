'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import { Tenant, Branch, User, UserRole } from '@/lib/dal/types';

export interface TenantContextType {
  tenant: Tenant;
  branches: Branch[];
  setBranches: React.Dispatch<React.SetStateAction<Branch[]>>;
  refreshBranches: () => Promise<void>;
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

export interface TenantProviderProps {
  children: React.ReactNode;
  tenant: Tenant;
  branches: Branch[];
  initialUsers: User[];
}

export function TenantProvider({
  children,
  tenant,
  branches,
  initialUsers,
}: TenantProviderProps) {
  const [currentBranches, setCurrentBranches] = useState<Branch[]>(branches);
  const [activeBranchId, setActiveBranchId] = useState<string | null>(
    branches[0]?.id || null
  );

  React.useEffect(() => {
    setCurrentBranches(branches);
  }, [branches]);

  const refreshBranches = async () => {
    try {
      const res = await fetch(`/api/center/${tenant.slug}/master-data`, {
        cache: 'no-store',
      });
      const data = await res.json();
      if (data.success && data.data?.branches) {
        setCurrentBranches(data.data.branches);
      }
    } catch (err) {
      console.warn('Failed to refresh branches in TenantProvider:', err);
    }
  };

  const [availableUsers] = useState<User[]>(initialUsers);

  // Default initial user to Center Admin
  const defaultAdmin = useMemo(
    () =>
      initialUsers.find((u) => u.role === 'CENTER_ADMIN') ||
      initialUsers[0] || {
        id: 'user-admin-default',
        tenantId: tenant.id,
        role: 'CENTER_ADMIN' as UserRole,
        fullName: 'أ. محمود التهامي (مدير السنتر)',
        email: 'admin@almaher.edu.eg',
        balanceDue: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    [initialUsers, tenant.id]
  );

  const [currentUser, setCurrentUser] = useState<User>(defaultAdmin);
  const [isOwnerMode, setIsOwnerMode] = useState<boolean>(false);

  const activeBranch = useMemo(
    () => currentBranches.find((b) => b.id === activeBranchId) || currentBranches[0] || null,
    [currentBranches, activeBranchId]
  );

  const switchRole = (role: UserRole) => {
    // Helper to sync cookies for seamless client-to-server middleware alignment in demo
    const syncCookies = (targetUser: User) => {
      if (typeof document !== 'undefined') {
        document.cookie = `yc_role=${targetUser.role}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `yc_user_id=${targetUser.id}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `yc_tenant=${tenant.slug}; path=/; max-age=86400; SameSite=Lax`;
      }
    };

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
      syncCookies(ownerUser);
      return;
    }

    setIsOwnerMode(false);
    const foundUser = availableUsers.find((u) => u.role === role);
    if (foundUser) {
      setCurrentUser(foundUser);
      syncCookies(foundUser);
    } else {
      // Synthesize demo user if none exists in seed
      const synthUser: User = {
        id: `demo-${role.toLowerCase()}`,
        tenantId: tenant.id,
        role,
        fullName: `مستخدم تجريبي (${role})`,
        avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        balanceDue: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setCurrentUser(synthUser);
      syncCookies(synthUser);
    }
  };

  return (
    <TenantContext.Provider
      value={{
        tenant,
        branches: currentBranches,
        setBranches: setCurrentBranches,
        refreshBranches,
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
