'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Search,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Edit,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { Tenant } from '@/lib/dal/types';

interface CenterFormData {
  nameAr: string;
  nameEn: string;
  slug: string;
  plan: 'starter' | 'pro' | 'enterprise';
  adminEmail: string;
  adminPhone: string;
  address: string;
  branchName: string;
}

const INITIAL_CENTERS: Array<Tenant & { adminEmail?: string; studentsCount?: number; branchesCount?: number }> = [
  {
    id: 'tenant-maher-001',
    nameAr: 'سنتر الماهر النموذجي',
    nameEn: 'Al-Maher Educational Center',
    slug: 'al-maher',
    subscriptionPlan: 'pro',
    isActive: true,
    settings: {
      currency: 'EGP',
      enableWhatsApp: true,
      enableFCM: true,
    },
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    adminEmail: 'admin@almaher.edu.eg',
    studentsCount: 850,
    branchesCount: 2,
  },
  {
    id: 'tenant-rowad-002',
    nameAr: 'سنتر الرواد التعليمي',
    nameEn: 'Al-Rowad Center',
    slug: 'al-rowad',
    subscriptionPlan: 'enterprise',
    isActive: true,
    settings: {
      currency: 'EGP',
      enableWhatsApp: true,
      enableFCM: true,
    },
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-11-15T00:00:00.000Z',
    adminEmail: 'admin@alrowad.edu.eg',
    studentsCount: 600,
    branchesCount: 3,
  },
];

export default function OwnerCentersPage() {
  const [centers, setCenters] = useState(INITIAL_CENTERS);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState<string>('all');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const [formData, setFormData] = useState<CenterFormData>({
    nameAr: '',
    nameEn: '',
    slug: '',
    plan: 'pro',
    adminEmail: '',
    adminPhone: '',
    address: 'القاهرة، مصر',
    branchName: 'الفرع الرئيسي',
  });

  // Load centers from localStorage if previously created in browser session
  useEffect(() => {
    try {
      const stored = localStorage.getItem('yc_owner_centers');
      if (stored) {
        setCenters(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const saveCenters = (updated: typeof centers) => {
    setCenters(updated);
    try {
      localStorage.setItem('yc_owner_centers', JSON.stringify(updated));
    } catch {}
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr || !formData.slug) return;

    const cleanSlug = formData.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const newCenter: Tenant & { adminEmail?: string; studentsCount?: number; branchesCount?: number } = {
      id: `tenant-${cleanSlug}-${Date.now()}`,
      nameAr: formData.nameAr,
      nameEn: formData.nameEn || formData.nameAr,
      slug: cleanSlug,
      subscriptionPlan: formData.plan,
      isActive: true,
      settings: {
        currency: 'EGP',
        enableWhatsApp: true,
        enableFCM: true,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adminEmail: formData.adminEmail || `admin@${cleanSlug}.edu.eg`,
      studentsCount: 0,
      branchesCount: 1,
    };

    const updated = [newCenter, ...centers];
    saveCenters(updated);
    setIsCreateOpen(false);
    setStatusMessage(`تم إنشاء المركز التعليمي «${newCenter.nameAr}» وتعيين المدير بنجاح`);
    setFormData({
      nameAr: '',
      nameEn: '',
      slug: '',
      plan: 'pro',
      adminEmail: '',
      adminPhone: '',
      address: 'القاهرة، مصر',
      branchName: 'الفرع الرئيسي',
    });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  const toggleStatus = (id: string) => {
    const updated = centers.map((c) => {
      if (c.id === id) {
        return { ...c, isActive: !c.isActive, updatedAt: new Date().toISOString() };
      }
      return c;
    });
    saveCenters(updated);
  };

  const filteredCenters = centers.filter((c) => {
    const matchSearch =
      c.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.adminEmail && c.adminEmail.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchPlan = planFilter === 'all' || c.subscriptionPlan === planFilter;
    return matchSearch && matchPlan;
  });

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-brand-cyan-500" />
            <span>إدارة المراكز والسناتر التعليمية</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            إضافة سناتر جديدة، تخصيص باقات السحابة، تعيين مديري المراكز، وتفعيل أو إيقاف التشغيل.
          </p>
        </div>

        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-soft-sm py-2.5 px-4 rounded-xl"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة سنتر جديد</span>
        </Button>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="بحث باسم السنتر، المعرّف (Slug)، أو البريد الإلكتروني للمدير…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
          />
        </div>

        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value)}
          className="w-full sm:w-48 py-2.5 px-3 rounded-xl border border-border bg-card text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 cursor-pointer"
        >
          <option value="all">جميع باقات الاشتراك</option>
          <option value="starter">باقة البداية (Starter)</option>
          <option value="pro">باقة المحترفين (Pro)</option>
          <option value="enterprise">باقة المؤسسات (Enterprise)</option>
        </select>
      </div>

      {/* Centers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCenters.map((center) => (
          <Card
            key={center.id}
            className={`transition-all border ${
              center.isActive
                ? 'border-border hover:border-brand-cyan-500/50'
                : 'border-red-500/30 bg-red-500/5 opacity-80'
            }`}
          >
            <CardHeader className="flex flex-row items-start justify-between pb-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-bold text-foreground">
                    {center.nameAr}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={
                      center.isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]'
                        : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[10px]'
                    }
                  >
                    {center.isActive ? 'نشط ويعمل' : 'موقوف مؤقتًا'}
                  </Badge>
                </div>
                <p className="text-xs font-mono text-muted-foreground">{center.slug}</p>
              </div>

              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                  center.subscriptionPlan === 'enterprise'
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30'
                    : center.subscriptionPlan === 'pro'
                    ? 'bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border-brand-cyan-500/30'
                    : 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/30'
                }`}
              >
                {center.subscriptionPlan === 'enterprise'
                  ? 'باقة المؤسسات'
                  : center.subscriptionPlan === 'pro'
                  ? 'باقة المحترفين'
                  : 'باقة البداية'}
              </span>
            </CardHeader>

            <CardContent className="space-y-4 pt-1 text-xs">
              <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/50 text-[11px]">
                <div>
                  <span className="text-muted-foreground">عدد الفروع: </span>
                  <strong className="text-foreground">{center.branchesCount ?? 1}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">الطلاب المقيدين: </span>
                  <strong className="text-foreground">{center.studentsCount ?? 0} طالب</strong>
                </div>
                <div className="col-span-2 flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 text-brand-cyan-600" />
                  <span className="truncate">{center.adminEmail || 'لم يُعيّن بريد مدير'}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleStatus(center.id)}
                  className={`text-xs h-8 ${
                    center.isActive
                      ? 'text-red-600 hover:bg-red-500/10 border-red-500/30'
                      : 'text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/30'
                  }`}
                >
                  {center.isActive ? (
                    <>
                      <XCircle className="w-3.5 h-3.5 ml-1" />
                      إيقاف السنتر
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                      تفعيل السنتر
                    </>
                  )}
                </Button>

                <Link
                  href={`/center/${center.slug}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs transition-colors shadow-soft-sm"
                >
                  <span>إدارة السنتر (مالك)</span>
                  <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5" />
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}

        {filteredCenters.length === 0 && (
          <div className="col-span-2 text-center py-12 border border-dashed border-border rounded-2xl bg-muted/20">
            <Building2 className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
            <p className="text-sm font-semibold text-foreground">لا توجد مراكز مطابقة لبحثك</p>
            <p className="text-xs text-muted-foreground mt-1">جرّب تغيير كلمات البحث أو الفلاتر</p>
          </div>
        )}
      </div>

      {/* Create Center Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl shadow-soft-xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-cyan-500" />
                <span>إنشاء مركز تعليمي جديد على المنصة</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">اسم المركز التعليمي (بالعربية) *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: سنتر الأوائل التعليمي"
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">معرّف الرابط (Slug) *</label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    placeholder="al-awaael"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-left font-mono focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">باقة الاشتراك</label>
                  <select
                    value={formData.plan}
                    onChange={(e) => setFormData({ ...formData, plan: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                  >
                    <option value="starter">باقة البداية (Starter)</option>
                    <option value="pro">باقة المحترفين (Pro)</option>
                    <option value="enterprise">باقة المؤسسات (Enterprise)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">بريد حساب مدير السنتر *</label>
                <input
                  type="email"
                  dir="ltr"
                  required
                  placeholder="admin@al-awaael.edu.eg"
                  value={formData.adminEmail}
                  onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-left focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">هاتف التواصل</label>
                  <input
                    type="tel"
                    dir="ltr"
                    placeholder="01012345678"
                    value={formData.adminPhone}
                    onChange={(e) => setFormData({ ...formData, adminPhone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-left focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">اسم الفرع الأول</label>
                  <input
                    type="text"
                    placeholder="الفرع الرئيسي"
                    value={formData.branchName}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-xs"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs"
                >
                  حفظ وتفعيل السنتر
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
