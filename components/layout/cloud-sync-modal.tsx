'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Cloud,
  CloudOff,
  RefreshCw,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Mail,
  UserCheck,
  Database,
  ArrowRight,
  Key,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/components/layout/tenant-provider';
import {
  useFirebaseAuthSession,
  signInFirebaseStaff,
  signInFirebaseGoogle,
  signOutFirebaseStaff,
  getFreshFirebaseIdToken,
  saveFirebaseWebConfig,
} from '@/lib/firebase/client';
import {
  bootstrapCenterStaff,
  importBrowserDataToCloud,
} from '@/lib/firebase/client-sync';
import type { ImportPayload, ImportResult } from '@/lib/firebase/import-service';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CloudSyncModal({ isOpen, onClose }: CloudSyncModalProps) {
  const { tenant } = useTenant();
  const auth = useFirebaseAuthSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Quick config keys state (if not injected via build env)
  const [customApiKey, setCustomApiKey] = useState('');
  const [customAppId, setCustomAppId] = useState('');

  // Sign-in form state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Import state
  const [detectedPayload, setDetectedPayload] = useState<ImportPayload | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  // Scan localStorage for local data
  const scanLocalStorage = useCallback(() => {
    if (typeof window === 'undefined') return;
    setIsScanning(true);
    try {
      const payload: ImportPayload = {};

      // 1. Demo operations (students, sessions, attendance, invoices, payments, expenses)
      const opsRaw = localStorage.getItem('yc-demo-operations-v1');
      if (opsRaw) {
        try {
          const parsed = JSON.parse(opsRaw);
          if (Array.isArray(parsed.users)) {
            payload.students = parsed.users.filter((u: { role?: string }) => u.role === 'STUDENT');
          }
          if (Array.isArray(parsed.sessions)) payload.sessions = parsed.sessions;
          if (Array.isArray(parsed.attendance)) payload.attendance = parsed.attendance;
          if (Array.isArray(parsed.invoices)) payload.invoices = parsed.invoices;
          if (Array.isArray(parsed.payments)) payload.payments = parsed.payments;
          if (Array.isArray(parsed.expenses)) payload.expenses = parsed.expenses;
        } catch {}
      }

      // 2. Groups & Classrooms
      const grpRaw = localStorage.getItem(`yc-center-groups-v1:${tenant.id}`);
      if (grpRaw) {
        try {
          const parsed = JSON.parse(grpRaw);
          payload.groups = Array.isArray(parsed) ? parsed : parsed.groups;
        } catch {}
      }
      const roomRaw = localStorage.getItem(`yc-center-classrooms-v1:${tenant.id}`);
      if (roomRaw) {
        try {
          payload.classrooms = JSON.parse(roomRaw);
        } catch {}
      }

      // 3. Teachers
      const teachersRaw = localStorage.getItem(`yc-teacher-profiles-v1:${tenant.id}`);
      if (teachersRaw) {
        try {
          payload.teachers = JSON.parse(teachersRaw);
        } catch {}
      }

      // 4. Materials
      const matRaw = localStorage.getItem(`yc-materials-v1:${tenant.id}`);
      if (matRaw) {
        try {
          payload.materials = JSON.parse(matRaw);
        } catch {}
      }

      setDetectedPayload(payload);
    } finally {
      setIsScanning(false);
    }
  }, [tenant.id]);

  useEffect(() => {
    if (isOpen) {
      scanLocalStorage();
      setAuthError(null);
      setImportError(null);
      setImportResult(null);
    }
  }, [isOpen, scanLocalStorage]);

  // Handle Sign In with Email
  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await signInFirebaseStaff(email, password);
      // Auto-bootstrap staff role
      await bootstrapCenterStaff(tenant.slug, res.idToken);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'فشل تسجيل الدخول');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Google Sign In
  const handleGoogleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInFirebaseGoogle();
      const token = await getFreshFirebaseIdToken();
      if (token) {
        await bootstrapCenterStaff(tenant.slug, token).catch(() => null);
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'فشل تسجيل الدخول بحساب Google');
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    setAuthLoading(true);
    try {
      await signOutFirebaseStaff();
    } finally {
      setAuthLoading(false);
    }
  };

  // Handle Execute Import
  const handleExecuteImport = async () => {
    if (!detectedPayload || !auth.idToken) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const result = await importBrowserDataToCloud(tenant.slug, auth.idToken, detectedPayload);
      setImportResult(result);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'حدث خطأ أثناء الاستيراد السحابي');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen || !mounted) return null;

  const totalDetected =
    (detectedPayload?.students?.length || 0) +
    (detectedPayload?.groups?.length || 0) +
    (detectedPayload?.classrooms?.length || 0) +
    (detectedPayload?.teachers?.length || 0) +
    (detectedPayload?.sessions?.length || 0) +
    (detectedPayload?.attendance?.length || 0) +
    (detectedPayload?.invoices?.length || 0) +
    (detectedPayload?.payments?.length || 0) +
    (detectedPayload?.materials?.length || 0);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" dir="rtl">
      <div className="bg-card border border-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-border flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-500 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-base">مزامنة سحابة Firebase وقاعدة البيانات</h3>
              <p className="text-xs text-muted-foreground">{tenant.nameAr} — مشروع yalla-center</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-muted text-muted-foreground flex items-center justify-center text-sm"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-sm">
          {/* Status Banner */}
          <div className="p-4 rounded-xl border border-border bg-background flex items-center justify-between">
            <div className="flex items-center gap-3">
              {auth.user ? (
                <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
              ) : (
                <div className="w-3 h-3 rounded-full bg-amber-500" />
              )}
              <div>
                <div className="font-semibold text-foreground">
                  {auth.user ? 'جلسة Firebase السحابية متصلة' : 'قيد العمل بالوضع المحلي (Local Demo)'}
                </div>
                <div className="text-xs text-muted-foreground">
                  {auth.user ? auth.user.email : 'سجل الدخول بحساب السنتر لتفعيل الحفظ في Firestore'}
                </div>
              </div>
            </div>

            {auth.user ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                disabled={authLoading}
                className="text-xs h-8"
              >
                تسجيل الخروج
              </Button>
            ) : null}
          </div>

          {/* If NOT signed in: Sign-in Section */}
          {!auth.user && auth.configured && (
            <div className="p-4 rounded-xl border border-brand-cyan-500/20 bg-brand-cyan-500/5 space-y-3">
              <div className="font-bold text-foreground flex items-center gap-2">
                <Lock className="w-4 h-4 text-brand-cyan-500" />
                تسجيل الدخول لتفعيل المزامنة السحابية
              </div>

              {authError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleEmailSignIn} className="space-y-2.5">
                <div>
                  <input
                    type="email"
                    placeholder="البريد الإلكتروني للسنتر..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
                    required
                  />
                </div>
                <div>
                  <input
                    type="password"
                    placeholder="كلمة المرور..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-9 px-3 text-xs rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
                    required
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    type="submit"
                    size="sm"
                    disabled={authLoading}
                    className="flex-1 text-xs h-9 bg-brand-blue-600 hover:bg-brand-blue-700 text-white"
                  >
                    {authLoading ? 'جارٍ تسجيل الدخول...' : 'دخول بحساب السنتر'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGoogleSignIn}
                    disabled={authLoading}
                    className="text-xs h-9"
                  >
                    Google
                  </Button>
                </div>
              </form>
            </div>
          )}

          {/* If Firebase config is missing in environment: allow instant browser link */}
          {!auth.configured && (
            <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 text-xs space-y-3">
              <div className="font-bold flex items-center justify-between text-amber-700 dark:text-amber-400">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-amber-500" />
                  <span>تفعيل تطبيق Firebase Web للمتصفح</span>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono">مشروع yalla-center</Badge>
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                لتفعيل تسجيل الدخول بحساب Google والبريد الإلكتروني، يمكنك إدخال مفاتيح تطبيق الويب من Firebase Console:
              </p>
              <div className="space-y-2 pt-1">
                <input
                  type="text"
                  placeholder="Firebase Web API Key (مثال: AIzaSy...)"
                  value={customApiKey}
                  onChange={(e) => setCustomApiKey(e.target.value)}
                  className="w-full h-8 px-3 text-xs rounded-lg border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <input
                  type="text"
                  placeholder="Firebase Web App ID (مثال: 1:123456...:web:...)"
                  value={customAppId}
                  onChange={(e) => setCustomAppId(e.target.value)}
                  className="w-full h-8 px-3 text-xs rounded-lg border border-border bg-background text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    if (customApiKey.trim() && customAppId.trim()) {
                      saveFirebaseWebConfig({ apiKey: customApiKey, appId: customAppId });
                      window.location.reload();
                    }
                  }}
                  disabled={!customApiKey.trim() || !customAppId.trim()}
                  className="w-full h-8 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white"
                >
                  حفظ وتفعيل الاتصال السحابي بالمتصفح
                </Button>
              </div>
            </div>
          )}

          {/* Import Browser Data Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <div className="font-bold text-foreground flex items-center gap-2">
                <UploadCloud className="w-4 h-4 text-brand-blue-500" />
                استيراد البيانات المسجلة بالمتصفح إلى السحابة
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={scanLocalStorage}
                disabled={isScanning}
                className="h-7 text-xs text-muted-foreground"
              >
                <RefreshCw className={`w-3 h-3 ml-1 ${isScanning ? 'animate-spin' : ''}`} />
                إعادة الفحص
              </Button>
            </div>

            {/* Detected Records Breakdown */}
            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-base font-bold text-foreground">
                  {detectedPayload?.students?.length || 0}
                </div>
                <div className="text-[11px] text-muted-foreground">الطلاب</div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-base font-bold text-foreground">
                  {detectedPayload?.groups?.length || 0}
                </div>
                <div className="text-[11px] text-muted-foreground">المجموعات</div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-base font-bold text-foreground">
                  {detectedPayload?.teachers?.length || 0}
                </div>
                <div className="text-[11px] text-muted-foreground">المعلمين</div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-base font-bold text-foreground">
                  {detectedPayload?.sessions?.length || 0}
                </div>
                <div className="text-[11px] text-muted-foreground">الحصص</div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-base font-bold text-foreground">
                  {detectedPayload?.attendance?.length || 0}
                </div>
                <div className="text-[11px] text-muted-foreground">سجلات الحضور</div>
              </div>
              <div className="p-2.5 rounded-xl border border-border bg-muted/20 text-center">
                <div className="text-base font-bold text-foreground">
                  {(detectedPayload?.invoices?.length || 0) + (detectedPayload?.payments?.length || 0)}
                </div>
                <div className="text-[11px] text-muted-foreground">فواتير ومدفوعات</div>
              </div>
            </div>

            {/* Result / Error Alerts */}
            {importResult && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{importResult.message}</span>
              </div>
            )}

            {importError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{importError}</span>
              </div>
            )}

            {/* Action Button */}
            <Button
              onClick={handleExecuteImport}
              disabled={isImporting || !auth.user || totalDetected === 0}
              className="w-full h-10 text-xs font-bold bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white"
            >
              {isImporting ? (
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>جارٍ نقل السجلات إلى Cloud Firestore...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    {!auth.user
                      ? 'سجّل الدخول بحساب السنتر لتفعيل زر الاستيراد السحابي'
                      : totalDetected > 0
                        ? `استيراد ${totalDetected} سجل إلى Firebase`
                        : 'لا توجد سجلات محلية جديدة للاستيراد'}
                  </span>
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            إغلاق
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
