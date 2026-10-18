'use client';

import React, { useState, useMemo } from 'react';
import {
  Building2,
  Calendar,
  ShieldAlert,
  Clock,
  Tv,
  Wind,
  Layers,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Users,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  checkGroupScheduleConflicts,
  ScheduleCandidate,
  ConflictCheckResult,
} from '@/lib/timetable/conflict-detector';

const DAYS_OF_WEEK = [
  { index: 6, nameAr: 'السبت' },
  { index: 0, nameAr: 'الأحد' },
  { index: 1, nameAr: 'الإثنين' },
  { index: 2, nameAr: 'الثلاثاء' },
  { index: 3, nameAr: 'الأربعاء' },
  { index: 4, nameAr: 'الخميس' },
  { index: 5, nameAr: 'الجمعة' },
];

export default function BranchesTimetablePage() {
  const { tenant, branches } = useTenant();

  // Active Tab: 'branches' | 'weekly' | 'scheduler' | 'sessions'
  const [activeTab, setActiveTab] = useState<'branches' | 'weekly' | 'scheduler' | 'sessions'>('branches');

  // Demo Classrooms
  const [classrooms] = useState([
    {
      id: 'room-101',
      tenantId: tenant.id,
      branchId: 'branch-nasr-city',
      nameAr: 'قاعة د. زويل (1)',
      capacity: 60,
      equipment: { projector: true, airConditioning: true, smartBoard: true },
    },
    {
      id: 'room-102',
      tenantId: tenant.id,
      branchId: 'branch-nasr-city',
      nameAr: 'قاعة العقاد (2)',
      capacity: 40,
      equipment: { projector: true, airConditioning: true, smartBoard: false },
    },
    {
      id: 'room-201',
      tenantId: tenant.id,
      branchId: 'branch-heliopolis',
      nameAr: 'قاعة الأهرام (مصر الجديدة)',
      capacity: 50,
      equipment: { projector: true, airConditioning: true, smartBoard: true },
    },
  ]);

  // Demo Weekly Groups
  const [groups, setGroups] = useState([
    {
      id: 'grp-1',
      tenantId: tenant.id,
      branchId: 'branch-nasr-city',
      classroomId: 'room-101',
      teacherId: 'user-teacher-math',
      nameAr: 'مجموعة العباقرة — رياضيات 3 ثانوي',
      scheduleDay: 6, // Saturday
      startTime: '14:00',
      endTime: '16:00',
      maxStudents: 50,
      isActive: true,
    },
    {
      id: 'grp-2',
      tenantId: tenant.id,
      branchId: 'branch-nasr-city',
      classroomId: 'room-102',
      teacherId: 'user-teacher-phys',
      nameAr: 'مجموعة النخبة — فيزياء 3 ثانوي',
      scheduleDay: 0, // Sunday
      startTime: '16:00',
      endTime: '18:00',
      maxStudents: 35,
      isActive: true,
    },
    {
      id: 'grp-3',
      tenantId: tenant.id,
      branchId: 'branch-nasr-city',
      classroomId: 'room-101',
      teacherId: 'user-teacher-phys',
      nameAr: 'مجموعة الأوائل — فيزياء السبت',
      scheduleDay: 6, // Saturday
      startTime: '18:00',
      endTime: '20:00',
      maxStudents: 45,
      isActive: true,
    },
  ]);

  // Demo Calendar Sessions
  const [sessions] = useState([
    {
      id: 'sess-1',
      date: '2026-10-24',
      startTime: '14:00',
      endTime: '16:00',
      groupName: 'مجموعة العباقرة — رياضيات',
      roomName: 'قاعة د. زويل (1)',
      teacherName: 'أ. أحمد الشناوي',
      status: 'scheduled' as const,
    },
    {
      id: 'sess-2',
      date: '2026-10-25',
      startTime: '16:00',
      endTime: '18:00',
      groupName: 'مجموعة النخبة — فيزياء',
      roomName: 'قاعة العقاد (2)',
      teacherName: 'د. هاني نبيل',
      status: 'scheduled' as const,
    },
    {
      id: 'sess-3',
      date: '2026-10-26',
      startTime: '14:00',
      endTime: '16:00',
      groupName: 'مجموعة الكيمياء التأسيسية',
      roomName: 'قاعة د. زويل (1)',
      teacherName: 'أ. أحمد الشناوي',
      status: 'canceled' as const, // Canceled: Room is free!
    },
  ]);

  // Maps for conflict detection
  const classroomsMap = useMemo(() => {
    const map = new Map<string, { nameAr: string; capacity: number }>();
    classrooms.forEach((c) => map.set(c.id, { nameAr: c.nameAr, capacity: c.capacity }));
    return map;
  }, [classrooms]);

  const teachersMap = useMemo(() => {
    return new Map<string, { fullName: string }>([
      ['user-teacher-math', { fullName: 'أ. أحمد محمد الشناوي' }],
      ['user-teacher-phys', { fullName: 'د. هاني نبيل' }],
    ]);
  }, []);

  // Conflict Preflight Scheduler State
  const [selectedBranchId, setSelectedBranchId] = useState('branch-nasr-city');
  const [selectedClassroomId, setSelectedClassroomId] = useState('room-101');
  const [selectedTeacherId, setSelectedTeacherId] = useState('user-teacher-math');
  const [selectedDay, setSelectedDay] = useState(6);
  const [startTimeInput, setStartTimeInput] = useState('14:00');
  const [endTimeInput, setEndTimeInput] = useState('16:00');
  const [groupNameInput, setGroupNameInput] = useState('مجموعة جديدة للتجربة');
  const [maxStudentsInput, setMaxStudentsInput] = useState(50);
  const [scheduleSuccessMsg, setScheduleSuccessMsg] = useState<string | null>(null);

  // Live Conflict Evaluation
  const conflictResult: ConflictCheckResult = useMemo(() => {
    const candidate: ScheduleCandidate = {
      tenantId: tenant.id,
      branchId: selectedBranchId,
      classroomId: selectedClassroomId,
      teacherId: selectedTeacherId,
      dayOfWeek: selectedDay,
      startTime: startTimeInput,
      endTime: endTimeInput,
      maxStudents: maxStudentsInput,
    };

    return checkGroupScheduleConflicts(
      candidate,
      groups,
      classroomsMap,
      teachersMap
    );
  }, [
    tenant.id,
    selectedBranchId,
    selectedClassroomId,
    selectedTeacherId,
    selectedDay,
    startTimeInput,
    endTimeInput,
    maxStudentsInput,
    groups,
    classroomsMap,
    teachersMap,
  ]);

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conflictResult.canSchedule) return;

    const newGroup = {
      id: `grp-${Date.now()}`,
      tenantId: tenant.id,
      branchId: selectedBranchId,
      classroomId: selectedClassroomId,
      teacherId: selectedTeacherId,
      nameAr: groupNameInput,
      scheduleDay: selectedDay,
      startTime: startTimeInput,
      endTime: endTimeInput,
      maxStudents: maxStudentsInput,
      isActive: true,
    };

    setGroups([...groups, newGroup]);
    setScheduleSuccessMsg(`تمت جدولة المجموعة "${groupNameInput}" بنجاح في الجدول الأسبوعي دون أي تعارض!`);
    setTimeout(() => setScheduleSuccessMsg(null), 5000);
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <Building2 className="w-7 h-7 text-brand-cyan-600 dark:text-brand-cyan-400" />
            <span>إدارة الفروع والقاعات وجدول المواعيد</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            تنظيم الفروع الميدانية، القاعات وسعاتها، والجدول الأسبوعي مع خوارزمية منع التعارضات.
          </p>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'branches' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('branches')}
          className="gap-1.5"
        >
          <Building2 className="w-4 h-4" />
          <span>الفروع والقاعات</span>
        </Button>
        <Button
          variant={activeTab === 'weekly' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('weekly')}
          className="gap-1.5"
        >
          <Calendar className="w-4 h-4" />
          <span>الجدول الأسبوعي العام</span>
        </Button>
        <Button
          variant={activeTab === 'scheduler' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('scheduler')}
          className="gap-1.5"
        >
          <ShieldAlert className="w-4 h-4" />
          <span>فاحص التعارضات والجدولة الذكية</span>
        </Button>
        <Button
          variant={activeTab === 'sessions' ? 'primary' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('sessions')}
          className="gap-1.5"
        >
          <Clock className="w-4 h-4" />
          <span>الحصص التشغيلية اليومية</span>
        </Button>
      </div>

      {/* Tab 1: Branches and Classrooms */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {branches.map((b) => {
              const branchRooms = classrooms.filter((r) => r.branchId === b.id);
              return (
                <div
                  key={b.id}
                  className="card-elevated p-6 rounded-2xl border border-border space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-brand-cyan-600 dark:text-brand-cyan-400" />
                      <h2 className="text-lg font-bold text-foreground">{b.nameAr}</h2>
                    </div>
                    <Badge variant="success">نشط</Badge>
                  </div>

                  <p className="text-xs text-muted-foreground">{b.address}</p>

                  <div className="pt-2 border-t border-border space-y-3">
                    <span className="text-xs font-bold text-foreground block">
                      القاعات التابعة للفرع ({branchRooms.length} قاعات):
                    </span>
                    <div className="space-y-2">
                      {branchRooms.map((room) => (
                        <div
                          key={room.id}
                          className="p-3 rounded-xl bg-background border border-border flex items-center justify-between gap-3"
                        >
                          <div>
                            <span className="text-sm font-bold text-foreground block">
                              {room.nameAr}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              السعة: <strong className="font-mono text-brand-cyan-600">{room.capacity}</strong> مقعد
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted-foreground">
                            {room.equipment.airConditioning && (
                              <span title="مكيفة" className="p-1 rounded bg-muted text-xs">
                                <Wind className="w-3.5 h-3.5 text-blue-500" />
                              </span>
                            )}
                            {room.equipment.projector && (
                              <span title="شاشة عرض / داتاشو" className="p-1 rounded bg-muted text-xs">
                                <Tv className="w-3.5 h-3.5 text-brand-cyan-500" />
                              </span>
                            )}
                            {room.equipment.smartBoard && (
                              <span title="سبورة ذكية" className="p-1 rounded bg-muted text-xs">
                                <Layers className="w-3.5 h-3.5 text-purple-500" />
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Weekly Timetable Matrix */}
      {activeTab === 'weekly' && (
        <div className="card-elevated p-6 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-5 h-5 text-brand-cyan-600" />
              <span>مصفوفة الجدول الأسبوعي للمجموعات</span>
            </h2>
            <Badge variant="navy">عرض الفترات الأسبوعية</Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="p-3 font-bold">اليوم</th>
                  <th className="p-3 font-bold">المجموعة الدراسية</th>
                  <th className="p-3 font-bold">التوقيت</th>
                  <th className="p-3 font-bold">القاعة</th>
                  <th className="p-3 font-bold">المعلم</th>
                  <th className="p-3 font-bold">الفرع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {groups.map((g) => {
                  const dayName = DAYS_OF_WEEK.find((d) => d.index === g.scheduleDay)?.nameAr || '';
                  const room = classroomsMap.get(g.classroomId)?.nameAr || g.classroomId;
                  const teacher = teachersMap.get(g.teacherId)?.fullName || g.teacherId;
                  const branch = branches.find((b) => b.id === g.branchId)?.nameAr || g.branchId;

                  return (
                    <tr key={g.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-bold text-brand-cyan-600 dark:text-brand-cyan-400">
                        {dayName}
                      </td>
                      <td className="p-3 font-bold text-foreground">{g.nameAr}</td>
                      <td className="p-3 font-mono dir-ltr text-right">
                        {g.startTime} - {g.endTime}
                      </td>
                      <td className="p-3 font-medium text-foreground">{room}</td>
                      <td className="p-3 text-muted-foreground">{teacher}</td>
                      <td className="p-3 text-muted-foreground">{branch}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Conflict Prevention & Smart Scheduler */}
      {activeTab === 'scheduler' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Interactive Schedule Form */}
          <div className="lg:col-span-2 card-elevated p-6 rounded-2xl border border-border space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-brand-cyan-600" />
                <span>جدولة مجموعة جديدة وفحص التعارض الفوري</span>
              </h2>
              <Badge variant="cyan">فحص مباشر (Preflight HUD)</Badge>
            </div>

            {scheduleSuccessMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-sm font-semibold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>{scheduleSuccessMsg}</span>
              </div>
            )}

            <form onSubmit={handleSaveGroup} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  اسم المجموعة الدراسية
                </label>
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    الفرع
                  </label>
                  <select
                    value={selectedBranchId}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    القاعة
                  </label>
                  <select
                    value={selectedClassroomId}
                    onChange={(e) => setSelectedClassroomId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  >
                    {classrooms.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr} (سعة: {c.capacity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    المعلم
                  </label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  >
                    <option value="user-teacher-math">أ. أحمد محمد الشناوي (رياضيات)</option>
                    <option value="user-teacher-phys">د. هاني نبيل (فيزياء)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    يوم الحصة الأسبوعي
                  </label>
                  <select
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  >
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d.index} value={d.index}>
                        {d.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    وقت البدء (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={startTimeInput}
                    onChange={(e) => setStartTimeInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">
                    وقت النهاية (HH:mm)
                  </label>
                  <input
                    type="time"
                    value={endTimeInput}
                    onChange={(e) => setEndTimeInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none font-mono"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">
                  الحد الأقصى للطلاب
                </label>
                <input
                  type="number"
                  value={maxStudentsInput}
                  onChange={(e) => setMaxStudentsInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none font-mono"
                  min={1}
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={!conflictResult.canSchedule}
                  className="w-full sm:w-auto text-sm px-6 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>تأكيد وحفظ الجدولة</span>
                </Button>
              </div>
            </form>
          </div>

          {/* Right Col: Live Preflight HUD */}
          <div className="space-y-4">
            <div className="card-elevated p-6 rounded-2xl border border-border space-y-4">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-brand-cyan-600" />
                <span>رادار فحص التعارض الفوري</span>
              </h3>

              {conflictResult.hasConflict ? (
                <div className="p-4 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs sm:text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />
                    <span>تم رصد تعارض زمني حاسم!</span>
                  </div>
                  {conflictResult.errors.map((err, idx) => (
                    <p key={idx} className="leading-relaxed pr-6">
                      {err.messageAr}
                    </p>
                  ))}
                  <div className="text-[11px] text-muted-foreground pt-1 border-t border-rose-500/20">
                    تم تعطيل زر الحفظ لمنع ازدواجية حجز القاعة أو المعلم.
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
                    <span>الموعد متاح بدون تعارض</span>
                  </div>
                  <p className="leading-relaxed pr-6 text-xs">
                    القاعة والمعلم متاحان في هذا التوقيت ({startTimeInput} - {endTimeInput}).
                  </p>
                </div>
              )}

              {conflictResult.warnings.length > 0 && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-xs space-y-1">
                  {conflictResult.warnings.map((w, idx) => (
                    <p key={idx}>{w.messageAr}</p>
                  ))}
                </div>
              )}

              <div className="pt-2 border-t border-border space-y-2 text-xs text-muted-foreground">
                <strong className="block text-foreground font-semibold">
                  قواعد الجدولة المعتمدة:
                </strong>
                <ul className="list-disc list-inside space-y-1">
                  <li>الحصص المتتالية فوراً (14:00 - 16:00 ثم 16:00 - 18:00) مسموحة بدون فجوة.</li>
                  <li>يُمنع المعلم من تدريس مجموعتين متزامنتين في أي قاعة أو فرع.</li>
                  <li>الحصص الملغاة لا تعطل حجز القاعة أو المعلم.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Daily Operational Sessions */}
      {activeTab === 'sessions' && (
        <div className="card-elevated p-6 rounded-2xl border border-border space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-brand-cyan-600" />
              <span>الحصص التشغيلية المؤرخة (Operational Calendar)</span>
            </h2>
            <Badge variant="cyan">جلسات التقويم</Badge>
          </div>

          <div className="space-y-3">
            {sessions.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-muted border border-border flex flex-col items-center justify-center font-mono shrink-0">
                    <span className="text-xs font-bold text-foreground">{s.startTime}</span>
                    <span className="text-[10px] text-muted-foreground">{s.endTime}</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{s.groupName}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      التاريخ: <span className="font-mono">{s.date}</span> | {s.roomName} — {s.teacherName}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant={s.status === 'canceled' ? 'destructive' : 'success'}>
                    {s.status === 'canceled' ? 'حصة ملغاة (القاعة متاحة)' : 'مجدولة ومؤكدة'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
