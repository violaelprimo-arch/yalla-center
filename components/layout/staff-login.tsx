'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';

const control = 'rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';

export function StaffLogin({ signIn, failedLogin }: { signIn: (email: string, password: string) => Promise<void>; failedLogin: boolean }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try { await signIn(email, password); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="card-elevated max-w-md space-y-3 rounded-2xl border border-border p-4">
    <h2 className="font-bold">دخول إدارة السنتر</h2>
    <label className="block text-sm">البريد الإلكتروني<input className={control + ' mt-1 block w-full'} dir="ltr" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
    <label className="block text-sm">كلمة المرور<input className={control + ' mt-1 block w-full'} dir="ltr" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
    {(failed || failedLogin) && <p role="alert" className="text-sm text-red-600">تعذّر تسجيل الدخول. راجع البريد وكلمة المرور.</p>}
    <Button type="submit" disabled={busy}>{busy ? 'جارٍ تسجيل الدخول…' : 'دخول'}</Button>
  </form>;
}
