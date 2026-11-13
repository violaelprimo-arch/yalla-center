'use client';

import React from 'react';
import { Calendar, Clock, MapPin, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { receptionSessionState } from '@/lib/attendance/reception';
import { Session, Group, Branch, Classroom, User } from '@/lib/dal/types';

interface SessionSelectorProps {
  branches: Branch[];
  selectedBranchId: string;
  onSelectBranch: (branchId: string) => void;
  sessions: Session[];
  clock: string;
  groups: Group[];
  classrooms: Classroom[];
  teachers: User[];
  selectedSessionId: string | null;
  onSelectSession: (session: Session, group?: Group) => void;
}

export function SessionSelector({
  branches,
  selectedBranchId,
  onSelectBranch,
  sessions,
  clock,
  groups,
  classrooms,
  teachers,
  selectedSessionId,
  onSelectSession,
}: SessionSelectorProps) {
  return (
    <div className="card-elevated rounded-3xl p-5 border border-border/80 bg-card space-y-4">
      {/* Branch & Date Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/70">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-cyan-500" />
          <span className="text-xs font-bold text-foreground">الحصص الحالية والقادمة</span>
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {new Date().toLocaleDateString('ar-EG', {
              timeZone: 'Africa/Cairo',
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        </div>

        {branches.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">الفرع:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => onSelectBranch(e.target.value)}
              className="h-8 px-2.5 text-xs font-bold rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
            >
              <option value="ALL">جميع الفروع</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Session Pills / Grid */}
      <div className="space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center py-6 text-xs text-muted-foreground">
            لا توجد حصص حالية أو قادمة لهذا الفرع.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {sessions.map((s) => {
              const grp = groups.find((g) => g.id === s.groupId);
              const teacherName = teachers.find(t => t.id === s.teacherId)?.fullName ?? grp?.teacherName;
              const room = classrooms.find((c) => c.id === s.classroomId);
              const isSelected = selectedSessionId === s.id;
              const isLive = receptionSessionState(s, clock) === 'current';

              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => onSelectSession(s, grp)}
                  className={`text-right p-3.5 rounded-2xl border transition-all text-xs space-y-2 cursor-pointer ${
                    isSelected
                      ? 'border-brand-cyan-500 bg-brand-cyan-500/10 shadow-sm ring-1 ring-brand-cyan-500/30'
                      : 'border-border bg-card/60 hover:border-brand-cyan-500/40 hover:bg-muted/30'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-foreground text-sm truncate">
                      {grp ? grp.nameAr : 'حصة دراسية'}
                    </span>
                    {isLive ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span>جارية الآن</span>
                      </span>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        قادمة
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground text-[11px]">
                    {teacherName && <span className="font-medium text-foreground/80">{teacherName}</span>}
                    {room && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-brand-cyan-500" />
                        <span>{room.nameAr}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-brand-cyan-500" />
                      <span>
                        {s.sessionDate} · {s.startTime} - {s.endTime}
                      </span>
                    </span>
                  </div>

                  {isSelected && (
                    <div className="flex items-center gap-1 text-[11px] font-bold text-brand-cyan-600 dark:text-brand-cyan-400 pt-1 border-t border-brand-cyan-500/20">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>الحصة النشطة للاستقبال</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
