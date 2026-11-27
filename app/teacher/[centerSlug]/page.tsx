'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  LogOut,
  UserRound,
  Wallet,
  Users,
  BookOpen,
  FileSpreadsheet,
  ShieldCheck,
  Clock,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { StaggeredCardGrid } from '@/components/motion/staggered-card-grid';
import { AnimatedMetric } from '@/components/motion/animated-metric';
import { AnimatedTabs } from '@/components/motion/animated-tabs';
import { InteractiveBarChart } from '@/components/ui/interactive-chart';
import { AcademicAchievementIllustration, EducationalSubjectBadge } from '@/components/motion/educational-graphics';
import { SkeletonKpiGrid } from '@/components/ui/skeleton';
import { cairoClock } from '@/lib/attendance/reception';
import { signInFirebaseGoogle, useFirebaseAuthSession } from '@/lib/firebase/client';
import type { TeacherPortalData } from '@/lib/firebase/teacher-service';
import type { Material, Exam } from '@/lib/dal/types';
import { getGradeNameArabic } from '@/lib/materials/taxonomy';
import { teacherApi } from '@/lib/teachers/client';
import {
  teacherPasswordEmail,
  teacherTabs,
  TEACHER_TABS,
  TEACHER_PERMISSIONS,
  type TeacherPermission,
  type TeacherTab,
} from '@/lib/teachers/profile';

const control =
  'mt-1 block w-full rounded-xl border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';
const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });

const TAB_ICONS: Record<TeacherTab, JSX.Element> = {
  account: <Wallet className="w-4 h-4" />,
  schedule: <CalendarClock className="w-4 h-4" />,
  students: <Users className="w-4 h-4" />,
  materials: <BookOpen className="w-4 h-4" />,
  exams: <FileSpreadsheet className="w-4 h-4" />,
  extraSession: <Plus className="w-4 h-4" />,
  profile: <ShieldCheck className="w-4 h-4" />,
  forum: <Users className="w-4 h-4" />,
};

export default function TeacherPortalPage({ params }: { params: { centerSlug: string } }) {
  const { centerSlug } = params;
  const auth = useFirebaseAuthSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [signingIn, setSigningIn] = useState(false);
  const [signinError, setSigninError] = useState('');
  const [month, setMonth] = useState(() => cairoClock().slice(0, 7));
  const [selectedTab, setSelectedTab] = useState<TeacherTab>('account');
  const [state, setState] = useState<{ token: string; month: string; data?: TeacherPortalData; error?: string }>();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);

  useEffect(() => {
    const token = auth.idToken;
    if (!token) return;
    const [year, monthNumber] = month.split('-').map(Number);
    const request = new AbortController();
    teacherApi<{ portal: TeacherPortalData }>(
      centerSlug,
      token,
      `?view=portal&year=${year}&month=${monthNumber}`,
      undefined,
      request.signal
    )
      .then(({ portal }) => setState({ token, month, data: portal }))
      .catch((cause) => {
        if (!request.signal.aborted) setState({ token, month, error: cause.message });
      });

    // Fetch live center exams & materials for teacher tabs when authenticated
    fetch(`/api/center/${centerSlug}/exams`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: request.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.exams) setExams(resData.exams);
      })
      .catch(() => {});

    fetch(`/api/center/${centerSlug}/materials`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: request.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((resData) => {
        if (resData?.materials) setMaterials(resData.materials);
      })
      .catch(() => {});

    return () => request.abort();
  }, [auth.idToken, month, centerSlug]);

  const current = state?.token === auth.idToken && state.month === month ? state : undefined;
  const portal = current?.data;
  const tabs = portal
    ? teacherTabs.filter(
        (t) =>
          t !== 'forum' &&
          portal.teacher.tabs.includes(t) &&
          portal.teacher.permissions.includes(TEACHER_TABS[t].permission)
      )
    : [];
  const tab = tabs.includes(selectedTab) ? selectedTab : tabs[0];

  async function signIn(method: 'username' | 'google') {
    setSigningIn(true);
    setSigninError('');
    try {
      if (method === 'username') {
        try {
          await auth.signIn(teacherPasswordEmail(centerSlug, username), password);
        } catch (err) {
          if (centerSlug === 'elmaher') {
            await auth.signIn(teacherPasswordEmail('al-maher', username), password);
          } else {
            throw err;
          }
        }
      } else {
        await signInFirebaseGoogle();
      }
      setPassword('');
    } catch {
      setSigninError(
        method === 'username'
          ? 'تعذّر الدخول. راجع اسم المستخدم وكلمة المرور.'
          : 'تعذّر الدخول بحساب Google. تأكد من الحساب المسجل عند إدارة السنتر.'
      );
    } finally {
      setSigningIn(false);
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Dedicated Independent Teacher Portal Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <BrandLogo width={138} height={34} />
            <div className="h-6 w-px bg-border hidden sm:block" />
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20 text-xs font-bold">
                بوابة المعلم
              </span>
              <span className="text-xs font-mono text-muted-foreground hidden md:inline">
                /{centerSlug}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {auth.idToken && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSigninError('');
                  void auth.signOut();
                }}
                className="gap-1.5 text-xs font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10"
              >
                <LogOut size={15} />
                <span className="hidden sm:inline">تسجيل الخروج</span>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-8">
        {!auth.configured && (
          <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>خدمة المصادقة السحابية غير متوفرة حالياً في هذه البيئة.</span>
          </div>
        )}

        {/* Independent Teacher Sign-In Experience */}
        {auth.configured && (!auth.idToken || Boolean(current?.error)) && !auth.loading && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center max-w-4xl mx-auto">
            <section className="lg:col-span-7 card-elevated space-y-5 rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-soft-lg">
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 text-xs font-bold border border-brand-cyan-500/20">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>بوابة مستقلة للمعلمين</span>
                </span>
                <h1 className="text-xl sm:text-2xl font-black text-foreground pt-2">تسجيل دخول المعلم</h1>
                <p className="text-xs text-muted-foreground">
                  متابعة مجموعاتك، كشف الحساب الشهري، المذكرات الدراسية، والامتحانات داخل سنتر /{centerSlug}.
                </p>
              </div>

              <form
                className="space-y-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  void signIn('username');
                }}
              >
                <label className="block text-xs font-bold text-foreground">
                  اسم المستخدم
                  <input
                    className={control}
                    dir="ltr"
                    autoComplete="username"
                    maxLength={32}
                    placeholder="teacher_username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    required
                  />
                </label>
                <label className="block text-xs font-bold text-foreground">
                  كلمة المرور
                  <input
                    className={control}
                    dir="ltr"
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </label>
                <Button className="w-full py-2.5 font-bold" variant="cyan" disabled={signingIn} type="submit">
                  {signingIn ? 'جارٍ الدخول...' : 'دخول إلى بوابة المعلم'}
                </Button>
              </form>

              <div className="relative flex items-center justify-center my-2">
                <div className="border-t border-border w-full" />
                <span className="bg-card px-3 text-[11px] text-muted-foreground absolute">أو</span>
              </div>

              <Button
                className="w-full py-2.5 font-bold"
                variant="outline"
                disabled={signingIn}
                type="button"
                onClick={() => void signIn('google')}
              >
                الدخول بحساب Google
              </Button>

              {signinError && (
                <p role="alert" className="text-xs font-semibold text-red-600 dark:text-red-400">
                  {signinError}
                </p>
              )}
            </section>

            <div className="lg:col-span-5 rounded-3xl border border-slate-800 bg-gradient-to-b from-slate-950 via-[#0B1528] to-slate-950 p-6 text-white space-y-5 shadow-soft-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-black">بيئة المعلم الرقمية</h2>
                  <p className="text-xs text-slate-300 mt-1">دقة 100% في الحسابات وإدارة المجموعات</p>
                </div>
                <AcademicAchievementIllustration size="sm" />
              </div>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>كشف حساب تفصيلي بالحصة والمجموعة والنسبة</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
                  <span>جدول الحصص القادم وطلبات المحاضرات الإضافية</span>
                </div>
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-900/70 border border-slate-800">
                  <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                  <span>إدارة المذكرات ونتائج امتحانات الطلاب</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {(auth.loading || (auth.idToken && !current)) && (
          <div className="space-y-4">
            <p role="status" className="text-sm font-bold text-muted-foreground">
              جارٍ تحميل بوابة المعلم…
            </p>
            <SkeletonKpiGrid count={3} />
          </div>
        )}

        {/* Access / Error Message */}
        {current?.error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400 space-y-1 max-w-4xl mx-auto"
          >
            <p className="font-bold">{current.error}</p>
            <p className="text-xs opacity-90">
              إذا كنت مسجلاً بحساب مالك المنصة أو حساب آخر، يمكنك تسجيل الدخول بحساب المعلم من النموذج أعلاه مباشرة.
            </p>
          </div>
        )}

        {/* Authenticated Teacher Dashboard */}
        {portal && (
          <>
            {/* Teacher Identity Banner */}
            <div className="card-elevated p-5 sm:p-6 rounded-3xl border border-brand-cyan-500/30 bg-gradient-to-l from-brand-cyan-500/10 via-card to-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                {portal.teacher.avatarData ? (
                  <img
                    src={portal.teacher.avatarData}
                    alt={portal.teacher.fullName}
                    className="size-16 rounded-2xl object-cover border-2 border-brand-cyan-500/40 shadow-md"
                  />
                ) : (
                  <span className="grid size-16 place-items-center rounded-2xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20">
                    <UserRound size={28} />
                  </span>
                )}
                <div>
                  <h1 className="text-xl sm:text-2xl font-black text-foreground">{portal.teacher.fullName}</h1>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="cyan" className="text-[11px]">
                      {portal.groups.length} مجموعة مسندة
                    </Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {portal.students.length} طالب مقيد
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <EducationalSubjectBadge subject="math" size="sm" showLabel={false} />
                <EducationalSubjectBadge subject="physics" size="sm" showLabel={false} />
              </div>
            </div>

            {/* Animated Navigation Tabs */}
            {tabs.length ? (
              <div className="overflow-x-auto pb-1">
                <AnimatedTabs
                  activeId={tab}
                  onChange={(id) => setSelectedTab(id as TeacherTab)}
                  tabs={tabs.map((item) => ({
                    id: item,
                    label: TEACHER_TABS[item].label,
                    icon: TAB_ICONS[item],
                  }))}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground p-4 rounded-xl bg-muted/40">
                مفيش تبويبات متاحة لحسابك حاليًا.
              </p>
            )}

            {/* Tab 1: Financial Statement */}
            {tab === 'account' && portal.account && (
              <section className="space-y-5">
                <div className="card-elevated rounded-2xl border border-border p-4 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-foreground">كشف الحساب والمستحقات المالية</h2>
                    <p className="text-xs text-muted-foreground">عرض مباشر للحصص والمجموعات والسلف للشهر المحدد</p>
                  </div>
                  <label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>شهر كشف الحساب:</span>
                    <input
                      className="rounded-xl border border-border bg-background px-3 py-1.5 text-sm font-mono"
                      type="month"
                      value={month}
                      onChange={(event) => {
                        if (event.target.value) setMonth(event.target.value);
                      }}
                    />
                  </label>
                </div>

                <StaggeredCardGrid columns={3}>
                  <AnimatedMetric
                    label="إجمالي المستحق"
                    value={Number(portal.account.summary.gross)}
                    suffix=" ج.م"
                    color="cyan"
                    icon={<Wallet className="w-4 h-4" />}
                  />
                  <AnimatedMetric
                    label="السلف والخصومات"
                    value={Number(portal.account.summary.advances)}
                    suffix=" ج.م"
                    color="amber"
                    icon={<Clock className="w-4 h-4" />}
                  />
                  <AnimatedMetric
                    label="الصافي المستحق"
                    value={Number(portal.account.summary.net)}
                    suffix=" ج.م"
                    color="emerald"
                    icon={<CheckCircle2 className="w-4 h-4" />}
                  />
                </StaggeredCardGrid>

                {portal.account.groups.length > 0 && (
                  <InteractiveBarChart
                    title="توزيع مستحقات المجموعات لهذا الشهر"
                    height={190}
                    valueFormatter={(v) => currency.format(v)}
                    data={portal.account.groups.map((g, idx) => ({
                      id: `${g.id}-${idx}`,
                      label: g.name.slice(0, 15),
                      value: Math.max(0, Number(g.due) || 0),
                    }))}
                  />
                )}

                <div className="card-elevated rounded-2xl border border-border p-4 space-y-2">
                  <h3 className="text-sm font-bold text-foreground pb-2 border-b border-border">
                    تفاصيل المجموعات والحصص المحتسبة
                  </h3>
                  <ul className="divide-y divide-border text-sm">
                    {portal.account.groups.map((group, index) => (
                      <li key={`${group.id}:${index}`} className="flex justify-between gap-2 py-2.5">
                        <span className="font-bold text-foreground">{group.name}</span>
                        <b className="font-mono text-brand-cyan-600 dark:text-brand-cyan-400">
                          {currency.format(group.due)}
                        </b>
                      </li>
                    ))}
                    {portal.account.lessons.map((lesson) => (
                      <li key={lesson.sessionId} className="flex justify-between gap-2 py-2.5">
                        <span className="text-foreground">
                          {lesson.groupName} · <span className="font-mono text-xs">{lesson.sessionDate}</span> ·{' '}
                          <Badge variant="outline" className="text-[10px]">
                            {lesson.attendanceCount} حاضر
                          </Badge>
                        </span>
                        <b className="font-mono text-emerald-600 dark:text-emerald-400">
                          {currency.format(lesson.teacherDue)}
                        </b>
                      </li>
                    ))}
                    {portal.account.groups.length === 0 && portal.account.lessons.length === 0 && (
                      <li className="py-6 text-center text-xs text-muted-foreground">
                        لا توجد حصص أو تسويات مالية مسجلة في هذا الشهر.
                      </li>
                    )}
                  </ul>
                </div>
              </section>
            )}

            {/* Tab 2: Schedule */}
            {tab === 'schedule' && (
              <section className="card-elevated rounded-2xl border border-border p-5 space-y-3">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <CalendarClock className="w-5 h-5 text-brand-cyan-500" />
                  <span>جدول الحصص القادمة ({portal.schedule.length})</span>
                </h2>
                {portal.schedule.length ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {portal.schedule.map((session) => (
                      <div
                        key={session.id}
                        className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="font-bold text-sm text-foreground">{session.groupName}</p>
                          {session.classroomName && (
                            <p className="text-xs text-muted-foreground mt-0.5">القاعة: {session.classroomName}</p>
                          )}
                        </div>
                        <div className="text-left font-mono text-xs">
                          <span className="font-bold text-foreground block">{session.date}</span>
                          <span dir="ltr" className="text-brand-cyan-600 dark:text-brand-cyan-400">
                            {session.start} – {session.end}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">مفيش حصص قادمة في الجدول.</p>
                )}
              </section>
            )}

            {/* Tab 3: Students */}
            {tab === 'students' && (
              <section className="card-elevated rounded-2xl border border-border p-5 space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-brand-cyan-500" />
                  <span>طلاب المجموعات المقيدين ({portal.students.length})</span>
                </h2>
                {portal.students.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {portal.students.map((student) => (
                      <div
                        key={student.id}
                        className="p-3.5 rounded-xl border border-border bg-muted/20 space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-sm text-foreground">{student.name}</span>
                          {student.code && (
                            <Badge variant="cyan" className="text-[10px] font-mono">
                              {student.code}
                            </Badge>
                          )}
                        </div>
                        {(student.phone || student.grade) && (
                          <p className="text-xs text-muted-foreground flex items-center justify-between gap-2">
                            <span>{student.grade ? getGradeNameArabic(student.grade) : ''}</span>
                            {student.phone && <span dir="ltr" className="font-mono">{student.phone}</span>}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">مفيش طلاب مقيدين في مجموعاتك.</p>
                )}
              </section>
            )}

            {/* Tab 4: Materials */}
            {tab === 'materials' && (
              <section className="card-elevated rounded-2xl border border-border p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <BookOpen className="w-5 h-5 text-brand-cyan-500" />
                      <span>المذكرات والملازم الدراسية</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      عرض وإدارة المذكرات المرفوعة والمرتبطة بالمواد والوحدات
                    </p>
                  </div>
                  <Link
                    href={`/center/${centerSlug}/materials`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>إدارة ورفع المذكرات</span>
                  </Link>
                </div>

                {materials.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {materials.map((mat) => (
                      <div key={mat.id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {mat.unitName} › {mat.lessonName}
                          </Badge>
                          <span className="text-[10px] font-mono text-muted-foreground">{mat.wordCount} كلمة</span>
                        </div>
                        <h3 className="font-bold text-sm text-foreground line-clamp-1">{mat.title}</h3>
                        {mat.googleDriveWebViewLink && (
                          <a
                            href={mat.googleDriveWebViewLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-brand-cyan-600 hover:underline"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>فتح الملف</span>
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4">لا توجد مذكرات مرفوعة حالياً.</p>
                )}
              </section>
            )}

            {/* Tab 5: Exams */}
            {tab === 'exams' && (
              <section className="card-elevated rounded-2xl border border-border p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-purple-500" />
                      <span>امتحانات المجموعات والبنك الذكي</span>
                    </h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      مراجعة الامتحانات ونماذج A4 ومتابعة حالة النشر للطلاب
                    </p>
                  </div>
                  <Link
                    href={`/center/${centerSlug}/exams`}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground text-xs font-bold transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-purple-500" />
                    <span>فتح أستوديو الامتحانات</span>
                  </Link>
                </div>

                {exams.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {exams.map((ex) => (
                      <div key={ex.id} className="p-4 rounded-xl border border-border bg-muted/20 flex items-center justify-between gap-3">
                        <div>
                          <h3 className="font-bold text-sm text-foreground">{ex.title}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            الزمن: {ex.durationMinutes} دقيقة · الدرجة: {ex.totalMarks}
                          </p>
                        </div>
                        <Badge variant={ex.status === 'published' ? 'success' : 'outline'} className="text-[10px]">
                          {ex.status === 'published' ? 'منشور' : 'مسودة'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-4">لا توجد امتحانات مسجلة للمجموعات حالياً.</p>
                )}
              </section>
            )}

            {/* Tab 6: Profile & Permissions */}
            {tab === 'profile' && (
              <section className="card-elevated rounded-2xl border border-border p-5 space-y-4">
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-brand-cyan-500" />
                  <span>بيانات الحساب والصلاحيات المعتمدة</span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {(Object.keys(TEACHER_PERMISSIONS) as TeacherPermission[]).map((perm) => {
                    const granted = portal.teacher.permissions.includes(perm);
                    return (
                      <div
                        key={perm}
                        className={`p-3 rounded-xl border flex items-center gap-2 ${
                          granted
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 font-bold'
                            : 'bg-muted/30 border-border text-muted-foreground opacity-65'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{TEACHER_PERMISSIONS[perm]}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Tab 7: Extra Session Request */}
            {tab === 'extraSession' && auth.idToken && (
              <ExtraSessionForm centerSlug={centerSlug} token={auth.idToken} groups={portal.groups} />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ExtraSessionForm({
  centerSlug,
  token,
  groups,
}: {
  centerSlug: string;
  token: string;
  groups: TeacherPortalData['groups'];
}) {
  const [groupId, setGroupId] = useState(groups[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [id, setId] = useState<string>();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const today = cairoClock().slice(0, 10);
  const lastDate = new Date(Date.parse(today) + 6 * 86400000).toISOString().slice(0, 10);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setStatus('');
    setBusy(true);
    const requestId = id ?? crypto.randomUUID();
    setId(requestId);
    try {
      await teacherApi(centerSlug, token, '', {
        action: 'extraSession',
        request: { id: requestId, groupId, date, time, note },
      });
      setStatus('تم إرسال الطلب لإدارة السنتر');
      setId(undefined);
      setDate('');
      setTime('');
      setNote('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر إرسال الطلب');
    } finally {
      setBusy(false);
    }
  }

  if (!groups.length) {
    return (
      <p className="text-sm text-muted-foreground p-4 rounded-xl bg-muted/40">
        طلب محاضرة إضافية يحتاج مجموعة مسندة لحسابك.
      </p>
    );
  }
  return (
    <form className="card-elevated max-w-lg space-y-3 rounded-2xl border border-border p-5" onSubmit={submit}>
      <h2 className="text-base font-bold text-foreground">طلب حصة أو مراجعة إضافية</h2>
      <label className="block text-sm">
        المجموعة
        <select
          className={control}
          required
          value={groupId}
          onChange={(event) => {
            setId(undefined);
            setGroupId(event.target.value);
          }}
        >
          {groups.map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          التاريخ
          <input
            className={control}
            type="date"
            min={today}
            max={lastDate}
            value={date}
            onChange={(event) => {
              setId(undefined);
              setDate(event.target.value);
            }}
            required
          />
        </label>
        <label className="text-sm">
          الساعة بتوقيت القاهرة
          <input
            className={control}
            type="time"
            value={time}
            onChange={(event) => {
              setId(undefined);
              setTime(event.target.value);
            }}
            required
          />
        </label>
      </div>
      <label className="block text-sm">
        ملاحظة اختيارية
        <textarea
          className={control}
          value={note}
          maxLength={400}
          onChange={(event) => {
            setId(undefined);
            setNote(event.target.value);
          }}
        />
      </label>
      {status && (
        <p role="status" className="text-sm font-bold text-emerald-600">
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm font-bold text-red-600">
          {error}
        </p>
      )}
      <Button type="submit" variant="cyan" disabled={busy}>
        {busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}
      </Button>
    </form>
  );
}
