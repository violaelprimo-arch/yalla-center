'use client';

import { useTenant } from './tenant-provider';
import { StaffLogin } from './staff-login';

export function MasterDataStatus() {
  const { masterData } = useTenant();
  const { demo, auth, error, refresh } = masterData;

  if (error) {
    return <div role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
      {error}
      <button type="button" className="ms-3 underline" onClick={refresh}>إعادة التحميل</button>
    </div>;
  }
  if (demo) {
    return <p className="text-xs text-muted-foreground">نسخة تجريبية · الحفظ على هذا المتصفح</p>;
  }
  if (!auth.loading && !auth.idToken) {
    return <StaffLogin signIn={auth.signIn} failedLogin={Boolean(auth.error)} />;
  }
  return null;
}
