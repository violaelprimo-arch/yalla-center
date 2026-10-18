/**
 * Yalla Center - Fast Reception Attendance Check-In Engine (FEAT-23, FEAT-25, AC-7)
 * Path: lib/attendance/checkin.ts
 */

import { getDataProvider } from '@/lib/dal/factory';
import {
  AttendanceScanResponse,
  SessionAttendanceStats,
  VerificationMethod,
} from '@/lib/dal/types';

export interface ReceptionScanInput {
  tenantId: string;
  sessionId: string;
  studentCodeOrBarcode: string;
  verificationMethod?: VerificationMethod;
  cashierUserId?: string;
}

/**
 * Record a reception attendance scan with guaranteed idempotency and sub-20ms database append.
 */
export async function recordReceptionScan(
  input: ReceptionScanInput
): Promise<AttendanceScanResponse> {
  const dal = getDataProvider();
  return dal.recordAttendanceScan(
    input.tenantId,
    input.sessionId,
    input.studentCodeOrBarcode,
    input.cashierUserId,
    input.verificationMethod || 'barcode'
  );
}

/**
 * Calculate live session attendance statistics, progress percentage, and fee collection.
 */
export async function calculateSessionStats(
  tenantId: string,
  sessionId: string
): Promise<SessionAttendanceStats> {
  const dal = getDataProvider();
  return dal.getSessionAttendanceStats(tenantId, sessionId);
}

/**
 * ReceptionAttendanceStore
 * In-memory store supporting contract-bridge and fast unit/integration testing of AC-7.
 */
export interface ScanResult {
  success: boolean;
  duplicate: boolean;
  isNewRecord: boolean;
  studentId: string;
  studentCode: string;
  studentName: string;
  sessionId: string;
  recordedAt: string;
  message: string;
}

export class ReceptionAttendanceStore {
  private records = new Map<string, { recordedAt: string; studentId: string }>();

  public reset(): void {
    this.records.clear();
  }

  public recordScan(
    sessionId: string,
    studentId: string,
    studentCode: string,
    studentName: string = 'طالب تجريبي'
  ): ScanResult {
    const key = `${sessionId}::${studentId}`;
    if (this.records.has(key)) {
      const existing = this.records.get(key)!;
      return {
        success: true,
        duplicate: true,
        isNewRecord: false,
        studentId,
        studentCode,
        studentName,
        sessionId,
        recordedAt: existing.recordedAt,
        message: 'تم تسجيل الحضور مسبقاً لهذه الحصة',
      };
    }

    const recordedAt = new Date().toISOString();
    this.records.set(key, { recordedAt, studentId });

    return {
      success: true,
      duplicate: false,
      isNewRecord: true,
      studentId,
      studentCode,
      studentName,
      sessionId,
      recordedAt,
      message: 'تم تسجيل الحضور بنجاح',
    };
  }

  public getAttendanceCount(sessionId: string): number {
    let count = 0;
    for (const key of this.records.keys()) {
      if (key.startsWith(`${sessionId}::`)) count++;
    }
    return count;
  }
}
