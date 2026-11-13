'use client';

import { useMemo, useState } from 'react';
import { FileDown, Printer, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clockLabel, WEEKDAYS, weekdayLabel } from '@/lib/timetable/group-schedule';
import type { WeeklyScheduleRow } from '@/lib/timetable/schedule-view';

export function WeeklyTimetable({ rows, center }: { rows: WeeklyScheduleRow[]; center: string }) {
  const [day, setDay] = useState('all');
  const [branch, setBranch] = useState('all');
  const [page, setPage] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const branches = useMemo(() => [...new Map(rows.map(row => [row.branchId, row.branch]))], [rows]);
  const filtered = rows.filter(row => (day === 'all' || row.day === Number(day)) && (branch === 'all' || row.branchId === branch));
  const pageSize = 12;
  const pageCount = Math.ceil(filtered.length / pageSize);
  const currentPage = Math.min(page, Math.max(0, pageCount - 1));
  const visible = filtered.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const description = [day === 'all' ? 'كل الأيام' : weekdayLabel(Number(day)),
    branch === 'all' ? 'كل الفروع' : branches.find(([id]) => id === branch)?.[1]].filter(Boolean).join(' · ');

  async function download(format: 'xlsx' | 'pdf') {
    setExporting(true);
    setError('');
    try {
      const files = await import('@/lib/timetable/export');
      if (format === 'xlsx') await files.downloadScheduleExcel(filtered);
      else await files.downloadSchedulePdf(filtered, center, description);
    } catch {
      setError('تعذّر تصدير الجدول. حاول مرة أخرى.');
    } finally {
      setExporting(false);
    }
  }

  return <section className="weekly-timetable space-y-4" aria-labelledby="weekly-heading">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 id="weekly-heading" className="text-xl font-black">الجدول الأسبوعي</h2>
        <p className="hidden print:block">{center} · {description}</p>
      </div>
      <div className="no-print flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={exporting || !filtered.length} onClick={() => void download('xlsx')}>
          <Sheet size={16} /> Excel
        </Button>
        <Button variant="outline" size="sm" disabled={exporting || !filtered.length} onClick={() => void download('pdf')}>
          <FileDown size={16} /> PDF
        </Button>
        <Button variant="outline" size="sm" disabled={!filtered.length} onClick={() => window.print()}>
          <Printer size={16} /> طباعة
        </Button>
      </div>
    </div>
    {error && <p className="no-print text-sm text-rose-600" role="alert">{error}</p>}
    <div className="no-print flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1" aria-label="أيام الجدول">
        <Button size="sm" variant={day === 'all' ? 'primary' : 'outline'} aria-pressed={day === 'all'}
          onClick={() => { setDay('all'); setPage(0); }}>كل الأيام</Button>
        {WEEKDAYS.map(([id, name]) => <Button key={id} size="sm" variant={day === String(id) ? 'primary' : 'outline'}
          aria-pressed={day === String(id)} onClick={() => { setDay(String(id)); setPage(0); }}>{name}</Button>)}
      </div>
      {branches.length > 1 && <select className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
        aria-label="فلترة الجدول حسب الفرع" value={branch}
        onChange={event => { setBranch(event.target.value); setPage(0); }}>
        <option value="all">كل الفروع</option>
        {branches.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>}
    </div>
    {!filtered.length && <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">مفيش حصص في الأيام والفروع المختارة.</p>}
    <div className="weekly-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {WEEKDAYS.filter(([id]) => day === 'all' || Number(day) === id).map(([id, label]) => {
        const lessons = visible.filter(row => row.day === id);
        if (pageCount > 1 && !lessons.length) return null;
        return <section className="weekly-day min-w-0 rounded-xl border border-border bg-card" key={id} aria-label={label}>
          <div className="flex items-center justify-between gap-2 border-b border-border bg-muted/60 px-3 py-2">
            <h3 className="text-sm font-bold">{label}</h3>
            <span className="text-xs text-muted-foreground">{lessons.length} حصة</span>
          </div>
          <ul className="divide-y divide-border">
            {lessons.map(row => <li key={row.id} className="space-y-1 px-3 py-2.5 text-xs">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <b className="break-words">{row.group}</b>
                <time className="text-brand-cyan-700 dark:text-brand-cyan-300" dir="ltr">{clockLabel(row.start)} – {clockLabel(row.end)}</time>
              </div>
              <p className="break-words">{row.teacher}</p>
              <p className="break-words text-muted-foreground">{row.room} · {row.branch}</p>
            </li>)}
            {!lessons.length && <li className="px-3 py-2 text-xs text-muted-foreground">لا توجد حصص</li>}
          </ul>
        </section>;
      })}
    </div>
    {pageCount > 1 && <div className="no-print flex items-center justify-end gap-2 text-xs">
      <Button size="sm" variant="outline" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>السابق</Button>
      <span>{currentPage + 1} / {pageCount}</span>
      <Button size="sm" variant="outline" disabled={currentPage + 1 === pageCount}
        onClick={() => setPage(currentPage + 1)}>التالي</Button>
    </div>}
    <table className="weekly-print-table hidden w-full border-collapse text-right">
      <thead><tr>{['اليوم', 'الموعد', 'المجموعة', 'المعلم', 'القاعة', 'الفرع', 'المادة'].map(label => <th key={label}>{label}</th>)}</tr></thead>
      <tbody>{filtered.map(row => <tr key={row.id}>
        <td>{weekdayLabel(row.day)}</td><td>{clockLabel(row.start)} – {clockLabel(row.end)}</td>
        <td>{row.group}</td><td>{row.teacher}</td><td>{row.room}</td><td>{row.branch}</td><td>{row.subject}</td>
      </tr>)}</tbody>
    </table>
    <style jsx global>{`
      @page weekly-schedule { size: A4 landscape; margin: 10mm; }
      @media print {
        body:has(.weekly-timetable) { page: weekly-schedule; }
        body:has(.weekly-timetable) aside, body:has(.weekly-timetable) header,
        body:has(.weekly-timetable) .weekly-grid { display: none !important; }
        body:has(.weekly-timetable) main, body:has(.weekly-timetable) main > div,
        body:has(.weekly-timetable) .tenant-content { padding: 0 !important; display: block !important; }
        body:has(.weekly-timetable) .weekly-timetable { color: #102542; }
        body:has(.weekly-timetable) .weekly-print-table { display: table !important; font-size: 10pt; }
        .weekly-print-table th, .weekly-print-table td { border: 1px solid #dce6ee; padding: 5pt; }
        .weekly-print-table tr { break-inside: avoid; }
        .weekly-print-table thead { display: table-header-group; }
      }
    `}</style>
  </section>;
}
