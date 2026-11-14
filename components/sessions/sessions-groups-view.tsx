'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  Plus,
  Trash2,
  Edit2,
  Calendar,
  Clock,
  Printer,
  FileSpreadsheet,
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  Layers,
  Sparkles,
  DollarSign,
  Percent,
  Calculator,
  ChevronDown,
  Building,
  School,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDataProvider } from '@/lib/dal/factory';
import type {
  Group,
  GroupInput,
  Subject,
  Classroom,
  Branch,
  EducationalStage,
  User,
  WeeklyScheduleSlot,
  PricingModel,
} from '@/lib/dal/types';
import { checkGroupScheduleConflicts, type ScheduleCandidate } from '@/lib/timetable/conflict-detector';

export const DAYS_OF_WEEK = [
  { day: 6, nameAr: 'السبت' },
  { day: 0, nameAr: 'الأحد' },
  { day: 1, nameAr: 'الإثنين' },
  { day: 2, nameAr: 'الثلاثاء' },
  { day: 3, nameAr: 'الأربعاء' },
  { day: 4, nameAr: 'الخميس' },
  { day: 5, nameAr: 'الجمعة' },
];

export interface SessionsGroupsViewProps {
  initialTeacherId?: string;
  lockTeacherFilter?: boolean;
  allowGroupManagement?: boolean;
  isEmbedded?: boolean;
  title?: string;
  subtitle?: string;
}

export function SessionsGroupsView({
  initialTeacherId,
  lockTeacherFilter = false,
  allowGroupManagement = true,
  isEmbedded = false,
  title,
  subtitle,
}: SessionsGroupsViewProps) {
  const { tenant } = useTenant();

  // Data States
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [stages, setStages] = useState<EducationalStage[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);

  // View Mode: 'groups' | 'timetable'
  const [viewMode, setViewMode] = useState<'groups' | 'timetable'>(initialTeacherId ? 'groups' : 'timetable');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStageFilter, setSelectedStageFilter] = useState('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState(initialTeacherId || '');
  const [selectedModelFilter, setSelectedModelFilter] = useState('');
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | 'all'>('all');

  // Sync initialTeacherId if changed
  useEffect(() => {
    if (initialTeacherId) {
      setSelectedTeacherFilter(initialTeacherId);
    }
  }, [initialTeacherId]);

  // Toast
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modal State (Used only if allowGroupManagement is true)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Form Fields
  const [formData, setFormData] = useState({
    nameAr: '',
    stage: '',
    grade: '',
    subjectId: '',
    teacherId: initialTeacherId || '',
    branchId: '',
    maxStudents: 35,
    pricingModel: 'average_monthly' as PricingModel,
    teacherRatePerStudent: 20,
    monthlyFee: 150,
    teacherPercentage: 70,
    centerPercentage: 30,
    sessionFee: 60,
    teacherSessionAmount: 40,
    centerSessionAmount: 20,
    weeklySchedules: [
      {
        dayOfWeek: 6,
        startTime: '14:00',
        endTime: '16:00',
        classroomId: '',
      },
    ] as WeeklyScheduleSlot[],
  });

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<Group | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Load Data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const dal = getDataProvider();
      const tenantId = tenant.id || 'tenant-maher-001';

      const [grps, subs, tchrs, stgs, brnchs, rms] = await Promise.all([
        dal.getGroups(tenantId),
        dal.getSubjects(tenantId),
        dal.getUsers(tenantId, { role: 'TEACHER' }),
        dal.getStages(tenantId),
        dal.getBranches(tenantId),
        dal.getClassrooms(tenantId),
      ]);

      setGroups(grps || []);
      setSubjects(subs || []);
      setTeachers(tchrs || []);
      setStages(stgs || []);
      setBranches(brnchs || []);
      setClassrooms(rms || []);
    } catch {
      showToast('error', 'تعذر تحميل بيانات المجموعات والحصص');
    } finally {
      setLoading(false);
    }
  }, [tenant.id, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Derived grades from selected stage in form
  const availableGrades = useMemo(() => {
    if (!formData.stage) return [];
    const stageObj = stages.find((s) => s.id === formData.stage || s.nameAr === formData.stage);
    return stageObj?.grades || [];
  }, [stages, formData.stage]);

  // Derived subjects from selected stage & grade in form
  const availableSubjects = useMemo(() => {
    if (!formData.stage || !formData.grade) return subjects;
    return subjects.filter(
      (s) =>
        (s.stage === formData.stage || s.stage === stages.find((st) => st.id === formData.stage)?.nameAr) &&
        (s.grade === formData.grade || s.grade === availableGrades.find((g) => g.id === formData.grade)?.nameAr)
    );
  }, [subjects, formData.stage, formData.grade, stages, availableGrades]);

  // Available classrooms filtered by selected branch
  const availableClassrooms = useMemo(() => {
    if (!formData.branchId) return classrooms;
    return classrooms.filter((r) => r.branchId === formData.branchId);
  }, [classrooms, formData.branchId]);

  // Conflict Checking on form changes
  useEffect(() => {
    if (!allowGroupManagement || !formData.teacherId || formData.weeklySchedules.length === 0) {
      setConflictWarning(null);
      return;
    }

    const classroomsMap = new Map(classrooms.map((c) => [c.id, { nameAr: c.nameAr, capacity: c.capacity }]));
    const teachersMap = new Map(teachers.map((t) => [t.id, { fullName: t.fullName }]));

    const candidate: ScheduleCandidate = {
      id: editingGroup?.id,
      tenantId: tenant.id || 'tenant-maher-001',
      branchId: formData.branchId,
      classroomId: formData.weeklySchedules[0]?.classroomId || '',
      teacherId: formData.teacherId,
      startTime: formData.weeklySchedules[0]?.startTime || '14:00',
      endTime: formData.weeklySchedules[0]?.endTime || '16:00',
      maxStudents: formData.maxStudents,
      weeklySchedules: formData.weeklySchedules.filter((s) => Boolean(s.classroomId)),
    };

    const conflictResult = checkGroupScheduleConflicts(
      candidate,
      groups.map((g) => ({
        id: g.id,
        tenantId: g.tenantId,
        branchId: g.branchId,
        classroomId: g.classroomId,
        teacherId: g.teacherId,
        nameAr: g.nameAr,
        scheduleDay: g.scheduleDay,
        startTime: g.startTime,
        endTime: g.endTime,
        isActive: g.isActive,
        weeklySchedules: g.weeklySchedules,
      })),
      classroomsMap,
      teachersMap
    );

    if (conflictResult.errors.length > 0) {
      setConflictWarning(conflictResult.errors[0].messageAr);
    } else if (conflictResult.warnings.length > 0) {
      setConflictWarning(conflictResult.warnings[0].messageAr);
    } else {
      setConflictWarning(null);
    }
  }, [
    allowGroupManagement,
    formData.teacherId,
    formData.branchId,
    formData.weeklySchedules,
    formData.maxStudents,
    editingGroup?.id,
    tenant.id,
    classrooms,
    teachers,
    groups,
  ]);

  // Open Modal for New Group
  const handleOpenAddModal = () => {
    if (!allowGroupManagement) return;
    setEditingGroup(null);
    const defaultBranchId = branches[0]?.id || '';
    const defaultStage = stages[0]?.id || stages[0]?.nameAr || '';
    const defaultGrade = stages[0]?.grades[0]?.id || stages[0]?.grades[0]?.nameAr || '';
    const defaultClassroomId = classrooms.find((c) => c.branchId === defaultBranchId)?.id || classrooms[0]?.id || '';

    setFormData({
      nameAr: '',
      stage: defaultStage,
      grade: defaultGrade,
      subjectId: subjects[0]?.id || '',
      teacherId: selectedTeacherFilter || teachers[0]?.id || '',
      branchId: defaultBranchId,
      maxStudents: 35,
      pricingModel: 'average_monthly',
      teacherRatePerStudent: 20,
      monthlyFee: 150,
      teacherPercentage: 70,
      centerPercentage: 30,
      sessionFee: 60,
      teacherSessionAmount: 40,
      centerSessionAmount: 20,
      weeklySchedules: [
        {
          dayOfWeek: 6,
          startTime: '14:00',
          endTime: '16:00',
          classroomId: defaultClassroomId,
        },
      ],
    });
    setFormError('');
    setConflictWarning(null);
    setIsModalOpen(true);
  };

  // Open Modal for Edit Group
  const handleOpenEditModal = (group: Group) => {
    if (!allowGroupManagement) return;
    setEditingGroup(group);
    const schedules =
      group.weeklySchedules && group.weeklySchedules.length > 0
        ? group.weeklySchedules
        : [
            {
              dayOfWeek: group.scheduleDay ?? 6,
              startTime: group.startTime || '14:00',
              endTime: group.endTime || '16:00',
              classroomId: group.classroomId,
            },
          ];

    setFormData({
      nameAr: group.nameAr,
      stage: group.stage || stages[0]?.id || '',
      grade: group.grade || stages[0]?.grades[0]?.id || '',
      subjectId: group.subjectId,
      teacherId: group.teacherId,
      branchId: group.branchId,
      maxStudents: group.maxStudents || 35,
      pricingModel: group.pricingModel || 'average_monthly',
      teacherRatePerStudent: group.teacherRatePerStudent ?? 20,
      monthlyFee: group.monthlyFee || 150,
      teacherPercentage: group.teacherPercentage ?? 70,
      centerPercentage: group.centerPercentage ?? 30,
      sessionFee: group.sessionFee || 60,
      teacherSessionAmount: group.teacherSessionAmount ?? 40,
      centerSessionAmount: group.centerSessionAmount ?? 20,
      weeklySchedules: schedules,
    });
    setFormError('');
    setConflictWarning(null);
    setIsModalOpen(true);
  };

  // Schedule Slot Management
  const handleAddScheduleSlot = () => {
    const defaultRoom = availableClassrooms[0]?.id || classrooms[0]?.id || '';
    setFormData((prev) => ({
      ...prev,
      weeklySchedules: [
        ...prev.weeklySchedules,
        {
          dayOfWeek: (prev.weeklySchedules[prev.weeklySchedules.length - 1]?.dayOfWeek + 2) % 7,
          startTime: '16:00',
          endTime: '18:00',
          classroomId: defaultRoom,
        },
      ],
    }));
  };

  const handleRemoveScheduleSlot = (index: number) => {
    if (formData.weeklySchedules.length <= 1) return;
    setFormData((prev) => ({
      ...prev,
      weeklySchedules: prev.weeklySchedules.filter((_, idx) => idx !== index),
    }));
  };

  const handleUpdateScheduleSlot = (index: number, updates: Partial<WeeklyScheduleSlot>) => {
    setFormData((prev) => {
      const next = [...prev.weeklySchedules];
      next[index] = { ...next[index], ...updates };
      return { ...prev, weeklySchedules: next };
    });
  };

  // Save Group
  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.nameAr.trim()) {
      setFormError('اسم المجموعة مطلوب');
      return;
    }
    if (!formData.stage) {
      setFormError('المرحلة التعليمية مطلوبة');
      return;
    }
    if (!formData.grade) {
      setFormError('الصف الدراسي مطلوب');
      return;
    }
    if (!formData.subjectId) {
      setFormError('المادة الدراسية مطلوبة');
      return;
    }
    if (!formData.teacherId) {
      setFormError('المعلم مطلوب');
      return;
    }
    if (!formData.branchId) {
      setFormError('الفرع مطلوب');
      return;
    }
    if (formData.weeklySchedules.length === 0) {
      setFormError('يجب تحديد موعد حصة واحدة على الأقل في الأسبوع');
      return;
    }
    for (const slot of formData.weeklySchedules) {
      if (!slot.classroomId) {
        setFormError('يرجى تحديد القاعة لجميع حصص المجموعة');
        return;
      }
    }

    try {
      setIsSaving(true);
      const dal = getDataProvider();
      const tenantId = tenant.id || 'tenant-maher-001';

      const input: GroupInput = {
        id: editingGroup?.id,
        nameAr: formData.nameAr.trim(),
        stage: formData.stage,
        grade: formData.grade,
        subjectId: formData.subjectId,
        teacherId: formData.teacherId,
        branchId: formData.branchId,
        classroomId: formData.weeklySchedules[0]?.classroomId,
        pricingModel: formData.pricingModel,
        monthlyFee: Number(formData.monthlyFee) || 0,
        sessionFee:
          formData.pricingModel === 'per_session_fixed' || formData.pricingModel === 'fixed_session'
            ? (Number(formData.teacherSessionAmount) || 0) + (Number(formData.centerSessionAmount) || 0)
            : Number(formData.sessionFee) || 0,
        teacherRatePerStudent: Number(formData.teacherRatePerStudent) || 0,
        teacherPercentage: Number(formData.teacherPercentage) || 0,
        centerPercentage: 100 - (Number(formData.teacherPercentage) || 0),
        teacherSessionAmount: Number(formData.teacherSessionAmount) || 0,
        centerSessionAmount: Number(formData.centerSessionAmount) || 0,
        maxStudents: Number(formData.maxStudents) || 35,
        weeklySchedules: formData.weeklySchedules,
      };

      await dal.saveGroup(tenantId, input);
      showToast('success', editingGroup ? 'تم تحديث بيانات المجموعة بنجاح' : 'تم إضافة المجموعة وتوليد جدول حصصها بنجاح');
      setIsModalOpen(false);
      await loadData();
    } catch (err: any) {
      setFormError(err.message || 'تعذر حفظ المجموعة');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete Group
  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      setIsDeleting(true);
      const dal = getDataProvider();
      const tenantId = tenant.id || 'tenant-maher-001';
      const res = await dal.deleteGroup(tenantId, deleteTarget.id);
      if (res.success) {
        showToast('success', 'تم حذف المجموعة والحصص المجدولة التابعة لها بنجاح');
        setDeleteTarget(null);
        await loadData();
      } else {
        showToast('error', res.error || 'تعذر حذف المجموعة');
      }
    } catch {
      showToast('error', 'تعذر حذف المجموعة');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return groups.filter((g) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const subject = subjects.find((s) => s.id === g.subjectId);
        const teacher = teachers.find((t) => t.id === g.teacherId);
        const matchName = g.nameAr.toLowerCase().includes(query);
        const matchSubject = subject?.nameAr.toLowerCase().includes(query);
        const matchTeacher = teacher?.fullName.toLowerCase().includes(query);
        if (!matchName && !matchSubject && !matchTeacher) return false;
      }
      if (selectedStageFilter && g.stage !== selectedStageFilter) return false;
      if (selectedTeacherFilter && g.teacherId !== selectedTeacherFilter) return false;
      if (selectedModelFilter && g.pricingModel !== selectedModelFilter) return false;
      if (selectedDayFilter !== 'all') {
        const hasDay =
          g.weeklySchedules && g.weeklySchedules.length > 0
            ? g.weeklySchedules.some((s) => s.dayOfWeek === selectedDayFilter)
            : g.scheduleDay === selectedDayFilter;
        if (!hasDay) return false;
      }
      return true;
    });
  }, [
    groups,
    searchQuery,
    selectedStageFilter,
    selectedTeacherFilter,
    selectedModelFilter,
    selectedDayFilter,
    subjects,
    teachers,
  ]);

  // Flattened Timetable Items
  const timetableSessions = useMemo(() => {
    const items: Array<{
      id: string;
      group: Group;
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      classroomId: string;
      classroomName: string;
      branchName: string;
      subjectName: string;
      teacherName: string;
      teacherAvatar?: string;
    }> = [];

    for (const group of filteredGroups) {
      const subject = subjects.find((s) => s.id === group.subjectId);
      const teacher = teachers.find((t) => t.id === group.teacherId);
      const branch = branches.find((b) => b.id === group.branchId);

      const slots =
        group.weeklySchedules && group.weeklySchedules.length > 0
          ? group.weeklySchedules
          : [
              {
                id: `slot-fallback-${group.id}`,
                dayOfWeek: group.scheduleDay ?? 6,
                startTime: group.startTime || '14:00',
                endTime: group.endTime || '16:00',
                classroomId: group.classroomId,
              },
            ];

      for (const slot of slots) {
        const room = classrooms.find((c) => c.id === slot.classroomId);
        items.push({
          id: `${group.id}-${slot.dayOfWeek}-${slot.startTime}`,
          group,
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          classroomId: slot.classroomId,
          classroomName: room?.nameAr || 'قاعة تدريس',
          branchName: branch?.nameAr || '',
          subjectName: subject?.nameAr || 'المادة الدراسية',
          teacherName: teacher?.fullName || 'المعلم',
          teacherAvatar: teacher?.avatarUrl,
        });
      }
    }

    return items.sort((a, b) => {
      if (a.dayOfWeek !== b.dayOfWeek) {
        const dayOrderA = (a.dayOfWeek + 1) % 7;
        const dayOrderB = (b.dayOfWeek + 1) % 7;
        return dayOrderA - dayOrderB;
      }
      return a.startTime.localeCompare(b.startTime);
    });
  }, [filteredGroups, subjects, teachers, branches, classrooms]);

  // Export Timetable to Excel (CSV with UTF-8 BOM)
  const handleExportExcel = () => {
    const headers = [
      'اليوم',
      'وقت البدء',
      'وقت الانتهاء',
      'المادة الدراسية',
      'المرحلة التعليمية',
      'الصف الدراسي',
      'المجموعة',
      'المعلم',
      'القاعة',
      'الفرع',
      'نظام الحساب',
      'تفاصيل التسعير',
    ];

    const rows = timetableSessions.map((item) => {
      const dayName = DAYS_OF_WEEK.find((d) => d.day === item.dayOfWeek)?.nameAr || '';
      let pricingDesc = '';
      let modelLabel = '';

      if (item.group.pricingModel === 'average_monthly' || item.group.pricingModel === 'center') {
        modelLabel = 'نظام المتوسط';
        pricingDesc = `${item.group.teacherRatePerStudent ?? 20} ج.م/طالب للمدرس · مصاريف الطالب: ${item.group.monthlyFee} ج.م`;
      } else if (item.group.pricingModel === 'private' || item.group.pricingModel === 'private_percentage') {
        modelLabel = 'نظام البرايفت';
        pricingDesc = `نسبة المدرس: ${item.group.teacherPercentage ?? 70}% · نسبة السنتر: ${item.group.centerPercentage ?? 30}% · مصاريف: ${item.group.monthlyFee} ج.م`;
      } else {
        modelLabel = 'دفع بالحصة';
        pricingDesc = `سعر الحصة: ${item.group.sessionFee} ج.م (${item.group.teacherSessionAmount ?? 40} مدرس + ${item.group.centerSessionAmount ?? 20} سنتر)`;
      }

      return [
        `"${dayName}"`,
        `"${item.startTime}"`,
        `"${item.endTime}"`,
        `"${(item.subjectName || '').replace(/"/g, '""')}"`,
        `"${(item.group.stage || '').replace(/"/g, '""')}"`,
        `"${(item.group.grade || '').replace(/"/g, '""')}"`,
        `"${(item.group.nameAr || '').replace(/"/g, '""')}"`,
        `"${(item.teacherName || '').replace(/"/g, '""')}"`,
        `"${(item.classroomName || '').replace(/"/g, '""')}"`,
        `"${(item.branchName || '').replace(/"/g, '""')}"`,
        `"${modelLabel}"`,
        `"${pricingDesc.replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `جدول_حصص_السنتر_${tenant.slug}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('success', 'تم تصدير الجدول إلى إكسيل بنجاح');
  };

  // Print / Save to PDF
  const handlePrint = () => {
    window.print();
  };

  const selectedTeacherObj = teachers.find((t) => t.id === selectedTeacherFilter);

  return (
    <div className={`space-y-6 ${isEmbedded ? 'text-xs' : ''}`} dir="rtl">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white shadow-emerald-600/20'
              : 'bg-red-600 text-white shadow-red-600/20'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Printable Sheet Header (Visible Only on Print) */}
      <div className="hidden print:block mb-6 border-b-2 border-neutral-800 pb-4 text-center">
        <h1 className="text-2xl font-black text-neutral-900">{tenant.nameAr || 'سنتر يلا التعليمي'}</h1>
        <h2 className="text-lg font-bold text-neutral-700 mt-1">جدول الحصص والمجموعات الأسبوعي المعتمد</h2>
        {selectedTeacherObj && (
          <p className="text-sm font-bold text-neutral-800 mt-1">المعلم: {selectedTeacherObj.fullName}</p>
        )}
        <div className="flex justify-between text-xs text-neutral-600 mt-2 px-4">
          <span>تاريخ الطباعة: {new Date().toLocaleDateString('ar-EG')}</span>
          <span>إجمالي الحصص المجدولة: {timetableSessions.length} حصة</span>
        </div>
      </div>

      {/* Screen Header */}
      {!isEmbedded && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border no-print">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
              <CalendarClock className="w-7 h-7 text-brand-cyan-600" />
              <span>{title || 'الحصص والمجموعات الميدانية'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {subtitle || 'إدارة المجموعات، الجداول الدراسية الأسبوعية متعددة الحصص، وأنظمة الحسابات الثلاثة.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Toggle Views */}
            <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
              <button
                type="button"
                onClick={() => setViewMode('timetable')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'timetable'
                    ? 'bg-brand-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>عرض الجدول</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('groups')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  viewMode === 'groups'
                    ? 'bg-brand-cyan-600 text-white shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>قائمة المجموعات ({filteredGroups.length})</span>
              </button>
            </div>

            {/* Export to Excel */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 text-xs font-bold border-border hover:bg-muted/50"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span className="hidden sm:inline">تصدير إكسيل</span>
            </Button>

            {/* Print / PDF */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="flex items-center gap-1.5 text-xs font-bold border-border hover:bg-muted/50"
            >
              <Printer className="w-4 h-4 text-blue-600" />
              <span className="hidden sm:inline">طباعة / PDF</span>
            </Button>

            {/* Add Group Button (Only if allowed) */}
            {allowGroupManagement ? (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenAddModal}
                className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white font-bold flex items-center gap-1.5 shadow-md shadow-brand-cyan-600/20"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مجموعة</span>
              </Button>
            ) : (
              <Link
                href={`/center/${tenant.slug}/sessions`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-cyan-600/10 text-brand-cyan-700 dark:text-brand-cyan-400 hover:bg-brand-cyan-600/20 text-xs font-bold transition-all border border-brand-cyan-500/30"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>إدارة المجموعات في تبويب الحصص</span>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Embedded Controls Header if Embedded */}
      {isEmbedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border no-print">
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border">
            <button
              type="button"
              onClick={() => setViewMode('groups')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'groups'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>المجموعات ({filteredGroups.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('timetable')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'timetable'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>الجدول</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="text-xs font-bold border-border"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 ml-1" />
              <span>إكسيل</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs font-bold border-border"
            >
              <Printer className="w-3.5 h-3.5 text-blue-600 ml-1" />
              <span>طباعة</span>
            </Button>
          </div>
        </div>
      )}

      {/* Filters Bar (Screen Only) */}
      <div className="card-elevated p-4 rounded-2xl border border-border flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between no-print">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="البحث باسم المجموعة، المادة الدراسية، أو اسم المعلم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20 focus:border-brand-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Filter */}
          <select
            value={selectedStageFilter}
            onChange={(e) => setSelectedStageFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
          >
            <option value="">جميع المراحل</option>
            {stages.map((st) => (
              <option key={st.id} value={st.id}>
                {st.nameAr}
              </option>
            ))}
          </select>

          {/* Teacher Filter */}
          {!lockTeacherFilter && (
            <select
              value={selectedTeacherFilter}
              onChange={(e) => setSelectedTeacherFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
            >
              <option value="">جميع المعلمين</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                </option>
              ))}
            </select>
          )}

          {/* Pricing Model Filter */}
          <select
            value={selectedModelFilter}
            onChange={(e) => setSelectedModelFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
          >
            <option value="">جميع طرق الحساب</option>
            <option value="average_monthly">نظام المتوسط</option>
            <option value="private">نظام البرايفت (النسبة)</option>
            <option value="per_session_fixed">نظام الدفع بالحصة</option>
          </select>

          {/* Day Filter */}
          <select
            value={selectedDayFilter}
            onChange={(e) => setSelectedDayFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500/20"
          >
            <option value="all">كل الأيام</option>
            {DAYS_OF_WEEK.map((d) => (
              <option key={d.day} value={d.day}>
                {d.nameAr}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div className="card-elevated p-12 text-center text-muted-foreground rounded-2xl border border-border">
          <div className="animate-spin w-8 h-8 border-4 border-brand-cyan-600 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-sm font-semibold">جاري تحميل بيانات المجموعات وجدول الحصص...</p>
        </div>
      ) : viewMode === 'timetable' ? (
        /* TIMETABLE VIEW (عرض الجدول) */
        <div className="space-y-4">
          {/* Quick Day Chips on Screen */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
            <button
              type="button"
              onClick={() => setSelectedDayFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                selectedDayFilter === 'all'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted'
              }`}
            >
              عرض كامل الأسبوع
            </button>
            {DAYS_OF_WEEK.map((d) => {
              const count = timetableSessions.filter((s) => s.dayOfWeek === d.day).length;
              return (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => setSelectedDayFilter(d.day)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                    selectedDayFilter === d.day
                      ? 'bg-brand-cyan-600 text-white shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span>{d.nameAr}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10">{count}</span>
                </button>
              );
            })}
          </div>

          {/* Timetable Weekly Columns Matrix (Screen & Print Friendly) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-3">
            {DAYS_OF_WEEK.filter((d) => selectedDayFilter === 'all' || selectedDayFilter === d.day).map((dayObj) => {
              const daySessions = timetableSessions.filter((s) => s.dayOfWeek === dayObj.day);

              return (
                <div
                  key={dayObj.day}
                  className="card-elevated rounded-2xl border border-border overflow-hidden flex flex-col print:border-neutral-300 print:break-inside-avoid"
                >
                  {/* Day Header */}
                  <div className="bg-muted/60 p-3 border-b border-border flex items-center justify-between print:bg-neutral-100">
                    <span className="font-black text-sm text-foreground">{dayObj.nameAr}</span>
                    <Badge variant="outline" className="text-[11px] font-bold">
                      {daySessions.length} حصة
                    </Badge>
                  </div>

                  {/* Day Sessions List */}
                  <div className="p-2 space-y-2 flex-1 min-h-[160px]">
                    {daySessions.length === 0 ? (
                      <div className="h-full flex items-center justify-center p-4 text-center">
                        <span className="text-xs text-muted-foreground/60">لا توجد حصص</span>
                      </div>
                    ) : (
                      daySessions.map((session) => (
                        <div
                          key={session.id}
                          className="p-2.5 rounded-xl border border-border/80 bg-card/60 hover:bg-card hover:border-brand-cyan-500/50 transition-all text-xs space-y-1.5 shadow-sm print:border-neutral-400 print:bg-white"
                        >
                          {/* Time & Badge */}
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="font-black text-brand-cyan-700 dark:text-brand-cyan-400 flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3" />
                              {session.startTime} - {session.endTime}
                            </span>
                            {session.group.pricingModel === 'average_monthly' || session.group.pricingModel === 'center' ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold">
                                متوسط
                              </span>
                            ) : session.group.pricingModel === 'private' || session.group.pricingModel === 'private_percentage' ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 font-bold">
                                برايفت
                              </span>
                            ) : (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 font-bold">
                                بالحصة
                              </span>
                            )}
                          </div>

                          {/* Subject & Group */}
                          <div>
                            <div className="font-black text-foreground truncate">{session.subjectName}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{session.group.nameAr}</div>
                          </div>

                          {/* Teacher Name */}
                          <div className="flex items-center gap-1 text-[11px] text-foreground font-semibold">
                            <span className="text-muted-foreground">👤</span>
                            <span className="truncate">{session.teacherName}</span>
                          </div>

                          {/* Classroom Assigned Badge */}
                          <div className="pt-1 border-t border-border/50 flex items-center justify-between text-[10px]">
                            <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold flex items-center gap-1 truncate">
                              <Building className="w-3 h-3 shrink-0" />
                              {session.classroomName}
                            </span>
                            {session.branchName && (
                              <span className="text-muted-foreground truncate">{session.branchName}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* GROUPS LIST VIEW (قائمة المجموعات) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredGroups.length === 0 ? (
            <div className="col-span-full card-elevated p-12 text-center text-muted-foreground rounded-2xl border border-border">
              <CalendarClock className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-base font-bold text-foreground">لا توجد مجموعات تطابق البحث</p>
              <p className="text-xs text-muted-foreground mt-1">
                {allowGroupManagement
                  ? 'يمكنك إضافة مجموعة جديدة وتحديد مواعيد حصصها وطريقة حسابها.'
                  : 'لا توجد مجموعات مسندة لهذا المعلم تطابق الفلتر الحالي.'}
              </p>
              {allowGroupManagement && (
                <Button onClick={handleOpenAddModal} size="sm" className="mt-4 bg-brand-cyan-600 text-white">
                  <Plus className="w-4 h-4 ml-1" /> إضافة مجموعة جديدة
                </Button>
              )}
            </div>
          ) : (
            filteredGroups.map((group) => {
              const subject = subjects.find((s) => s.id === group.subjectId);
              const teacher = teachers.find((t) => t.id === group.teacherId);
              const branch = branches.find((b) => b.id === group.branchId);

              const schedules =
                group.weeklySchedules && group.weeklySchedules.length > 0
                  ? group.weeklySchedules
                  : [
                      {
                        dayOfWeek: group.scheduleDay ?? 6,
                        startTime: group.startTime,
                        endTime: group.endTime,
                        classroomId: group.classroomId,
                      },
                    ];

              return (
                <div
                  key={group.id}
                  className="card-elevated rounded-2xl border border-border p-4 flex flex-col justify-between hover:border-brand-cyan-500/40 transition-all space-y-4"
                >
                  <div className="space-y-3">
                    {/* Top Row: Subject & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold text-brand-cyan-700 dark:text-brand-cyan-400 bg-brand-cyan-500/10 px-2 py-0.5 rounded-md">
                          {subject?.nameAr || 'المادة الدراسية'}
                        </span>
                        <h3 className="font-black text-base text-foreground mt-1.5 leading-snug">{group.nameAr}</h3>
                      </div>

                      {allowGroupManagement && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenEditModal(group)}
                            className="h-8 w-8 text-muted-foreground hover:text-brand-cyan-600"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteTarget(group)}
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Teacher & Branch */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                      <div className="flex items-center gap-1 font-semibold text-foreground">
                        <span>👤</span>
                        <span>{teacher?.fullName || 'المعلم'}</span>
                      </div>
                      {branch && (
                        <div className="flex items-center gap-1 text-[11px]">
                          <span>🏢</span>
                          <span>{branch.nameAr}</span>
                        </div>
                      )}
                    </div>

                    {/* Multi-Session Weekly Slots */}
                    <div className="space-y-1.5 bg-muted/40 p-2.5 rounded-xl border border-border">
                      <div className="text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                        <span>مواعيد الحصص الأسبوعية ({schedules.length})</span>
                      </div>
                      {schedules.map((slot, idx) => {
                        const dayName = DAYS_OF_WEEK.find((d) => d.day === slot.dayOfWeek)?.nameAr || '';
                        const room = classrooms.find((c) => c.id === slot.classroomId);
                        return (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs bg-card/70 px-2 py-1.5 rounded-lg border border-border/60"
                          >
                            <span className="font-black text-foreground">
                              {dayName} ({slot.startTime} - {slot.endTime})
                            </span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 font-bold">
                              {room?.nameAr || 'القاعة'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Pricing System Details Card */}
                    <div className="rounded-xl border p-2.5 text-xs space-y-1.5 bg-muted/20 border-border">
                      {group.pricingModel === 'average_monthly' || group.pricingModel === 'center' ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                              <Calculator className="w-3.5 h-3.5" />
                              نظام المتوسط
                            </span>
                            <span className="font-black text-foreground">
                              {group.teacherRatePerStudent ?? 20} ج.م / طالب
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            المرتب = سعر الطالب للمدرس × متوسط عدد الطلاب الحاضرين في كل الحصص بالشهر.
                          </p>
                          <div className="text-[10px] text-muted-foreground font-semibold">
                            مصاريف الطالب: {group.monthlyFee} ج.م شهرياً
                          </div>
                        </div>
                      ) : group.pricingModel === 'private' || group.pricingModel === 'private_percentage' ? (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                              <Percent className="w-3.5 h-3.5" />
                              نظام البرايفت (النسبة)
                            </span>
                            <span className="font-black text-foreground">
                              {group.teacherPercentage ?? 70}% مدرس / {group.centerPercentage ?? 30}% سنتر
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            من كل طالب يدفع {group.monthlyFee} ج.م: المدرس ياخد{' '}
                            {Math.round(((group.monthlyFee || 0) * (group.teacherPercentage ?? 70)) / 100)} ج.م، والسنتر{' '}
                            {Math.round(((group.monthlyFee || 0) * (group.centerPercentage ?? 30)) / 100)} ج.م.
                          </p>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <DollarSign className="w-3.5 h-3.5" />
                              نظام الدفع بالحصة
                            </span>
                            <span className="font-black text-foreground">{group.sessionFee} ج.م / للحصة</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            مبالغ ثابتة متفق عليها: {group.teacherSessionAmount ?? 40} ج.م للمدرس +{' '}
                            {group.centerSessionAmount ?? 20} ج.م للسنتر.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer: Capacity */}
                  <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                    <span>السعة القصوى: {group.maxStudents || 35} طالب</span>
                    <Badge variant={group.isActive ? 'default' : 'outline'} className="text-[10px]">
                      {group.isActive ? 'نشطة' : 'معطلة'}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ADD / EDIT GROUP MODAL (Only when allowed) */}
      {allowGroupManagement && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto no-print">
          <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border p-6 my-8 space-y-6 animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-brand-cyan-600/10 text-brand-cyan-600 flex items-center justify-center">
                  <CalendarClock className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black text-foreground">
                    {editingGroup ? 'تعديل بيانات المجموعة' : 'إضافة مجموعة جديدة ومواعيد حصصها'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    حدد المرحلة، المعلم، مواعيد الحصص الأسبوعية، وطريقة الحساب.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveGroup} className="space-y-5">
              {/* Error & Conflict Messages */}
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}
              {conflictWarning && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{conflictWarning}</span>
                </div>
              )}

              {/* Section 1: Basic & Academic Data */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                  البيانات الأساسية والأكاديمية
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      اسم المجموعة <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="مثال: مجموعة أ - فيزياء 3 ثانوي"
                      value={formData.nameAr}
                      onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      الفرع <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.branchId}
                      onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      المرحلة التعليمية <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.stage}
                      onChange={(e) => {
                        const newStage = e.target.value;
                        const stObj = stages.find((s) => s.id === newStage || s.nameAr === newStage);
                        const firstGrade = stObj?.grades[0]?.id || '';
                        setFormData({ ...formData, stage: newStage, grade: firstGrade });
                      }}
                      required
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    >
                      <option value="">اختر المرحلة</option>
                      {stages.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      الصف الدراسي <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.grade}
                      onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    >
                      <option value="">اختر الصف</option>
                      {availableGrades.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      المادة الدراسية <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.subjectId}
                      onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    >
                      <option value="">اختر المادة</option>
                      {availableSubjects.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.nameAr}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">
                      المعلم <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.teacherId}
                      onChange={(e) => setFormData({ ...formData, teacherId: e.target.value })}
                      required
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    >
                      <option value="">اختر المعلم</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.fullName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1">السعة القصوى للطلاب</label>
                    <input
                      type="number"
                      min="5"
                      max="200"
                      value={formData.maxStudents}
                      onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) || 35 })}
                      className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Multi-Session Weekly Slots (أكثر من حصة في الأسبوع) */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                      مواعيد الحصص في الأسبوع
                    </h4>
                    <p className="text-[11px] text-muted-foreground">
                      يمكنك تحديد حصة واحدة أو أكثر من حصة في الأسبوع وتعيين قاعة لكل حصة.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddScheduleSlot}
                    className="text-xs font-bold border-brand-cyan-600/30 text-brand-cyan-600 hover:bg-brand-cyan-500/10 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ إضافة حصة أخرى في الأسبوع</span>
                  </Button>
                </div>

                <div className="space-y-2">
                  {formData.weeklySchedules.map((slot, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl bg-muted/30 border border-border grid grid-cols-1 sm:grid-cols-4 gap-2 items-end"
                    >
                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">اليوم</label>
                        <select
                          value={slot.dayOfWeek}
                          onChange={(e) => handleUpdateScheduleSlot(index, { dayOfWeek: Number(e.target.value) })}
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                        >
                          {DAYS_OF_WEEK.map((d) => (
                            <option key={d.day} value={d.day}>
                              {d.nameAr}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">وقت البدء والانتهاء</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            value={slot.startTime}
                            onChange={(e) => handleUpdateScheduleSlot(index, { startTime: e.target.value })}
                            className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg"
                          />
                          <span className="text-muted-foreground">-</span>
                          <input
                            type="time"
                            value={slot.endTime}
                            onChange={(e) => handleUpdateScheduleSlot(index, { endTime: e.target.value })}
                            className="w-full px-2 py-1 text-xs bg-background border border-border rounded-lg"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-muted-foreground mb-1">القاعة المخصصة</label>
                        <select
                          value={slot.classroomId}
                          onChange={(e) => handleUpdateScheduleSlot(index, { classroomId: e.target.value })}
                          required
                          className="w-full px-2.5 py-1.5 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
                        >
                          <option value="">اختر القاعة</option>
                          {availableClassrooms.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.nameAr} ({c.capacity} مقعد)
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center justify-end">
                        {formData.weeklySchedules.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveScheduleSlot(index)}
                            className="text-red-600 hover:bg-red-500/10 text-xs px-2"
                          >
                            <Trash2 className="w-4 h-4 ml-1" /> حذف الحصة
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Section 3: Pricing Models (أنظمة الحسابات الثلاثة) */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div>
                  <h4 className="text-xs font-black text-muted-foreground uppercase tracking-wider">
                    طريقة حساب المجموعة والسعر <span className="text-red-500">*</span>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    اختر إحدى الطرق الثلاث المعتمدة لحساب مرتب المعلم ومستحقات السنتر.
                  </p>
                </div>

                {/* 3 Model Selection Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {/* Model 1: Average */}
                  <label
                    className={`p-3 rounded-xl border text-right cursor-pointer transition-all flex flex-col justify-between ${
                      formData.pricingModel === 'average_monthly' || formData.pricingModel === 'center'
                        ? 'bg-blue-500/10 border-blue-500 text-blue-900 dark:text-blue-100 ring-2 ring-blue-500/20'
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <input
                          type="radio"
                          name="pricingModel"
                          value="average_monthly"
                          checked={formData.pricingModel === 'average_monthly' || formData.pricingModel === 'center'}
                          onChange={() => setFormData({ ...formData, pricingModel: 'average_monthly' })}
                          className="accent-blue-600"
                        />
                        <Calculator className="w-4 h-4 text-blue-600" />
                      </div>
                      <span className="font-black text-xs block">1. نظام المتوسط</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        سعر الطالب في الشهر × متوسط الحضور
                      </span>
                    </div>
                  </label>

                  {/* Model 2: Private */}
                  <label
                    className={`p-3 rounded-xl border text-right cursor-pointer transition-all flex flex-col justify-between ${
                      formData.pricingModel === 'private' || formData.pricingModel === 'private_percentage'
                        ? 'bg-purple-500/10 border-purple-500 text-purple-900 dark:text-purple-100 ring-2 ring-purple-500/20'
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <input
                          type="radio"
                          name="pricingModel"
                          value="private"
                          checked={formData.pricingModel === 'private' || formData.pricingModel === 'private_percentage'}
                          onChange={() => setFormData({ ...formData, pricingModel: 'private' })}
                          className="accent-purple-600"
                        />
                        <Percent className="w-4 h-4 text-purple-600" />
                      </div>
                      <span className="font-black text-xs block">2. نظام البرايفت</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        نسبة مئوية للمدرس ونسبة للسنتر
                      </span>
                    </div>
                  </label>

                  {/* Model 3: Per Session Fixed */}
                  <label
                    className={`p-3 rounded-xl border text-right cursor-pointer transition-all flex flex-col justify-between ${
                      formData.pricingModel === 'per_session_fixed' || formData.pricingModel === 'fixed_session'
                        ? 'bg-emerald-500/10 border-emerald-500 text-emerald-900 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                        : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <input
                          type="radio"
                          name="pricingModel"
                          value="per_session_fixed"
                          checked={
                            formData.pricingModel === 'per_session_fixed' || formData.pricingModel === 'fixed_session'
                          }
                          onChange={() => setFormData({ ...formData, pricingModel: 'per_session_fixed' })}
                          className="accent-emerald-600"
                        />
                        <DollarSign className="w-4 h-4 text-emerald-600" />
                      </div>
                      <span className="font-black text-xs block">3. نظام الدفع بالحصة</span>
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        مبلغ ثابت للمدرس ومبلغ ثابت للسنتر
                      </span>
                    </div>
                  </label>
                </div>

                {/* Specific Inputs per Selected Model */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border space-y-3">
                  {formData.pricingModel === 'average_monthly' || formData.pricingModel === 'center' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            سعر الطالب في الشهر للمدرس (ج.م) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.teacherRatePerStudent}
                            onChange={(e) =>
                              setFormData({ ...formData, teacherRatePerStudent: Number(e.target.value) || 0 })
                            }
                            placeholder="مثال: 20"
                            required
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            مصاريف الشهر للطالب (ج.م) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.monthlyFee}
                            onChange={(e) => setFormData({ ...formData, monthlyFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 150"
                            required
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-900 dark:text-blue-200 text-xs leading-relaxed">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                          حسبة توضيحية لنظام المتوسط:
                        </div>
                        لو حددنا سعر الطالب في الشهر للمدرس {formData.teacherRatePerStudent} ج.م، وحضر مع المدرس متوسط
                        100 طالب في كل الحصص، يكون المرتب:
                        <div className="font-mono font-bold mt-1 text-blue-800 dark:text-blue-100">
                          {formData.teacherRatePerStudent} ج.م × 100 طالب ={' '}
                          {(formData.teacherRatePerStudent * 100).toLocaleString('ar-EG')} ج.م في الشهر.
                        </div>
                      </div>
                    </div>
                  ) : formData.pricingModel === 'private' || formData.pricingModel === 'private_percentage' ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            مصاريف الشهر للطالب (ج.م) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.monthlyFee}
                            onChange={(e) => setFormData({ ...formData, monthlyFee: Number(e.target.value) || 0 })}
                            placeholder="مثال: 300"
                            required
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            نسبة المدرس (%) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.teacherPercentage}
                            onChange={(e) => {
                              const tPct = Number(e.target.value) || 0;
                              setFormData({
                                ...formData,
                                teacherPercentage: tPct,
                                centerPercentage: Math.max(0, 100 - tPct),
                              });
                            }}
                            placeholder="مثال: 70"
                            required
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-muted-foreground mb-1">
                            نسبة السنتر (%) تلقائي
                          </label>
                          <input
                            type="number"
                            value={100 - formData.teacherPercentage}
                            disabled
                            className="w-full px-3 py-2 text-xs bg-muted/60 border border-border rounded-xl text-muted-foreground font-bold"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-900 dark:text-purple-200 text-xs leading-relaxed">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                          حسبة توضيحية لنظام البرايفت:
                        </div>
                        لو الطالب الواحد بيدفع {formData.monthlyFee} ج.م في الشهر:
                        <div className="font-mono font-bold mt-1 text-purple-800 dark:text-purple-100">
                          نصيب المدرس ({formData.teacherPercentage}%):{' '}
                          {Math.round(((formData.monthlyFee || 0) * formData.teacherPercentage) / 100)} ج.م · نصيب السنتر
                          ({100 - formData.teacherPercentage}%):{' '}
                          {Math.round(((formData.monthlyFee || 0) * (100 - formData.teacherPercentage)) / 100)} ج.م.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            مبلغ المدرس الثابت للحصة (ج.م) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.teacherSessionAmount}
                            onChange={(e) => {
                              const tAmt = Number(e.target.value) || 0;
                              setFormData({
                                ...formData,
                                teacherSessionAmount: tAmt,
                                sessionFee: tAmt + formData.centerSessionAmount,
                              });
                            }}
                            placeholder="مثال: 40"
                            required
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            مبلغ السنتر الثابت للحصة (ج.م) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={formData.centerSessionAmount}
                            onChange={(e) => {
                              const cAmt = Number(e.target.value) || 0;
                              setFormData({
                                ...formData,
                                centerSessionAmount: cAmt,
                                sessionFee: formData.teacherSessionAmount + cAmt,
                              });
                            }}
                            placeholder="مثال: 20"
                            required
                            className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1">
                            سعر الحصة للطالب (ج.م) تلقائي
                          </label>
                          <input
                            type="number"
                            value={formData.teacherSessionAmount + formData.centerSessionAmount}
                            disabled
                            className="w-full px-3 py-2 text-xs bg-muted/60 border border-border rounded-xl text-muted-foreground font-bold"
                          />
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed">
                        <div className="font-bold flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                          حسبة توضيحية لنظام الدفع بالحصة:
                        </div>
                        الطالب يدفع مبلغ الحصة الثابت (
                        {formData.teacherSessionAmount + formData.centerSessionAmount} ج.م)، بحيث يتحدد بالاتفاق مع
                        الإدارة:
                        <div className="font-mono font-bold mt-1 text-emerald-800 dark:text-emerald-100">
                          {formData.teacherSessionAmount} ج.م مبلغ المدرس الثابت + {formData.centerSessionAmount} ج.م مبلغ
                          السنتر الثابت = {formData.teacherSessionAmount + formData.centerSessionAmount} ج.م إجمالي الحصة.
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSaving}
                  className="text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving}
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white font-bold text-xs px-6 shadow-md shadow-brand-cyan-600/20"
                >
                  {isSaving ? 'جاري الحفظ...' : editingGroup ? 'تحديث المجموعة' : 'حفظ المجموعة وتوليد الحصص'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {allowGroupManagement && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 no-print">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-foreground">تأكيد حذف المجموعة</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                هل أنت متأكد من حذف مجموعة <span className="font-bold text-foreground">«{deleteTarget.nameAr}»</span>؟
                سيتم حذف كافة الحصص المجدولة التابعة لها.
              </p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDeleteTarget(null)}
                disabled={isDeleting}
                className="text-xs font-bold"
              >
                تراجع
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleDeleteGroup}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs px-5 shadow-md shadow-red-600/20"
              >
                {isDeleting ? 'جاري الحذف...' : 'نعم، احذف المجموعة'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
