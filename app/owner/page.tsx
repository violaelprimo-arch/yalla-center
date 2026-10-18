import React from 'react';
import Link from 'next/link';
import {
  Building2,
  Users,
  Wallet,
  Activity,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  Server,
  BellRing,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RTLIcon } from '@/components/ui/rtl-icon';

export default function OwnerDashboardPage() {
  const centers = [
    {
      id: 'tenant-maher-001',
      slug: 'al-maher',
      nameAr: 'سنتر الماهر النموذجي',
      plan: 'باقة المحترفين (Pro)',
      planFee: '3,500 ج.م',
      branchesCount: 2,
      studentsCount: 850,
      status: 'نشط',
    },
    {
      id: 'tenant-rowad-002',
      slug: 'al-rowad',
      nameAr: 'سنتر الرواد التعليمي',
      plan: 'باقة المؤسسات (Enterprise)',
      planFee: '7,500 ج.م',
      branchesCount: 3,
      studentsCount: 600,
      status: 'نشط',
    },
  ];

  const subscriptionTiers = [
    {
      name: 'باقة البداية (Starter)',
      price: '1,500 ج.م / شهرياً',
      studentsLimit: 'حتى 200 طالب',
      branchesLimit: 'فرع واحد',
      features: ['إدارة الطلاب والمجموعات', 'الحضور السريع بالباركود', 'تقارير مالية أساسية'],
    },
    {
      name: 'باقة المحترفين (Pro)',
      price: '3,500 ج.م / شهرياً',
      studentsLimit: 'حتى 1,000 طالب',
      branchesLimit: 'حتى 3 فروع',
      features: ['تكامل واتساب السحابي', 'امتحانات الذكاء الاصطناعي', 'حسابات المعلمين المزدوجة'],
      highlighted: true,
    },
    {
      name: 'باقة المؤسسات (Enterprise)',
      price: '7,500 ج.م / شهرياً',
      studentsLimit: 'طلاب غير محدود',
      branchesLimit: 'فروع غير محدودة',
      features: ['دعم فني خاص على مدار الساعة', 'تخصيص الهوية والشعار', 'استضافة سحابية معزولة'],
    },
  ];

  return (
    <div className="space-y-8" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-purple-500" />
            <span>لوحة القيادة المركزية لمالك المنصة</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            متابعة شاملة للمراكز التعليمية، الاشتراكات السحابية، والبنية التحتية لمنصة يلا سنتر.
          </p>
        </div>
      </div>

      {/* 4 Platform KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:border-purple-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              المراكز المسجلة
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">2</div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              100% نسبة المراكز النشطة
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-brand-cyan-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              إجمالي الطلاب المقيدين
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-brand-cyan-500/10 text-brand-cyan-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">1,450+</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              عبر جميع المراكز والفروع
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-emerald-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              الدخل الشهري للمنصة (MRR)
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">11,000 ج.م</div>
            <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1">
              من باقات الاشتراكات السحابية
            </p>
          </CardContent>
        </Card>

        <Card className="hover:border-blue-500/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">
              عمليات الحضور الناجحة
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-foreground">24,800+</div>
            <p className="text-[11px] text-muted-foreground mt-1">
              مسح باركود مع منع التكرار
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health & Security Monitor */}
      <div className="card-elevated p-6 rounded-2xl border border-border space-y-4">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Server className="w-5 h-5 text-brand-cyan-600" />
          <span>مراقبة البنية التحتية والأمان المشدد</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">PostgreSQL 3NF</span>
              <span className="text-[10px] text-muted-foreground">22 جدولاً نشطاً مع RLS</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">عزل المستأجرين (Tenants)</span>
              <span className="text-[10px] text-muted-foreground">عزل تام مع Middleware 403</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">واتساب كلاود API</span>
              <span className="text-[10px] text-muted-foreground">طابور غير حاجب للعمليات</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-background border border-border flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div>
              <span className="text-xs font-bold text-foreground block">وضع التجربة المستقل</span>
              <span className="text-[10px] text-muted-foreground">MockDataProvider جاهز</span>
            </div>
          </div>
        </div>
      </div>

      {/* Center Management Table */}
      <div className="card-elevated p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-cyan-600" />
            <span>المراكز التعليمية المشتركة</span>
          </h2>
          <Badge variant="cyan">2 مراكز نشطة</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="p-3 font-bold">اسم السنتر</th>
                <th className="p-3 font-bold">المعرف (Slug)</th>
                <th className="p-3 font-bold">باقة الاشتراك</th>
                <th className="p-3 font-bold">الرسوم الشهرية</th>
                <th className="p-3 font-bold">الفروع</th>
                <th className="p-3 font-bold">الطلاب</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {centers.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-bold text-foreground">{c.nameAr}</td>
                  <td className="p-3 font-mono text-brand-cyan-600 dark:text-brand-cyan-400">
                    {c.slug}
                  </td>
                  <td className="p-3 text-muted-foreground">{c.plan}</td>
                  <td className="p-3 font-bold font-mono text-foreground">{c.planFee}</td>
                  <td className="p-3 font-mono text-muted-foreground">{c.branchesCount} فروع</td>
                  <td className="p-3 font-mono text-foreground">{c.studentsCount}</td>
                  <td className="p-3">
                    <Badge variant="success">نشط</Badge>
                  </td>
                  <td className="p-3 text-center">
                    <Link href={`/center/${c.slug}`}>
                      <Button size="sm" variant="outline" className="text-xs gap-1.5">
                        <span>دخول بيئة السنتر</span>
                        <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SaaS Subscription Tiers */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-brand-cyan-600" />
            <span>باقات الاشتراكات السحابية لمنصة يلا سنتر</span>
          </h2>
          <Badge variant="navy">خطط التسعير</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {subscriptionTiers.map((tier, idx) => (
            <div
              key={idx}
              className={`card-elevated p-6 rounded-2xl border flex flex-col justify-between space-y-4 transition-all ${
                tier.highlighted
                  ? 'border-brand-cyan-500 shadow-soft-md relative'
                  : 'border-border'
              }`}
            >
              {tier.highlighted && (
                <span className="absolute -top-3 right-6 text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-cyan-500 text-brand-navy-950">
                  الأكثر طلباً
                </span>
              )}

              <div className="space-y-2">
                <h3 className="text-base font-bold text-foreground">{tier.name}</h3>
                <div className="text-2xl font-black font-mono text-brand-cyan-600 dark:text-brand-cyan-400">
                  {tier.price}
                </div>
                <div className="text-xs text-muted-foreground">
                  {tier.studentsLimit} | {tier.branchesLimit}
                </div>
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                {tier.features.map((f, fIdx) => (
                  <div key={fIdx} className="text-xs text-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
