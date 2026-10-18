import React from 'react';
import Link from 'next/link';
import { Building2, Home, ArrowRight } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';

export function TenantNotFoundView({ slug }: { slug: string }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-background text-foreground"
      dir="rtl"
    >
      <div className="max-w-md w-full text-center space-y-6 card-elevated p-8 rounded-3xl border border-border shadow-soft-xl">
        <div className="flex justify-center">
          <BrandLogo width={160} height={42} />
        </div>

        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto text-2xl">
          🔍
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">
            السنتر التعليمي غير موجود
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تعذر العثور على أي مركز تعليمي مسجل بالرابط:{' '}
            <code className="px-2 py-0.5 rounded bg-muted font-mono text-foreground font-bold">
              {slug}
            </code>
            . يرجى التأكد من صحة الرابط أو اختيار سنتر من المراكز التجريبية المعتمدة.
          </p>
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            المراكز التعليمية التجريبية المتاحة:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Link href="/center/al-maher" className="w-full">
              <Button variant="outline" className="w-full text-xs font-bold gap-2">
                <Building2 className="w-3.5 h-3.5 text-brand-cyan-600" />
                سنتر الماهر
              </Button>
            </Link>
            <Link href="/center/al-rowad" className="w-full">
              <Button variant="outline" className="w-full text-xs font-bold gap-2">
                <Building2 className="w-3.5 h-3.5 text-brand-cyan-600" />
                سنتر الرواد
              </Button>
            </Link>
          </div>
        </div>

        <div className="pt-2">
          <Link href="/">
            <Button variant="ghost" className="text-xs text-muted-foreground hover:text-foreground gap-1.5">
              <Home className="w-3.5 h-3.5" />
              العودة إلى الصفحة الرئيسية
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
