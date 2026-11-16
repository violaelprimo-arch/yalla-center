import React from 'react';
import { Metadata } from 'next';
import { OwnerShell } from '@/components/owner/owner-shell';

export const metadata: Metadata = {
  title: 'بوابة مالك المنصة — يلا سنتر Super-Admin',
  description: 'لوحة القيادة المركزية لمالك المنصة لإدارة السناتر، الاشتراكات السحابية، ومؤشرات الأداء العامة.',
};

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <OwnerShell>{children}</OwnerShell>;
}
