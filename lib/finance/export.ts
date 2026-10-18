/**
 * Financial Export and Tafqeet (Arabic spelled-out numbers) Utilities
 * Yalla Center — Milestone 3
 */

const ONES = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];

const ELEVEN_NINETEEN = [
  'عشرة',
  'أحد عشر',
  'اثنا عشر',
  'ثلاثة عشر',
  'أربعة عشر',
  'خمسة عشر',
  'ستة عشر',
  'سبعة عشر',
  'ثمانية عشر',
  'تسعة عشر',
];

const TENS = ['', 'عشرة', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];

const HUNDREDS = [
  '',
  'مائة',
  'مائتان',
  'ثلاثمائة',
  'أربعمائة',
  'خمسمائة',
  'ستمائة',
  'سبعمائة',
  'ثمانمائة',
  'تسعمائة',
];

function convertGroupUnder1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rem = n % 100;

  if (h > 0) {
    parts.push(HUNDREDS[h]);
  }

  if (rem > 0) {
    if (rem <= 10) {
      parts.push(ONES[rem]);
    } else if (rem >= 11 && rem <= 19) {
      parts.push(ELEVEN_NINETEEN[rem - 10]);
    } else {
      const o = rem % 10;
      const t = Math.floor(rem / 10);
      if (o > 0) {
        parts.push(`${ONES[o]} و${TENS[t]}`);
      } else {
        parts.push(TENS[t]);
      }
    }
  }

  return parts.join(' و');
}

function convertWholeNumber(num: number): string {
  if (num === 0) return 'صفر';

  const thousands = Math.floor(num / 1000);
  const remainder = num % 1000;

  let thousandsText = '';
  if (thousands === 1) {
    thousandsText = 'ألف';
  } else if (thousands === 2) {
    thousandsText = 'ألفان';
  } else if (thousands >= 3 && thousands <= 10) {
    thousandsText = `${ONES[thousands]} آلاف`;
  } else if (thousands > 10) {
    thousandsText = `${convertGroupUnder1000(thousands)} ألفاً`;
  }

  const remainderText = remainder > 0 ? convertGroupUnder1000(remainder) : '';

  if (thousandsText && remainderText) {
    return `${thousandsText} و${remainderText}`;
  }
  return thousandsText || remainderText;
}

/**
 * Converts a monetary numeric amount in EGP to official Arabic spelled-out words (Tafqeet).
 * Example: 150 -> "فقط مائة وخمسون جنيهاً مصرياً لا غير"
 */
export function numberToArabicWords(amount: number): string {
  if (amount == null || isNaN(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  if (rounded === 0) return 'فقط صفر جنيه مصري لا غير';

  const isNegative = rounded < 0;
  const absVal = Math.abs(rounded);
  const integerPart = Math.floor(absVal);
  const fractionPart = Math.round((absVal - integerPart) * 100);

  let text = '';
  if (integerPart === 1) {
    text = 'جنيه مصري واحد';
  } else if (integerPart === 2) {
    text = 'جنيهان مصريان';
  } else if (integerPart >= 3 && integerPart <= 10) {
    text = `${convertWholeNumber(integerPart)} جنيهات مصرية`;
  } else if (integerPart > 10) {
    text = `${convertWholeNumber(integerPart)} جنيهاً مصرياً`;
  }

  if (fractionPart > 0) {
    const fractionText =
      fractionPart === 1
        ? 'قرش واحد'
        : fractionPart === 2
        ? 'قرشان'
        : fractionPart <= 10
        ? `${convertWholeNumber(fractionPart)} قروش`
        : `${convertWholeNumber(fractionPart)} قرشاً`;

    if (text) {
      text = `${text} و${fractionText}`;
    } else {
      text = fractionText;
    }
  }

  const result = `فقط ${text} لا غير`;
  return isNegative ? `سالب ${result}` : result;
}

export interface TeacherPayrollExportRecord {
  teacherName: string;
  month: number;
  year: number;
  conductedSessions: number;
  totalAttendance: number;
  averageAttendance: number;
  calculatedCompensation: number;
  bonuses: number;
  deductions: number;
  netPayroll: number;
  status: string;
}

/**
 * Generates an RFC-4180 compliant CSV string with a UTF-8 Byte Order Mark (BOM: \uFEFF)
 * ensuring Arabic typography opens properly in Microsoft Excel without character corruption.
 */
export function generatePayrollCSV(records: TeacherPayrollExportRecord[]): string {
  const headers = [
    'اسم المعلم',
    'الشهر',
    'السنة',
    'الحصص المنفذة',
    'إجمالي الحضور',
    'متوسط الحضور',
    'المستحق المحسوب (ج.م)',
    'المكافآت (ج.م)',
    'الخصومات والسلف (ج.م)',
    'صافي المستحق (ج.م)',
    'حالة الاعتماد',
  ];

  const rows = records.map((r) => [
    `"${(r.teacherName || '').replace(/"/g, '""')}"`,
    r.month,
    r.year,
    r.conductedSessions,
    r.totalAttendance,
    r.averageAttendance.toFixed(2),
    r.calculatedCompensation.toFixed(2),
    r.bonuses.toFixed(2),
    r.deductions.toFixed(2),
    r.netPayroll.toFixed(2),
    `"${r.status}"`,
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');
  return csvContent;
}

/**
 * Initiates an automatic browser file download for the generated CSV content.
 */
export function downloadCSV(filename: string, csvContent: string): void {
  if (typeof window === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename.endsWith('.csv') ? filename : `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
