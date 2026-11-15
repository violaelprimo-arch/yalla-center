'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  GraduationCap,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Wallet,
  Award,
  PhoneCall,
  MessageCircle,
  BellRing,
  ArrowRight,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ChildProfile {
  id: string;
  code: string;
  name: string;
  stage: string;
  branch: string;
  attendanceRate: number;
  balanceDue: number;
  groups: Array<{
    subject: string;
    teacher: string;
    schedule: string;
    classroom: string;
  }>;
  recentAttendance: Array<{
    date: string;
    group: string;
    time: string;
    status: 'present' | 'absent' | 'late';
    label: string;
  }>;
  recentGrades: Array<{
    examName: string;
    date: string;
    score: number;
    maxScore: number;
    homework: string;
  }>;
}

const CHILDREN_DATA: ChildProfile[] = [
  {
    id: 'child-1001',
    code: 'STD-1001',
    name: 'أحمد محمد علي',
    stage: 'المرحلة الثانوية — الصف الثالث الثانوي',
    branch: 'الفرع الرئيسي (قاعة 1)',
    attendanceRate: 95,
    balanceDue: 0,
    groups: [
      {
        subject: 'الرياضيات (تفاضل وتكامل)',
        teacher: 'أ. أحمد عبد العزيز',
        schedule: 'السبت والثلاثاء 10:00 ص - 01:00 م',
        classroom: 'قاعة 1',
      },
      {
        subject: 'الفيزياء الحديثة',
        teacher: 'أ. محمد إبراهيم',
        schedule: 'الأحد والأربعاء 04:00 م - 06:00 م',
        classroom: 'قاعة 2',
      },
    ],
    recentAttendance: [
      { date: '2026-11-15', group: 'رياضيات 3ث', time: '10:02 ص', status: 'present', label: 'حاضر (في الموعد)' },
      { date: '2026-11-12', group: 'فيزياء 3ث', time: '04:01 م', status: 'present', label: 'حاضر (في الموعد)' },
      { date: '2026-11-10', group: 'رياضيات 3ث', time: '10:05 ص', status: 'present', label: 'حاضر' },
      { date: '2026-11-08', group: 'فيزياء 3ث', time: '—', status: 'absent', label: 'غياب بعذر تم إشعارك' },
    ],
    recentGrades: [
      { examName: 'اختبار الحصة (تفاضل وتكامل)', date: '2026-11-15', score: 18, maxScore: 20, homework: 'تم التسليم' },
      { examName: 'اختبار نصف الفصل (فيزياء)', date: '2026-11-12', score: 28, maxScore: 30, homework: 'تم التسليم' },
      { examName: 'اختبار الحصة (جبر وهندسة)', date: '2026-11-05', score: 19, maxScore: 20, homework: 'تم التسليم' },
    ],
  },
  {
    id: 'child-1002',
    code: 'STD-1002',
    name: 'سارة محمد علي',
    stage: 'المرحلة الثانوية — الصف الأول الثانوي',
    branch: 'الفرع الرئيسي (قاعة 3)',
    attendanceRate: 100,
    balanceDue: 150,
    groups: [
      {
        subject: 'اللغة الإنجليزية',
        teacher: 'م. هاني شاكر',
        schedule: 'الإثنين والخميس 02:00 م - 04:00 م',
        classroom: 'قاعة 3',
      },
      {
        subject: 'الكيمياء العامة',
        teacher: 'د. سامح فؤاد',
        schedule: 'الجمعة 10:00 ص - 12:00 م',
        classroom: 'قاعة 1',
      },
    ],
    recentAttendance: [
      { date: '2026-11-14', group: 'إنجليزي 1ث', time: '02:00 م', status: 'present', label: 'حاضر (في الموعد)' },
      { date: '2026-11-11', group: 'كيمياء 1ث', time: '10:01 ص', status: 'present', label: 'حاضر' },
      { date: '2026-11-07', group: 'إنجليزي 1ث', time: '02:03 م', status: 'present', label: 'حاضر' },
    ],
    recentGrades: [
      { examName: 'Quiz Vocabulary Unit 4', date: '2026-11-14', score: 20, maxScore: 20, homework: 'تم التسليم' },
      { examName: 'اختبار المعادلات الكيميائية', date: '2026-11-11', score: 14, maxScore: 15, homework: 'تم التسليم' },
    ],
  },
];

export default function ParentPortalPage() {
  const { tenant } = useTenant();
  const [children] = useState<ChildProfile[]>(CHILDREN_DATA);
  const [selectedChildId, setSelectedChildId] = useState<string>(CHILDREN_DATA[0].id);

  const activeChild = children.find((c) => c.id === selectedChildId) || children[0];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header with Child Selector */}
      <div className="card-elevated p-6 rounded-2xl border border-border flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 dark:text-orange-400 flex items-center justify-center font-bold text-2xl shrink-0">
            <Users className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground">بوابة ولي الأمر للمتابعة الفورية</h1>
              <Badge variant="outline" className="text-xs">المتابعة المباشرة</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              متابعة مباشرة لحضور أبنائك، درجات اختبارات الحصص، التنبيهات، وحالة المصروفات في {tenant.nameAr}.
            </p>
          </div>
        </div>

        {/* Multi-Child Selector Dropdown */}
        <div className="flex items-center gap-2 bg-muted/60 p-2 rounded-xl border border-border">
          <GraduationCap className="w-4 h-4 text-orange-500 shrink-0" />
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground font-semibold">اختيار الطالب للمتابعة:</span>
            <select
              value={selectedChildId}
              onChange={(e) => setSelectedChildId(e.target.value)}
              className="bg-transparent text-xs font-bold text-foreground focus:outline-none cursor-pointer pr-1"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id} className="bg-card text-foreground">
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Selected Child KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">الطالب المحدد</CardTitle>
            <GraduationCap className="w-4 h-4 text-brand-cyan-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold text-foreground">{activeChild.name}</div>
            <p className="text-[11px] text-muted-foreground mt-1">{activeChild.stage}</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">نسبة الانضباط والحضور</CardTitle>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {activeChild.attendanceRate}%
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">حضور ممتاز متطابق مع إشعارات واتساب</p>
          </CardContent>
        </Card>

        <Card className="border border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold text-muted-foreground">المستحقات المالية الحالية</CardTitle>
            <Wallet className="w-4 h-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-black font-mono ${activeChild.balanceDue > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {activeChild.balanceDue} ج.م
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              {activeChild.balanceDue > 0 ? 'يرجى سداد القسط الشهري' : 'تم تسوية كامل المستحقات'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Enrolled Groups */}
      <div className="space-y-3">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-5 h-5 text-brand-cyan-600" />
          <span>المجموعات المقيد بها الطالب «{activeChild.name}»</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activeChild.groups.map((grp, idx) => (
            <div key={idx} className="card-elevated p-4 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-foreground">{grp.subject}</h3>
                <span className="text-xs font-semibold text-brand-cyan-600 dark:text-brand-cyan-400">{grp.teacher}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>{grp.schedule} • {grp.classroom}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Attendance & Grades Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Log */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>آخر سجلات الحضور الممسوحة</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المجموعة</th>
                  <th className="p-3">الوقت</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeChild.recentAttendance.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="p-3 font-mono font-semibold text-foreground">{row.date}</td>
                    <td className="p-3 font-bold text-foreground">{row.group}</td>
                    <td className="p-3 font-mono text-muted-foreground">{row.time}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        row.status === 'present'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {row.status === 'present' ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {row.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Grades Log */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            <span>نتائج اختبارات الحصص ومتابعة الواجب</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="p-3">عنوان الاختبار</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الدرجة</th>
                  <th className="p-3">الواجب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeChild.recentGrades.map((g, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="p-3 font-bold text-foreground">{g.examName}</td>
                    <td className="p-3 font-mono text-muted-foreground">{g.date}</td>
                    <td className="p-3 font-black font-mono text-brand-cyan-600 dark:text-brand-cyan-400">
                      {g.score} / {g.maxScore}
                    </td>
                    <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">{g.homework}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Direct Contact with Center */}
      <div className="card-elevated p-5 rounded-2xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-foreground">هل لديك استفسار يخص الطالب «{activeChild.name}»؟</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            تواصل مباشرة مع إدارة سنتر {tenant.nameAr} أو المشرف الأكاديمي عبر الهاتف أو واتساب.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href="https://wa.me/201012345678"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-colors shadow-soft-sm"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            <span>محادثة واتساب</span>
          </a>
          <a
            href="tel:01012345678"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-background hover:bg-muted text-foreground font-bold text-xs transition-colors"
          >
            <PhoneCall className="w-3.5 h-3.5" />
            <span>اتصال هاتفي</span>
          </a>
        </div>
      </div>
    </div>
  );
}
