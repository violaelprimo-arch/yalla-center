'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Search,
  CheckCircle2,
  AlertTriangle,
  X,
  MapPin,
  Phone,
  ArrowLeft,
  Calendar,
  Layers,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Branch } from '@/lib/dal/types';

export default function BranchesManagementPage() {
  const { tenant, masterData } = useTenant();

  const { data: { branches }, loading, canEdit, save } = masterData;
  const [searchQuery, setSearchQuery] = useState('');

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    nameAr: '',
    address: '',
    phone: '',
    isActive: true,
  });
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Filtered branches
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase().trim();
    return branches.filter((b) => {
      return (
        b.nameAr.toLowerCase().includes(q) ||
        (b.address || '').toLowerCase().includes(q) ||
        (b.phone || '').includes(q)
      );
    });
  }, [branches, searchQuery]);

  // Open Modal
  const handleOpenModal = (branch?: Branch) => {
    setFormError('');
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        nameAr: branch.nameAr,
        address: branch.address || '',
        phone: branch.phone || '',
        isActive: branch.isActive !== false,
      });
    } else {
      setEditingBranch(null);
      setFormData({
        nameAr: '',
        address: '',
        phone: '',
        isActive: true,
      });
    }
    setIsModalOpen(true);
  };

  // Save Branch Form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const trimmedName = formData.nameAr.trim();
    if (!trimmedName) {
      setFormError('اسم الفرع مطلوب');
      return;
    }

    try {
      setIsSaving(true);
      await save({
        action: 'saveBranch',
        branch: {
          id: editingBranch?.id,
          nameAr: trimmedName,
          address: formData.address.trim(),
          phone: formData.phone.trim(),
          isActive: formData.isActive,
        },
      });
      showToast('success', editingBranch ? 'تم تعديل بيانات الفرع بنجاح' : 'تم إضافة الفرع بنجاح');
      setIsModalOpen(false);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'تعذّر حفظ بيانات الفرع');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Branch
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteError('');

    try {
      setIsDeleting(true);
      await save({ action: 'deleteBranch', branchId: deleteTarget.id });
      showToast('success', 'تم حذف الفرع بنجاح');
      setDeleteTarget(null);
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'تعذّر حذف الفرع');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      <MasterDataStatus />
      {/* Toast Alert */}
      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-soft-xl border text-sm font-semibold transition-all duration-300 animate-in fade-in slide-in-from-bottom-4 ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="mr-2 p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 flex items-center justify-center text-brand-cyan-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">قائمة الفروع</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              إدارة الفروع ومواقع التدريس التابعة لسنتر {tenant.nameAr}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <Link href={`/center/${tenant.slug}/branches`}>
            <Button variant="outline" className="gap-2 border-border text-foreground hover:bg-muted">
              <Layers className="w-4 h-4 text-brand-cyan-500" />
              <span>الفروع والقاعات (الجدول الزمني)</span>
            </Button>
          </Link>
          <Button
            disabled={!canEdit}
            onClick={() => handleOpenModal()}
            className="gap-2 bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold shadow-soft-sm"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة فرع جديد</span>
          </Button>
        </div>
      </div>

      {/* Quick Search */}
      <Card className="bg-card/70 border-border">
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم الفرع أو العنوان أو الهاتف..."
              className="w-full pr-9 pl-3 py-2 text-xs sm:text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="text-xs text-muted-foreground hidden sm:block">
            إجمالي الفروع: <strong className="text-foreground">{branches.length}</strong>
          </div>
        </CardContent>
      </Card>

      {/* Branches Cards Grid */}
      {loading ? (
        <div className="py-24 text-center">
          <div className="inline-block w-8 h-8 border-3 border-brand-cyan-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground mt-3">جارٍ تحميل قائمة الفروع...</p>
        </div>
      ) : filteredBranches.length === 0 ? (
        <Card className="border-border text-center py-16">
          <CardContent className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">لا توجد فروع مطابقة</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              لم يتم العثور على أي فرع يطابق معايير البحث. يمكنك إضافة فروع جديدة لربط القاعات والمجموعات.
            </p>
            <Button
              disabled={!canEdit}
              onClick={() => handleOpenModal()}
              className="mt-4 gap-2 bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فرع جديد</span>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <Card
              key={branch.id}
              className="border-border bg-card/60 hover:bg-card/90 transition-all shadow-soft-sm flex flex-col justify-between"
            >
              <CardHeader className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 flex items-center justify-center text-brand-cyan-400 shrink-0">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-bold text-foreground">
                        {branch.nameAr}
                      </CardTitle>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        معرف: {branch.id}
                      </span>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      branch.isActive !== false
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {branch.isActive !== false ? 'نشط' : 'غير نشط'}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="p-4 pt-2 space-y-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{branch.address || 'العنوان: غير محدد'}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="dir-ltr text-right">{branch.phone || 'الهاتف: غير محدد'}</span>
                </div>

                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Link
                    href={`/center/${tenant.slug}/branches`}
                    className="text-xs font-semibold text-brand-cyan-500 hover:underline flex items-center gap-1"
                  >
                    <span>عرض القاعات</span>
                    <ArrowLeft className="w-3 h-3" />
                  </Link>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit}
                      onClick={() => handleOpenModal(branch)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                      title="تعديل الفرع"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={!canEdit}
                      onClick={() => setDeleteTarget(branch)}
                      className="h-8 w-8 p-0 text-rose-500 hover:bg-rose-500/10"
                      title="حذف الفرع"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL: Add / Edit Branch */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-soft-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground">
                {editingBranch ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-4">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{formError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  اسم الفرع <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nameAr}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  placeholder="مثال: فرع مدينة نصر"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  عنوان الفرع (اختياري)
                </label>
                <input
                  type="text"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="مثال: 15 شارع مكرم عبيد، الدور الثالث"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  هاتف الفرع (اختياري)
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="مثال: 01012345678"
                  className="w-full px-3 py-2 text-sm rounded-xl bg-background border border-border text-foreground focus:outline-none focus:border-brand-cyan-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="branchActive"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 rounded text-brand-cyan-600 focus:ring-brand-cyan-500"
                />
                <label htmlFor="branchActive" className="text-xs font-semibold text-foreground cursor-pointer">
                  الفرع نشط ومتاح للتسجيل وحجز القاعات
                </label>
              </div>

              {editingBranch && (
                <div className="p-2.5 rounded-lg bg-muted text-muted-foreground text-[11px] leading-relaxed">
                  ملاحظة: تعديل اسم الفرع أو بياناته يحافظ تمامًا على معرّفه الأصلي (<span className="font-mono">{editingBranch.id}</span>) وارتباط القاعات والمجموعات والحصص به.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold"
                >
                  {isSaving ? 'جارٍ الحفظ...' : 'حفظ الفرع'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm shadow-soft-2xl overflow-hidden p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-500">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-foreground">
                تأكيد حذف الفرع
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              هل أنت متأكد من رغبتك في حذف فرع{' '}
              <strong className="text-foreground">{deleteTarget.nameAr}</strong>؟
              سيتم منع الحذف تلقائيًا إذا كانت هناك قاعات أو مجموعات دراسية أو حصص مرتبطة بهذا الفرع.
            </p>

            {deleteError && (
              <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs">
                {deleteError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteTarget(null);
                  setDeleteError('');
                }}
                disabled={isDeleting}
              >
                إلغاء
              </Button>
              <Button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="bg-rose-600 hover:bg-rose-500 text-white font-bold"
              >
                {isDeleting ? 'جارٍ الحذف...' : 'تأكيد الحذف'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
