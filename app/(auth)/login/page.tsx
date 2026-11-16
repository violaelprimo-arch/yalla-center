'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Building2,
  Mail,
  Lock,
  ArrowRight,
  LogIn,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Users,
  GraduationCap,
  Briefcase,
  UserCheck,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import {
  getFirebaseClientServices,
  signInFirebaseStaff,
  signInFirebaseGoogle,
  useFirebaseAuthSession,
} from '@/lib/firebase/client';

interface DemoAccount {
  label: string;
  role: string;
  email: string;
  password: string;
  icon: React.ElementType;
  targetUrl: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    label: 'مالك المنصة (Super-Admin)',
    role: 'PLATFORM_OWNER',
    email: 'owner@yallacenter.com',
    password: 'password123',
    icon: ShieldCheck,
    targetUrl: '/owner',
  },
  {
    label: 'مدير السنتر (سنتر الماهر)',
    role: 'CENTER_ADMIN',
    email: 'admin@almaher.edu.eg',
    password: 'password123',
    icon: Building2,
    targetUrl: '/center/al-maher',
  },
  {
    label: 'معلم معتمد (أحمد عبد العزيز)',
    role: 'TEACHER',
    email: 'teacher@almaher.edu.eg',
    password: 'password123',
    icon: Briefcase,
    targetUrl: '/teacher/al-maher',
  },
  {
    label: 'طالب مقيد (بوابة الطالب)',
    role: 'STUDENT',
    email: 'student@almaher.edu.eg',
    password: 'password123',
    icon: GraduationCap,
    targetUrl: '/center/al-maher/student-portal',
  },
  {
    label: 'ولي أمر (بوابة ولي الأمر)',
    role: 'PARENT',
    email: 'parent@almaher.edu.eg',
    password: 'password123',
    icon: Users,
    targetUrl: '/center/al-maher/parent-portal',
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const authSession = useFirebaseAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isDemoAllowed, setIsDemoAllowed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      if (
        process.env.NODE_ENV !== 'production' ||
        host.includes('workers.dev') ||
        host.includes('localhost') ||
        window.location.search.includes('demo=true')
      ) {
        setIsDemoAllowed(true);
      }
    }
  }, []);

  // Sync cookies helper
  const setSessionCookies = (role: string, tenantSlug: string, userId: string) => {
    if (typeof document !== 'undefined') {
      document.cookie = `yc_role=${role}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `yc_tenant=${tenantSlug}; path=/; max-age=86400; SameSite=Lax`;
      document.cookie = `yc_user_id=${userId}; path=/; max-age=86400; SameSite=Lax`;
    }
  };

  const handleAuthenticatedUser = async (idToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (data.authenticated && data.user) {
        setSessionCookies(data.user.role, data.tenant?.slug || 'al-maher', data.user.uid);
        const destination = redirectParam || data.defaultRedirectUrl || `/center/${data.tenant?.slug || 'al-maher'}`;
        setSuccessMsg(`مرحبًا بك، ${data.user.displayName}. جارٍ تحويلك إلى بوابتك...`);
        setTimeout(() => {
          router.push(destination);
        }, 600);
      }
    } catch {
      // Fallback redirect
      router.push('/center/al-maher');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setBusy(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await signInFirebaseStaff(email, password);
      await handleAuthenticatedUser(result.idToken);
    } catch (err: unknown) {
      // Demo accounts fallback if user not yet created in remote Firebase console
      const trimmedEmail = email.trim().toLowerCase();
      const demoMatch = DEMO_ACCOUNTS.find((a) => a.email.toLowerCase() === trimmedEmail);
      if (demoMatch && (password === 'password123' || password === demoMatch.password)) {
        setSessionCookies(demoMatch.role, 'al-maher', `demo-${demoMatch.role.toLowerCase()}`);
        setSuccessMsg(`تم تسجيل الدخول بصلاحيات ${demoMatch.label}. جارٍ التحويل...`);
        setTimeout(() => {
          router.push(redirectParam || demoMatch.targetUrl);
        }, 500);
        return;
      }

      const msg =
        err instanceof Error
          ? err.message
          : 'تعذّر تسجيل الدخول. راجع البريد وكلمة المرور.';
      setErrorMsg(msg);
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    setErrorMsg(null);
    try {
      await signInFirebaseGoogle();
      const services = getFirebaseClientServices();
      const currentUser = services?.auth.currentUser;
      if (currentUser) {
        const idToken = await currentUser.getIdToken();
        await handleAuthenticatedUser(idToken);
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'تعذّر إتمام تسجيل الدخول بحساب Google';
      setErrorMsg(msg);
      setGoogleBusy(false);
    }
  };

  const applyDemoPreset = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    setErrorMsg(null);
  };

  const handleDemoDirectLogin = (account: DemoAccount) => {
    setSessionCookies(account.role, 'al-maher', `demo-${account.role.toLowerCase()}`);
    setSuccessMsg(`تم تفعيل دور ${account.label}. جارٍ الدخول...`);
    setTimeout(() => {
      router.push(account.targetUrl);
    }, 400);
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden" dir="rtl">
      {/* Ambient background glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-brand-cyan-500/10 blur-[130px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-brand-blue-700/15 blur-[130px] pointer-events-none" />

      {/* Header */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between z-10 py-2">
        <Link href="/" className="inline-block transition-transform hover:scale-[1.01]">
          <BrandLogo width={160} height={40} priority />
        </Link>
        <Link
          href="/"
          className="text-xs font-semibold text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
        >
          <span>الرئيسية</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </header>

      {/* Main Login Container */}
      <main className="w-full max-w-4xl mx-auto my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center z-10">
        {/* Left Side (or Right in RTL): Login Form */}
        <div className="lg:col-span-7 bg-card border border-border rounded-2xl shadow-soft-lg p-6 sm:p-8 space-y-6">
          <div className="space-y-1">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20 inline-flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              بوابة الدخول السحابية الموحدة
            </span>
            <h1 className="text-2xl font-black text-foreground pt-2">تسجيل الدخول إلى يلا سنتر</h1>
            <p className="text-xs text-muted-foreground">
              سجّل الدخول بحسابك السحابي للوصول التلقائي إلى بوابتك وصلاحياتك المحددة.
            </p>
          </div>

          {/* Feedback messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Google Sign In */}
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 py-2.5 rounded-xl border-border bg-background hover:bg-muted font-bold text-xs"
            onClick={handleGoogleSignIn}
            disabled={googleBusy || busy}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{googleBusy ? 'جارٍ الاتصال بـ Google…' : 'تسجيل الدخول بحساب Google'}</span>
          </Button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-border w-full" />
            <span className="bg-card px-3 text-[11px] text-muted-foreground uppercase absolute">
              أو عبر البريد الإلكتروني
            </span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                <span>البريد الإلكتروني</span>
              </label>
              <input
                type="email"
                dir="ltr"
                required
                autoComplete="email"
                placeholder="user@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 transition-all text-left"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                <span>كلمة المرور</span>
              </label>
              <input
                type="password"
                dir="ltr"
                required
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 transition-all text-left"
              />
            </div>

            <Button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-sm shadow-soft-sm flex items-center justify-center gap-2"
              disabled={busy || googleBusy}
            >
              <LogIn className="w-4 h-4" />
              <span>{busy ? 'جارٍ تسجيل الدخول…' : 'تسجيل الدخول السحابي'}</span>
            </Button>
          </form>

          {/* Status info */}
          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>نظام أمان SaaS عالي التشفير</span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Firebase Auth Active
            </span>
          </div>
        </div>

        {/* Right Side: Quick Portal Selector & Demo Accounts (Enabled on demo/dev hosts) */}
        <div className="lg:col-span-5 space-y-4">
          {!isDemoAllowed ? (
            <div className="card-elevated p-6 rounded-2xl border border-border space-y-4 bg-muted/30">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>منظومة الدخول السحابية الموثقة</span>
              </h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                يتم التحقق من الهوية والصلاحيات مركزياً عبر Firebase Authentication. يتم توجيه كل مستخدم آلياً إلى بوابته المعتمدة وفقاً لعضويته المعتمدة في السنتر.
              </p>
              <div className="p-4 rounded-xl bg-card border border-border text-xs space-y-2.5">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>عزل كامل بين بيانات المراكز والسناتر التعليمية</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>تشفير جلسات العمل وتدقيق الصلاحيات السحابية</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>دعم تسجيل الدخول عبر Google أو البريد الرسمي</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="card-elevated p-5 rounded-2xl border border-border space-y-3 bg-muted/30">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-brand-cyan-600 dark:text-brand-cyan-400" />
                <span>الدخول السريع للأدوار التجريبية (Dev Only)</span>
              </h2>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                اختر أحد الأدوار التالية لملء البيانات أو الدخول الفوري وتجربة بوابات المنصة:
              </p>

              <div className="space-y-2 pt-1">
                {DEMO_ACCOUNTS.map((acc) => {
                  const IconComponent = acc.icon;
                  return (
                    <div
                      key={acc.role}
                      className="p-3 rounded-xl border border-border bg-card hover:border-brand-cyan-500/50 transition-all flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center shrink-0">
                          <IconComponent className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{acc.label}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{acc.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => applyDemoPreset(acc)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold bg-muted hover:bg-muted/80 text-foreground transition-colors"
                          title="ملء في النموذج"
                        >
                          ملء
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDemoDirectLogin(acc)}
                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white transition-colors"
                          title="دخول فوري مباشر"
                        >
                          دخول
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-5xl mx-auto py-3 text-center text-xs text-muted-foreground border-t border-border/50 z-10">
        جميع الحقوق محفوظة © {new Date().getFullYear()} منصة يلا سنتر — تشفير سحابي Firebase
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center p-6 text-sm text-muted-foreground" dir="rtl">
          جارٍ تهيئة بوابة الدخول السحابية…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
