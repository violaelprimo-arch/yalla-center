'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useTenant } from '@/components/layout/tenant-provider';

export function ClassroomEditor({ branchId, onClose, onSave }: {
  branchId: string; onClose: () => void; onSave: (name: string) => void;
}) {
  const { groupData } = useTenant();
  const [nameAr, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const room = await groupData.saveClassroom({ branchId, nameAr, capacity: Number(capacity) });
      onSave(room.nameAr);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حفظ القاعة');
    } finally {
      setBusy(false);
    }
  }
  return <div className="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4">
    <form onSubmit={submit} role="dialog" aria-modal="true" aria-label="إضافة قاعة" className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xl">
      <h2 className="text-lg font-black">إضافة قاعة</h2>
      {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
      <label className="block text-sm">اسم القاعة<input autoFocus required maxLength={80}
        className="mt-1 block w-full rounded-lg border border-border bg-background p-2" value={nameAr} onChange={event => setName(event.target.value)} /></label>
      <label className="block text-sm">سعة القاعة<input type="number" required min="1" max="1000"
        className="mt-1 block w-full rounded-lg border border-border bg-background p-2" value={capacity} onChange={event => setCapacity(event.target.value)} /></label>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
        <Button type="submit" disabled={busy}>حفظ القاعة</Button>
      </div>
    </form>
  </div>;
}
