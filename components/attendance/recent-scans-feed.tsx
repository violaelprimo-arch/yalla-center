'use client';

import React from 'react';
import Image from 'next/image';
import { History, Zap, Camera, Edit3, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { VerificationMethod, AttendanceStatus } from '@/lib/dal/types';

export interface RecentScanItem {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  scannedAt: string;
  verificationMethod: VerificationMethod;
  status: AttendanceStatus;
  balanceDue: number;
  avatarUrl?: string;
}

interface RecentScansFeedProps {
  scans: RecentScanItem[];
}

export function RecentScansFeed({ scans }: RecentScansFeedProps) {
  // Sort reverse-chronologically (newest at top)
  const sortedScans = [...scans].sort(
    (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
  );

  const getMethodBadge = (method: VerificationMethod) => {
    switch (method) {
      case 'barcode':
        return (
          <Badge variant="cyan" className="text-[10px] gap-1 font-normal">
            <Zap className="w-3 h-3" />
            <span>ليزر باركود</span>
          </Badge>
        );
      case 'qr':
        return (
          <Badge variant="cyan" className="text-[10px] gap-1 font-normal">
            <Camera className="w-3 h-3" />
            <span>كاميرا QR</span>
          </Badge>
        );
      case 'manual':
      default:
        return (
          <Badge variant="outline" className="text-[10px] gap-1 font-normal">
            <Edit3 className="w-3 h-3" />
            <span>يدوي</span>
          </Badge>
        );
    }
  };

  return (
    <div className="card-elevated rounded-3xl p-5 border border-border/80 bg-card space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-border/70">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <History className="w-4 h-4 text-brand-cyan-500" />
          <span>شريط عمليات الحضور اللحظي</span>
        </h3>
        <span className="text-xs text-muted-foreground font-mono">
          {scans.length} عملية مسجلة
        </span>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {sortedScans.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            لم يتم تسجيل أي حضور حتى الآن في هذه الحصة.
          </div>
        ) : (
          sortedScans.map((scan) => {
            const hasBalance = scan.balanceDue > 0;
            return (
              <div
                key={scan.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 border border-border/60 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
                    {scan.avatarUrl ? (
                      <Image
                        src={scan.avatarUrl}
                        alt={scan.studentName}
                        fill
                        className="object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-muted-foreground">
                        {scan.studentName.slice(0, 2)}
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {scan.studentName}
                      </span>
                      <span className="text-[10px] font-mono font-medium text-muted-foreground">
                        ({scan.studentCode})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-0.5">
                      {getMethodBadge(scan.verificationMethod)}
                      {hasBalance && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          <span>متبقي {scan.balanceDue.toFixed(2)} ج.م</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-left font-mono text-[11px] text-muted-foreground font-medium">
                  {new Date(scan.scannedAt).toLocaleTimeString('ar-EG', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
