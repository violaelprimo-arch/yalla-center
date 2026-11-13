import { clockLabel, weekdayLabel } from './group-schedule';
import type { WeeklyScheduleRow } from './schedule-view';

const headings = ['اليوم', 'من', 'إلى', 'المجموعة', 'المعلم', 'القاعة', 'الفرع', 'المادة'];
const columns = [112, 116, 116, 310, 264, 228, 206, 220];

export function scheduleExportRows(rows: WeeklyScheduleRow[]) {
  return [headings, ...rows.map(row => [
    weekdayLabel(row.day), clockLabel(row.start), clockLabel(row.end),
    row.group, row.teacher, row.room, row.branch, row.subject,
  ])];
}

export async function downloadScheduleExcel(rows: WeeklyScheduleRow[]) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const cells = scheduleExportRows(rows).map((row, index) => row.map(value => ({
    value, type: String as StringConstructor, align: 'right' as const, wrap: true,
    ...(index === 0 ? { fontWeight: 'bold' as const, backgroundColor: '#E7F4FA' } : {}),
  })));
  await writeExcelFile(cells, {
    sheet: 'الجدول الأسبوعي', rightToLeft: true, orientation: 'landscape', stickyRowsCount: 1,
    columns: columns.map(width => ({ width: Math.round(width / 9) })),
  }).toFile('Yalla-Center-Weekly-Schedule.xlsx');
}

function wrappedText(context: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && context.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  lines.push(line);
  return lines;
}

export async function downloadSchedulePdf(rows: WeeklyScheduleRow[], center: string, filter: string) {
  const { jsPDF } = await import('jspdf');
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
  const canvas = document.createElement('canvas');
  canvas.width = 1668;
  canvas.height = 1146;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('تعذّر تجهيز ملف PDF');

  context.direction = 'rtl';
  context.textAlign = 'right';
  context.textBaseline = 'middle';
  const font = 'Tahoma, Arial, sans-serif';
  const edge = 48;
  const width = canvas.width - 2 * edge;
  const tableWidths = columns.map(column => column * width / columns.reduce((sum, size) => sum + size, 0));
  let y = 0;
  let page = 0;

  function row(values: string[], index: number, header = false) {
    const ctx = context!;
    ctx.font = `${header ? 'bold ' : ''}23px ${font}`;
    const cells = values.map((text, column) => wrappedText(ctx, text, tableWidths[column] - 28));
    const height = Math.max(48, ...cells.map(lines => lines.length * 32 + 16));
    if (y + height > canvas.height - 64 && !header) {
      finishPage();
      startPage();
    }
    ctx.fillStyle = header ? '#E7F4FA' : index % 2 ? '#F5F8FB' : '#FFFFFF';
    ctx.fillRect(edge, y, width, height);
    ctx.fillStyle = '#102542';
    let x = canvas.width - edge;
    cells.forEach((lines, column) => {
      lines.forEach((line, i) => ctx.fillText(line, x - 13, y + 25 + i * 32, tableWidths[column] - 26));
      x -= tableWidths[column];
    });
    ctx.strokeStyle = '#DCE6EE';
    ctx.beginPath();
    ctx.moveTo(edge, y + height);
    ctx.lineTo(canvas.width - edge, y + height);
    ctx.stroke();
    y += height;
  }

  function startPage() {
    const ctx = context!;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#102542';
    ctx.font = `bold 46px ${font}`;
    ctx.fillText('الجدول الأسبوعي', canvas.width - edge, 66);
    ctx.font = `27px ${font}`;
    ctx.fillText([center, filter].filter(Boolean).join(' · '), canvas.width - edge, 118, width);
    y = 157;
    row(headings, 0, true);
  }

  function finishPage() {
    const ctx = context!;
    if (page) pdf.addPage('a4', 'landscape');
    page += 1;
    ctx.fillStyle = '#526477';
    ctx.font = `20px ${font}`;
    ctx.fillText(`صفحة ${page}`, canvas.width - edge, canvas.height - 36);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.96), 'JPEG', 5, 5, 287, 200, undefined, 'FAST');
  }

  startPage();
  scheduleExportRows(rows).slice(1).forEach((values, index) => row(values, index));
  finishPage();
  pdf.save('Yalla-Center-Weekly-Schedule.pdf');
}
