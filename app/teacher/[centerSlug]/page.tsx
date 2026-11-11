'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { CalendarClock, LogOut, UserRound } from 'lucide-react';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';
import { cairoClock } from '@/lib/attendance/reception';
import { signInFirebaseGoogle, useFirebaseAuthSession } from '@/lib/firebase/client';
import type { TeacherPortalData } from '@/lib/firebase/teacher-service';
import { getGradeNameArabic } from '@/lib/materials/taxonomy';
import { teacherApi } from '@/lib/teachers/client';
import { teacherPasswordEmail, teacherTabs, TEACHER_TABS, type TeacherTab } from '@/lib/teachers/profile';

const control = 'mt-1 block w-full rounded-xl border border-border bg-background p-2.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';
const currency = new Intl.NumberFormat('ar-EG', { style: 'currency', currency: 'EGP' });

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

  useEffect(() => {
    const token = auth.idToken;
    if (!token) return;
    const [year, monthNumber] = month.split('-').map(Number);
    const request = new AbortController();
    teacherApi<{ portal: TeacherPortalData }>(centerSlug, token, `?view=portal&year=${year}&month=${monthNumber}`, undefined, request.signal)
      .then(({ portal }) => setState({ token, month, data: portal }))
      .catch(cause => { if (!request.signal.aborted) setState({ token, month, error: cause.message }); });
    return () => request.abort();
  }, [auth.idToken, month, centerSlug]);

  const current = state?.token === auth.idToken && state.month === month ? state : undefined;
  const portal = current?.data;
  const tabs = portal ? teacherTabs.filter(tab => tab !== 'forum' && portal.teacher.tabs.includes(tab) &&
    portal.teacher.permissions.includes(TEACHER_TABS[tab].permission)) : [];
  const tab = tabs.includes(selectedTab) ? selectedTab : tabs[0];

  async function signIn(method: 'username' | 'google') {
    setSigningIn(true);
    setSigninError('');
    try {
      if (method === 'username') await auth.signIn(teacherPasswordEmail(centerSlug, username), password);
      else await signInFirebaseGoogle();
      setPassword('');
    } catch {
      setSigninError(method === 'username'
        ? 'تعذّر الدخول. راجع اسم المستخدم وكلمة المرور.'
        : 'تعذّر الدخول بحساب Google. تأكد من الحساب المسجل عند إدارة السنتر.');
    } finally {
      setSigningIn(false);
    }
  }

  return <main dir="rtl" className="mx-auto min-h-screen max-w-5xl space-y-5 px-4 py-8 sm:px-8">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
      <div className="flex items-center gap-3">
        <BrandLogo width={145} height={36} />
        <h1 className="text-lg font-black sm:text-2xl">بوابة المعلم</h1>
      </div>
      {auth.idToken && <Button variant="outline" onClick={() => { setSigninError(''); void auth.signOut(); }}><LogOut size={16} /> تسجيل الخروج</Button>}
    </header>

    {!auth.configured && <p className="rounded-2xl border border-border bg-card p-5 text-sm">دخول المعلمين يحتاج إعداد Firebase في هذه البيئة.</p>}
    {auth.configured && !auth.idToken && !auth.loading && <section className="card-elevated mx-auto max-w-md space-y-4 rounded-2xl border border-border p-5">
      <h2 className="text-lg font-bold">تسجيل دخول المعلم</h2>
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); void signIn('username'); }}>
        <label className="block text-sm">اسم المستخدم
          <input className={control} dir="ltr" autoComplete="username" maxLength={32} value={username}
            onChange={event => setUsername(event.target.value)} required />
        </label>
        <label className="block text-sm">كلمة المرور
          <input className={control} dir="ltr" type="password" autoComplete="current-password" value={password}
            onChange={event => setPassword(event.target.value)} required />
        </label>
        <Button className="w-full" disabled={signingIn} type="submit">دخول</Button>
      </form>
      <Button className="w-full" variant="outline" disabled={signingIn} type="button" onClick={() => void signIn('google')}>الدخول بحساب Google</Button>
      {signinError && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{signinError}</p>}
    </section>}
    {(auth.loading || (auth.idToken && !current)) && <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل بوابة المعلم…</p>}
    {current?.error && <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">{current.error}</p>}
    {portal && <>
      <div className="flex items-center gap-3">
        {portal.teacher.avatarData ? <img src={portal.teacher.avatarData} alt="" className="size-12 rounded-xl object-cover" />
          : <span className="grid size-12 place-items-center rounded-xl bg-muted"><UserRound size={22} /></span>}
        <h2 className="text-xl font-bold">{portal.teacher.fullName}</h2>
      </div>
      {tabs.length ? <nav aria-label="تبويبات المعلم" className="flex flex-wrap gap-2">
        {tabs.map(item => <Button key={item} aria-pressed={tab === item} variant={tab === item ? 'cyan' : 'outline'}
          onClick={() => setSelectedTab(item)}>{TEACHER_TABS[item].label}</Button>)}
      </nav> : <p className="text-sm text-muted-foreground">مفيش تبويبات متاحة لحسابك حاليًا.</p>}
      {tab === 'account' && portal.account && <section className="card-elevated space-y-4 rounded-2xl border border-border p-4">
        <label className="inline-block text-sm">شهر كشف الحساب
          <input className={control} type="month" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value); }} />
        </label>
        <dl className="grid gap-2 sm:grid-cols-3">
          {[['إجمالي المستحق', portal.account.summary.gross], ['السلف', portal.account.summary.advances], ['الصافي', portal.account.summary.net]].map(([label, value]) =>
            <div className="rounded-xl bg-muted/55 p-3" key={label}><dt className="text-sm text-muted-foreground">{label}</dt><dd className="font-bold">{currency.format(Number(value))}</dd></div>)}
        </dl>
        <ul className="divide-y divide-border text-sm">
          {portal.account.groups.map(group => <li key={group.id} className="flex justify-between gap-2 py-2"><span>{group.name}</span><b>{currency.format(group.due)}</b></li>)}
          {portal.account.lessons.map(lesson => <li key={lesson.sessionId} className="flex justify-between gap-2 py-2">
            <span>{lesson.groupName} · {lesson.sessionDate} · {lesson.attendanceCount} حاضر</span><b>{currency.format(lesson.teacherDue)}</b>
          </li>)}
        </ul>
      </section>}
      {tab === 'schedule' && <section className="card-elevated rounded-2xl border border-border p-4">
        {portal.schedule.length ? <ul className="divide-y divide-border text-sm">{portal.schedule.map(session =>
          <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="flex items-center gap-2"><CalendarClock size={16} /> {session.groupName}</span>
            <span dir="ltr" className="text-muted-foreground">{session.date} · {session.start}–{session.end}</span>
          </li>)}</ul> : <p className="text-sm text-muted-foreground">مفيش حصص قادمة في الجدول.</p>}
      </section>}
      {tab === 'students' && <section className="card-elevated rounded-2xl border border-border p-4">
        {portal.students.length ? <ul className="divide-y divide-border text-sm">{portal.students.map(student =>
          <li key={student.id} className="py-3">
            <span className="font-bold">{student.name}</span> {student.code && <span className="text-muted-foreground">· {student.code}</span>}
            {(student.phone || student.grade) && <p className="text-xs text-muted-foreground">{student.grade && getGradeNameArabic(student.grade)} {student.phone && <span dir="ltr">{student.phone}</span>}</p>}
          </li>)}</ul> : <p className="text-sm text-muted-foreground">مفيش طلاب مقيدين في مجموعاتك.</p>}
      </section>}
      {tab === 'extraSession' && auth.idToken && <ExtraSessionForm centerSlug={centerSlug} token={auth.idToken} groups={portal.groups} />}
    </>}
  </main>;
}

function ExtraSessionForm({ centerSlug, token, groups }: { centerSlug: string; token: string; groups: TeacherPortalData['groups'] }) {
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
      await teacherApi(centerSlug, token, '', { action: 'extraSession', request: { id: requestId, groupId, date, time, note } });
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

  if (!groups.length) return <p className="text-sm text-muted-foreground">طلب محاضرة يحتاج مجموعة مسندة لحسابك.</p>;
  return <form className="card-elevated max-w-lg space-y-3 rounded-2xl border border-border p-4" onSubmit={submit}>
    <label className="block text-sm">المجموعة
      <select className={control} required value={groupId} onChange={event => { setId(undefined); setGroupId(event.target.value); }}>
        {groups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}
      </select>
    </label>
    <div className="grid grid-cols-2 gap-3">
      <label className="text-sm">التاريخ<input className={control} type="date" min={today} max={lastDate} value={date}
        onChange={event => { setId(undefined); setDate(event.target.value); }} required /></label>
      <label className="text-sm">الساعة بتوقيت القاهرة<input className={control} type="time" value={time}
        onChange={event => { setId(undefined); setTime(event.target.value); }} required /></label>
    </div>
    <label className="block text-sm">ملاحظة اختيارية<textarea className={control} value={note} maxLength={400}
      onChange={event => { setId(undefined); setNote(event.target.value); }} /></label>
    {status && <p role="status" className="text-sm text-emerald-600">{status}</p>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <Button type="submit" disabled={busy}>{busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</Button>
  </form>;
}
