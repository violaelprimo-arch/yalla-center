'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Building2, CalendarDays, Layers, Plus, Users } from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { Button } from '@/components/ui/button';
import { ClassroomEditor } from '@/components/timetable/classroom-editor';

export default function BranchesPage() {
  const { tenant, branches, groupData } = useTenant();
  const { classrooms } = groupData;
  const [selected, setSelected] = useState<string>();
  const [notice, setNotice] = useState('');

  return <div className="space-y-5" dir="rtl">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
      <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl"><Building2 className="text-brand-cyan-600" /> الفروع والقاعات</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Link className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          href={`/center/${tenant.slug}/branches-list`}><Layers size={16} /> قائمة الفروع</Link>
        <Link className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted"
          href={`/center/${tenant.slug}/sessions#weekly`}><CalendarDays size={16} /> عرض الجدول</Link>
      </div>
    </div>
    <MasterDataStatus />
    {groupData.error && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{groupData.error}
      <button className="ms-2 underline" type="button" onClick={groupData.refresh}>إعادة التحميل</button>
    </p>}
    {notice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {!branches.length && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">مفيش فروع مسجلة.</p>}
    <div className="grid gap-3 md:grid-cols-2">
      {branches.map(branch => {
        const rooms = classrooms.filter(room => room.branchId === branch.id);
        const count = groupData.groups.filter(group => group.isActive && group.branchId === branch.id).length;
        return <section key={branch.id} className="space-y-3 rounded-xl border border-border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="font-black">{branch.nameAr}</h2>
              <p className="text-xs text-muted-foreground">{rooms.length} قاعة · {count} مجموعة</p>
            </div>
            {branch.isActive && groupData.canEdit && <Button size="sm" variant="outline" onClick={() => setSelected(branch.id)}>
              <Plus size={16} /> إضافة قاعة
            </Button>}
          </div>
          <ul className="divide-y divide-border">
            {rooms.map(room => <li key={room.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span className="font-semibold">{room.nameAr}</span><span className="inline-flex items-center gap-1 text-muted-foreground"><Users size={15} /> {room.capacity} مقعد</span>
            </li>)}
            {!rooms.length && <li className="text-sm text-muted-foreground">مفيش قاعات مسجلة للفرع.</li>}
          </ul>
        </section>;
      })}
    </div>
    {selected && <ClassroomEditor branchId={selected} onClose={() => setSelected(undefined)} onSave={name => {
      setSelected(undefined);
      setNotice(`تمت إضافة ${name}`);
    }} />}
  </div>;
}
