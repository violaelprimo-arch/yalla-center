'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  Wallet,
  Download,
  Award,
  ChevronLeft,
  User,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function StudentPortalPage() {
  const { tenant, currentUser } = useTenant();
  const [activeTab, setActiveTab] = useState<'overview' | 'timetable' | 'attendance' | 'grades' | 'finance' | 'materials'>('overview');

  // Realistic enrolled student profile
  const student = {
    code: 'STD-1001',
    name: currentUser.fullName || 'أحمد محمد علي',
    stage: 'المرحلة الثانوية — الصف الثالث الثانوي',
    branch: 'الفرع الرئيسي (قاعة 1)',
    balanceDue: 0,
    attendanceRate: 95,
  };

  const enrolledGroups = [
    {
      id: 'grp-math-01',
      subject: 'الرياضيات (تفاضل وتكامل)',
      teacher: 'أ. أحمد عبد العزيز',
      schedule: 'السبت والثلاثاء 10:00 ص - 01:00 م',
      classroom: 'قاعة 1',
      monthlyFee: 300,
    },
    {
      id: 'grp-phys-01',
      subject: 'الفيزياء الحديثة',
      teacher: 'أ. محمد إبراهيم',
      schedule: 'الأحد والأربعاء 04:00 م - 06:00 م',
      classroom: 'قاعة 2',
      monthlyFee: 250,
    },
  ];

  const recentAttendance = [
    { date: '2026-11-15', group: 'رياضيات 3ث', time: '10:02 ص', status: 'present', label: 'حاضر' },
    { date: '2026-11-12', group: 'فيزياء 3ث', time: '04:01 م', status: 'present', label: 'حاضر' },
    { date: '2026-11-10', group: 'رياضيات 3ث', time: '10:05 ص', status: 'present', label: 'حاضر' },
    { date: '2026-11-08', group: 'فيزياء 3ث', time: '—', status: 'absent', label: 'غياب بعذر' },
    { date: '2026-11-05', group: 'رياضيات 3ث', time: '10:00 ص', status: 'present', label: 'حاضر' },
  ];

  const recentGrades = [
    { examName: 'اختبار الحصة (تفاضل وتكامل)', date: '2026-11-15', score: 18, maxScore: 20, homework: 'تم التسليم' },
    { examName: 'اختبار نصف الفصل (فيزياء)', date: '2026-11-12', score: 28, maxScore: 30, homework: 'تم التسليم' },
    { examName: 'اختبار الحصة (جبر وهندسة)', date: '2026-11-05', score: 19, maxScore: 20, homework: 'تم التسليم' },
    { examName: 'اختبار كهرومغناطيسية', date: '2026-10-29', score: 27, maxScore: 30, homework: 'تم التسليم' },
  ];

  const recentMaterials = [
    { title: 'مذكرة المراجعة النهائية — التفاضل والتكامل', size: '4.2 MB', date: '2026-11-10', type: 'PDF' },
    { title: 'بنك أسئلة وتدريبات فيزياء الكهربية', size: '2.8 MB', date: '2026-11-08', type: 'PDF' },
    { title: 'ملخص قوانين الهندسة الفراغية 2026', size: '1.5 MB', date: '2026-11-01', type: 'PDF' },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Student Profile Card Banner */}
      <div className="card-elevated p-6 rounded-2xl border border-brand-cyan-500/30 bg-gradient-to-r from-card to-brand-cyan-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center font-bold text-2xl shadow-soft-sm shrink-0">
            <GraduationCap className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-black text-foreground">{student.name}</h1>
              <Badge variant="cyan" className="text-xs font-mono">{student.code}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{student.stage} • {student.branch}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-center p-3 rounded-xl bg-background/80 border border-border min-w-28">
            <span className="text-[10px] text-muted-foreground block">نسبة الحضور</span>
            <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{student.attendanceRate}%</span>
          </div>
          <div className="text-center p-3 rounded-xl bg-background/80 border border-border min-w-28">
            <span className="text-[10px] text-muted-foreground block">الرصيد المستحق</span>
            <span className="text-lg font-black text-foreground">{student.balanceDue} ج.م</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-border">
        {[
          { id: 'overview', label: 'نظرة عامة' },
          { id: 'timetable', label: 'جدول الحصص' },
          { id: 'attendance', label: 'سجل الحضور' },
          { id: 'grades', label: 'الدرجات والواجبات' },
          { id: 'finance', label: 'الاشتراكات والمدفوعات' },
          { id: 'materials', label: 'المذكرات والملازم' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              activeTab === tab.id
                ? 'bg-brand-cyan-600 text-white shadow-soft-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content: Overview & Timetable */}
      {(activeTab === 'overview' || activeTab === 'timetable') && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Calendar className="w-5 h-5 text-brand-cyan-600" />
            <span>المجموعات والحصص المقيد بها</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {enrolledGroups.map((grp) => (
              <Card key={grp.id} className="border border-border hover:border-brand-cyan-500/50 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold text-foreground">{grp.subject}</CardTitle>
                    <Badge variant="outline" className="text-[11px] font-mono">{grp.monthlyFee} ج.م / شهر</Badge>
                  </div>
                  <p className="text-xs text-brand-cyan-600 dark:text-brand-cyan-400 font-semibold">{grp.teacher}</p>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{grp.schedule}</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>القاعة: {grp.classroom}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: Attendance */}
      {(activeTab === 'overview' || activeTab === 'attendance') && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>سجل الحضور الأخير (الاستقبال السريع)</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">المجموعة</th>
                  <th className="p-3">وقت المسح</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentAttendance.map((row, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="p-3 font-mono text-foreground font-semibold">{row.date}</td>
                    <td className="p-3 font-bold text-foreground">{row.group}</td>
                    <td className="p-3 font-mono text-muted-foreground">{row.time}</td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        row.status === 'present'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
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
      )}

      {/* Tab Content: Grades & Homework */}
      {(activeTab === 'overview' || activeTab === 'grades') && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            <span>درجات اختبارات الحصص ومتابعة الواجبات</span>
          </h2>
          <div className="card-elevated rounded-2xl border border-border overflow-hidden">
            <table className="w-full text-right text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/40 text-muted-foreground font-bold">
                  <th className="p-3">عنوان الاختبار</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الدرجة</th>
                  <th className="p-3">التقييم</th>
                  <th className="p-3">الواجب</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentGrades.map((g, idx) => (
                  <tr key={idx} className="hover:bg-muted/20">
                    <td className="p-3 font-bold text-foreground">{g.examName}</td>
                    <td className="p-3 font-mono text-muted-foreground">{g.date}</td>
                    <td className="p-3 font-black font-mono text-brand-cyan-600 dark:text-brand-cyan-400">
                      {g.score} / {g.maxScore}
                    </td>
                    <td className="p-3">
                      <Badge variant="success" className="text-[10px]">ممتاز (90%+)</Badge>
                    </td>
                    <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">{g.homework}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab Content: Materials */}
      {(activeTab === 'overview' || activeTab === 'materials') && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-cyan-600" />
            <span>المذكرات والملازم الدراسية المتاحة للتحميل</span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentMaterials.map((mat, idx) => (
              <div key={idx} className="card-elevated p-4 rounded-xl border border-border flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <Badge variant="outline" className="text-[10px] font-mono">{mat.type} • {mat.size}</Badge>
                  <h3 className="text-xs font-bold text-foreground leading-snug">{mat.title}</h3>
                  <p className="text-[10px] text-muted-foreground">تاريخ الرفع: {mat.date}</p>
                </div>
                <Button size="sm" variant="outline" className="w-full text-xs font-bold gap-1.5 h-8">
                  <Download className="w-3.5 h-3.5" />
                  <span>تحميل المذكرة</span>
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
