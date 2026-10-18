import { describe, it, expect, vi } from 'vitest';
import {
  numberToArabicWords,
  generatePayrollCSV,
  downloadCSV,
  TeacherPayrollExportRecord,
} from '@/lib/finance/export';

describe('Financial Export & Tafqeet Engine (Unit Tests)', () => {
  describe('numberToArabicWords (Tafqeet)', () => {
    it('handles zero correctly', () => {
      expect(numberToArabicWords(0)).toBe('فقط صفر جنيه مصري لا غير');
    });

    it('converts single pound (1 EGP)', () => {
      expect(numberToArabicWords(1)).toBe('فقط جنيه مصري واحد لا غير');
    });

    it('converts two pounds (2 EGP)', () => {
      expect(numberToArabicWords(2)).toBe('فقط جنيهان مصريان لا غير');
    });

    it('converts amounts between 3 and 10 pounds (genitive plural)', () => {
      expect(numberToArabicWords(5)).toBe('فقط خمسة جنيهات مصرية لا غير');
    });

    it('converts typical tuition amounts (150 EGP, 300 EGP, 400 EGP)', () => {
      expect(numberToArabicWords(150)).toBe('فقط مائة وخمسون جنيهاً مصرياً لا غير');
      expect(numberToArabicWords(300)).toBe('فقط ثلاثمائة جنيهاً مصرياً لا غير');
    });

    it('handles piastres fraction correctly (e.g. 150.50 EGP)', () => {
      const words = numberToArabicWords(150.5);
      expect(words).toContain('مائة وخمسون جنيهاً مصرياً');
      expect(words).toContain('خمسون قرشاً');
      expect(words).toContain('لا غير');
    });

    it('handles negative amounts cleanly', () => {
      expect(numberToArabicWords(-100)).toContain('سالب');
    });
  });

  describe('generatePayrollCSV & downloadCSV', () => {
    const mockRecords: TeacherPayrollExportRecord[] = [
      {
        teacherName: 'د. هاني نبيل (أستاذ الفيزياء)',
        month: 10,
        year: 2026,
        conductedSessions: 4,
        totalAttendance: 52,
        averageAttendance: 13.0,
        calculatedCompensation: 260.0,
        bonuses: 50.0,
        deductions: 20.0,
        netPayroll: 290.0,
        status: 'معتمد',
      },
    ];

    it('generates CSV with mandatory UTF-8 Byte Order Mark (\uFEFF) for Arabic Excel compatibility', () => {
      const csv = generatePayrollCSV(mockRecords);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('اسم المعلم');
      expect(csv).toContain('د. هاني نبيل (أستاذ الفيزياء)');
      expect(csv).toContain('290.00');
      expect(csv).toContain('معتمد');
    });

    it('handles downloadCSV without throwing error in headless environment', () => {
      expect(() => downloadCSV('test_report', 'col1,col2\nval1,val2')).not.toThrow();
    });
  });
});
