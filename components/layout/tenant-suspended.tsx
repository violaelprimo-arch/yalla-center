import React from 'react';
import Link from 'next/link';
import { AlertTriangle, Home } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { Tenant } from '@/lib/dal/types';

export function TenantSuspendedView({ tenant }: { tenant: Tenant }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground"
      dir="rtl"
    >
      <div className="max-w-md w-full text-center space-y-6 card-elevated p-8 rounded-3xl border border-amber-500/30 shadow-soft-xl">
        <div className="flex justify-center">
          <BrandLogo width={160} height={42} />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto text-3xl">
          <AlertTriangle className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            حساب السنتر معلق مؤقتاً
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تم تعليق الوصول لسنتر{' '}
            <strong className="text-foreground font-bold">{tenant.nameAr}</strong>.
            يرجى مراجعة إدارة المنصة لتجديد باقة الاشتراك السحابية وتفعيل الخدمة.
          </p>
        </div>

        <div className="pt-4 border-t border-border">
          <Link href="/">
            <Button variant="outline" className="text-xs font-bold gap-2">
              <Home className="w-4 h-4" />
              العودة للصفحة الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
