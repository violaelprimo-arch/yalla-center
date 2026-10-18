'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Lock,
  Camera,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ProfilePage() {
  const params = useParams();
  const centerSlug = (params.centerSlug as string) || 'al-maher';
  const { currentUser, setCurrentUser, currentRole } = useTenant();

  const [avatarUrlInput, setAvatarUrlInput] = useState(currentUser?.avatarUrl || '');
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (currentUser?.avatarUrl) {
      setAvatarUrlInput(currentUser.avatarUrl);
    }
  }, [currentUser]);

  if (!currentUser) {
    return (
      <div className="p-8 text-center text-muted-foreground" dir="rtl">
        جاري تحميل الملف الشخصي...
      </div>
    );
  }

  const isRestrictedRole = currentRole === 'STUDENT' || currentRole === 'TEACHER';

  const handlePhotoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUpdatingPhoto(true);
    setMessage(null);

    try {
      const res = await fetch('/api/profile/update-photo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': currentUser.id,
          'x-user-role': currentRole,
          'x-tenant-slug': centerSlug,
        },
        body: JSON.stringify({
          userId: currentUser.id,
          avatar_url: avatarUrlInput,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'فشل تحديث الصورة الشخصية');
      }

      const updatedUser = { ...currentUser, avatarUrl: avatarUrlInput };
      setCurrentUser(updatedUser);
      setMessage({
        text: 'تم تحديث الصورة الشخصية بنجاح بنظام الأمان السحابي (HTTP 200 OK)',
        type: 'success',
      });
    } catch (err: any) {
      setMessage({
        text: err.message || 'حدث خطأ أثناء حفظ الصورة الشخصية',
        type: 'error',
      });
    } finally {
      setIsUpdatingPhoto(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-foreground" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground flex items-center gap-2">
            <UserCheck className="w-7 h-7 text-brand-cyan-600 dark:text-brand-cyan-400" />
            <span>الملف الشخصي والضوابط الأمنية</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            إدارة بيانات الحساب والصورة الشخصية وفق قواعد الأمان الصارمة لمنصة يلا سنتر.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isRestrictedRole ? 'warning' : 'cyan'} className="text-xs py-1">
            الدور الحالي: {currentRole === 'STUDENT' ? 'طالب' : currentRole === 'TEACHER' ? 'معلم' : currentRole}
          </Badge>
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold border flex items-center justify-between transition-all ${
            message.type === 'success'
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
              : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30'
          }`}
        >
          <div className="flex items-center gap-2">
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            )}
            <span>{message.text}</span>
          </div>
          <button
            onClick={() => setMessage(null)}
            className="text-xs font-bold hover:underline px-2 py-1"
          >
            إغلاق
          </button>
        </div>
      )}

      {/* Security Banner for Student & Teacher */}
      {isRestrictedRole && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs sm:text-sm flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-bold block">
              ضوابط الأمان المشددة (Security Guardrails):
            </strong>
            <p className="leading-relaxed">
              يحق للطلاب والمعلمين تحديث الصورة الشخصية فقط (<code className="font-mono text-brand-cyan-600 font-bold">avatar_url</code>). كافة البيانات الإدارية والأكاديمية والمالية مشفرة ومغلقة أمنياً، ولا يمكن تعديلها إلا عبر إدارة السنتر حصراً لمنع التلاعب (HTTP 403 Forbidden).
            </p>
          </div>
        </div>
      )}

      {/* Section 1: Profile Photo (Active and Editable for Students & Teachers) */}
      <div className="card-elevated p-6 rounded-2xl border border-border space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-brand-cyan-600 dark:text-brand-cyan-400" />
            <h2 className="text-lg font-bold text-foreground">الصورة الشخصية</h2>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30">
            متاح للتعديل الفوري
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-28 h-28 rounded-full overflow-hidden border-3 border-brand-cyan-500 shadow-soft-md bg-muted shrink-0">
            {avatarUrlInput ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={avatarUrlInput}
                alt="Avatar Preview"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as any).src =
                    'https://images.unsplash.com/photo-1534528741775-53994a69daeb';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                {currentUser.fullName.charAt(0)}
              </div>
            )}
          </div>

          <form onSubmit={handlePhotoUpdate} className="flex-1 w-full space-y-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
                رابط الصورة الشخصية المباشر (Direct Image URL)
              </label>
              <input
                type="url"
                value={avatarUrlInput}
                onChange={(e) => setAvatarUrlInput(e.target.value)}
                placeholder="https://images.unsplash.com/photo-..."
                className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none transition-all"
                required
              />
            </div>
            <div className="flex items-center gap-3">
              <Button
                type="submit"
                variant="primary"
                disabled={isUpdatingPhoto || !avatarUrlInput.trim()}
                className="h-10 text-xs sm:text-sm px-6"
              >
                {isUpdatingPhoto ? 'جاري الحفظ بالأمان السحابي...' : 'حفظ الصورة الجديدة'}
              </Button>
              <span className="text-[11px] text-muted-foreground">
                يدعم روابط صور HTTPS المباشرة
              </span>
            </div>
          </form>
        </div>
      </div>

      {/* Section 2: Administrative and Academic Data (Disabled & ReadOnly for Students/Teachers) */}
      <div className="card-elevated p-6 rounded-2xl border border-border space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">البيانات الإدارية والأكاديمية</h2>
          {isRestrictedRole && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground font-semibold border border-border flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              <span>🔒 للقراءة فقط (مغلق أمنياً)</span>
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              الاسم الكامل
            </label>
            <input
              type="text"
              value={currentUser.fullName}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-muted/60 text-foreground cursor-not-allowed opacity-80 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              كود الطالب / المستخدم
            </label>
            <input
              type="text"
              value={currentUser.studentCode || currentUser.id}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono rounded-xl border border-border bg-muted/60 text-foreground cursor-not-allowed opacity-80 font-semibold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              المرحلة الدراسية
            </label>
            <input
              type="text"
              value={currentUser.stage || 'الثانوية العامة'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-muted/60 text-foreground cursor-not-allowed opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              الصف الدراسي
            </label>
            <input
              type="text"
              value={currentUser.grade || 'الصف الثالث الثانوي'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-border bg-muted/60 text-foreground cursor-not-allowed opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              رقم الهاتف
            </label>
            <input
              type="text"
              value={currentUser.phone || '01012341001'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono rounded-xl border border-border bg-muted/60 text-foreground cursor-not-allowed opacity-80"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">
              هاتف ولي الأمر (لإشعارات واتساب)
            </label>
            <input
              type="text"
              value={currentUser.guardianPhone || '01099991001'}
              disabled={isRestrictedRole}
              readOnly={isRestrictedRole}
              className="w-full px-3 py-2 text-xs sm:text-sm font-mono rounded-xl border border-border bg-muted/60 text-foreground cursor-not-allowed opacity-80"
            />
          </div>
        </div>
      </div>

      {/* Section 3: Financial Balance (Strictly Read-Only) */}
      <div className="card-elevated p-6 rounded-2xl border border-border space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">الرصيد المالي والحسابات</h2>
          <span className="text-xs px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold border border-rose-500/30 flex items-center gap-1">
            <Lock className="w-3.5 h-3.5" />
            <span>🔒 مغلق أمنياً</span>
          </span>
        </div>

        <div className="p-4 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-muted-foreground block">
              {currentRole === 'STUDENT' ? 'المبلغ المستحق على الطالب' : 'الرصيد المالي للحساب'}
            </span>
            <span className="text-2xl font-black font-mono text-foreground">
              {currentUser.balanceDue.toFixed(2)} ج.م
            </span>
          </div>
          <Badge variant={currentUser.balanceDue === 0 ? 'success' : 'destructive'} className="self-start sm:self-center">
            {currentUser.balanceDue === 0 ? 'خالص السداد (تم الدفع)' : 'يوجد مستحقات متأخرة'}
          </Badge>
        </div>
      </div>
    </div>
  );
}
