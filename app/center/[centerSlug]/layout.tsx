import React from 'react';
import { Metadata } from 'next';
import { getDataProvider } from '@/lib/dal';
import { TenantProvider } from '@/components/layout/tenant-provider';
import { TenantLayout } from '@/components/layout/tenant-layout';
import { TenantNotFoundView } from '@/components/layout/tenant-not-found';
import { TenantSuspendedView } from '@/components/layout/tenant-suspended';

interface CenterDynamicLayoutProps {
  children: React.ReactNode;
  params: { centerSlug: string } | Promise<{ centerSlug: string }>;
}

export async function generateMetadata({
  params,
}: CenterDynamicLayoutProps): Promise<Metadata> {
  const { centerSlug } = await Promise.resolve(params);
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(centerSlug);

  if (!tenant) {
    return {
      title: 'السنتر غير موجود — يلا سنتر',
    };
  }

  return {
    title: `${tenant.nameAr} — يلا سنتر`,
    description: `لوحة التحكم وبيئة العمل المتكاملة لـ ${tenant.nameAr} على منصة يلا سنتر.`,
  };
}

export default async function CenterDynamicLayout({
  children,
  params,
}: CenterDynamicLayoutProps) {
  const { centerSlug } = await Promise.resolve(params);
  const dal = getDataProvider();
  const tenant = await dal.getTenantBySlug(centerSlug);

  if (!tenant) {
    return <TenantNotFoundView slug={centerSlug} />;
  }

  if (!tenant.isActive) {
    return <TenantSuspendedView tenant={tenant} />;
  }

  const [branches, users] = await Promise.all([
    dal.getBranches(tenant.id),
    dal.getUsers(tenant.id),
  ]);

  return (
    <TenantProvider key={tenant.id} tenant={tenant} branches={branches} initialUsers={users}>
      <TenantLayout>{children}</TenantLayout>
    </TenantProvider>
  );
}
