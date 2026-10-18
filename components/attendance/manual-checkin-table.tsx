'use client';

import React, { useState, useMemo } from 'react';
import Image from 'next/image';
import { Search, CheckCircle2, UserCheck, ShieldAlert } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Attendance } from '@/lib/dal/types';

interface ManualCheckinTableProps {
  students: User[];
  attendanceRecords: Attendance[];
  onManualCheckin: (studentCodeOrId: string) => void;
  isLoading?: boolean;
}

export function ManualCheckinTable({
  students,
  attendanceRecords,
  onManualCheckin,
  isLoading = false,
}: ManualCheckinTableProps) {
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Map attendance by student ID
  const attendanceMap = useMemo(() => {
    const map = new Map<string, Attendance>();
    attendanceRecords.forEach((att) => {
      map.set(att.studentId, att);
    });
    return map;
  }, [attendanceRecords]);

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      const name = (s.fullName || '').toLowerCase();
      const code = (s.studentCode || s.id).toLowerCase();
      const phone = (s.phone || '').toLowerCase();
      const guardian = (s.guardianPhone || '').toLowerCase();
      return (
        name.includes(query) ||
        code.includes(query) ||
        phone.includes(query) ||
        guardian.includes(query)
      );
    });
  }, [students, searchQuery]);

  return (
    <div className="card-elevated rounded-3xl p-5 border border-border/80 bg-card space-y-4">
      {/* Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div>
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-brand-cyan-500" />
            <span>كشف الطلاب المقيدين والحضور اليدوي</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            بحث سريع بالاسم أو كود الطالب أو رقم الهاتف مع إمكانية التحضير اليدوي بنقرة واحدة
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-3" />
          <input
            type="text"
            placeholder="ابحث بالاسم أو الكود أو الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pr-9 pl-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground font-semibold">
              <th className="py-2.5 px-3">الطالب</th>
              <th className="py-2.5 px-3">كود الطالب</th>
              <th className="py-2.5 px-3">رقم المقعد</th>
              <th className="py-2.5 px-3">المستحقات</th>
              <th className="py-2.5 px-3">حالة الحضور</th>
              <th className="py-2.5 px-3 text-left">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredStudents.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-muted-foreground">
                  لا يوجد طلاب مطابقون للبحث.
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => {
                const attendance = attendanceMap.get(student.id);
                const isPresent = Boolean(attendance);
                const hasBalance = student.balanceDue > 0;

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-muted/40 transition-colors group"
                  >
                    {/* Student Info */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="relative w-8 h-8 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0 border border-border">
                          {student.avatarUrl ? (
                            <Image
                              src={student.avatarUrl}
                              alt={student.fullName}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <span className="text-xs font-bold text-muted-foreground">
                              {student.fullName.slice(0, 2)}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-bold text-foreground block">
                            {student.fullName}
                          </span>
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {student.phone || student.guardianPhone || 'بدون هاتف'}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Student Code */}
                    <td className="py-3 px-3">
                      <span className="font-mono font-bold text-foreground bg-muted/60 px-2 py-0.5 rounded-md">
                        {student.studentCode || student.id}
                      </span>
                    </td>

                    {/* Seat Number */}
                    <td className="py-3 px-3">
                      <span className="font-mono text-muted-foreground">
                        {student.seatNumber || '-'}
                      </span>
                    </td>

                    {/* Balance */}
                    <td className="py-3 px-3">
                      {hasBalance ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                          <ShieldAlert className="w-3 h-3" />
                          <span>{student.balanceDue.toFixed(2)} ج.م</span>
                        </span>
                      ) : (
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                          مسدد بالكامل ✓
                        </span>
                      )}
                    </td>

                    {/* Attendance Status */}
                    <td className="py-3 px-3">
                      {isPresent ? (
                        <Badge variant="success" className="text-[10px] font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>
                            حاضر (
                            {new Date(attendance!.scannedAt).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                            )
                          </span>
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          غائب حتى الآن
                        </Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-left">
                      {isPresent ? (
                        <span className="text-[11px] text-muted-foreground font-medium">
                          تم التسجيل
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={isLoading}
                          onClick={() => onManualCheckin(student.studentCode || student.id)}
                          className="h-8 px-3 text-xs gap-1"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>تسجيل يدوي</span>
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
