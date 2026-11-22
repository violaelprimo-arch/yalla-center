'use client';

import { useTenant } from './tenant-provider';
import { CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

export function MasterDataStatus() {
  const { masterData } = useTenant();
  const { error, refresh, saving, ready, lastSavedAt } = masterData as unknown as {
    error?: string;
    refresh: () => void;
    saving?: boolean;
    ready?: boolean;
    lastSavedAt?: string;
  };

  if (error) {
    return (
      <div role="alert" className="rounded-xl bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300 flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          تعذر الحفظ — إعادة المحاولة
        </span>
        <button type="button" className="ms-3 underline font-medium" onClick={refresh}>
          إعادة التحميل
        </button>
      </div>
    );
  }

  if (saving) {
    return (
      <p className="text-xs text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center gap-1.5 font-medium">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        جاري الحفظ على السحابة...
      </p>
    );
  }

  if (ready) {
    return (
      <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-medium">
        <CheckCircle2 className="w-3.5 h-3.5" />
        تم الحفظ على السحابة (Firestore) {lastSavedAt ? `· ${lastSavedAt}` : ''}
      </p>
    );
  }

  return null;
}
