'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  GraduationCap,
  Users,
  Search,
  Filter,
  Plus,
  Eye,
  CreditCard,
  QrCode,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageCircle,
  X,
  Trash2,
  Calendar,
  Layers,
  Clock,
  Printer,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDataProvider } from '@/lib/dal/factory';
import {
  User,
  Group,
  Enrollment,
  Invoice,
  Payment,
  StudentEnrollmentDetail,
  StudentAttendanceDetail,
  PricingModel,
  DiscountType,
  EducationalStage,
  Subject,
} from '@/lib/dal/types';
import {
  checkStudentEnrollmentConflict,
  StudentEnrollmentConflictCheckResult,
} from '@/lib/timetable/conflict-detector';
import { calculateDiscount } from '@/lib/finance/discounts';
import { BrandLogo } from '@/components/brand/brand-logo';

const EGYPTIAN_STAGES = [
  {
    id: 'primary',
    nameAr: 'المرحلة الابتدائية',
    grades: [
      { id: '1_prim', nameAr: 'الصف الأول الابتدائي' },
      { id: '2_prim', nameAr: 'الصف الثاني الابتدائي' },
      { id: '3_prim', nameAr: 'الصف الثالث الابتدائي' },
      { id: '4_prim', nameAr: 'الصف الرابع الابتدائي' },
      { id: '5_prim', nameAr: 'الصف الخامس الابتدائي' },
      { id: '6_prim', nameAr: 'الصف السادس الابتدائي' },
    ],
  },
  {
    id: 'preparatory',
    nameAr: 'المرحلة الإعدادية',
    grades: [
      { id: '1_prep', nameAr: 'الصف الأول الإعدادي' },
      { id: '2_prep', nameAr: 'الصف الثاني الإعدادي' },
      { id: '3_prep', nameAr: 'الصف الثالث الإعدادي' },
    ],
  },
  {
    id: 'secondary',
    nameAr: 'المرحلة الثانوية',
    grades: [
      { id: '1_sec', nameAr: 'الصف الأول الثانوي (عام)' },
      {
        id: '2_sec',
        nameAr: 'الصف الثاني الثانوي',
        hasDivisions: true,
        divisions: [
          { id: 'scientific', nameAr: 'علمي' },
          { id: 'literary', nameAr: 'أدبي' },
        ],
      },
      {
        id: '3_sec',
        nameAr: 'الصف الثالث الثانوي',
        hasDivisions: true,
        divisions: [
          { id: 'scientific_math', nameAr: 'علمي رياضة' },
          { id: 'scientific_science', nameAr: 'علمي علوم' },
          { id: 'literary', nameAr: 'أدبي' },
        ],
      },
    ],
  },
];

const DAYS_NAMES: Record<number, string> = {
  0: 'الأحد',
  1: 'الإثنين',
  2: 'الثلاثاء',
  3: 'الأربعاء',
  4: 'الخميس',
  5: 'الجمعة',
  6: 'السبت',
};

// Generates high-contrast vertical bars for Code 128 preview SVG
function generateBarcodePattern(text: string) {
  const bars: { x: number; width: number }[] = [];
  let currentX = 10;
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i);
    const pattern = [(charCode % 3) + 1, ((charCode >> 1) % 2) + 1, ((charCode >> 2) % 3) + 1, 2];
    for (let j = 0; j < pattern.length; j++) {
      if (j % 2 === 0) {
        bars.push({ x: currentX, width: pattern[j] * 2 });
      }
      currentX += pattern[j] * 2 + 1;
    }
  }
  return { bars, totalWidth: currentX + 10 };
}

export default function StudentsDirectoryPage() {
  const { tenant } = useTenant();
  const dal = useMemo(() => getDataProvider(), []);

  // Data states
  const [students, setStudents] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedDivision, setSelectedDivision] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'due' | 'paid' | 'scholarship'>('all');

  // Modals & Drawers state
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [selectedStudentForDrawer, setSelectedStudentForDrawer] = useState<User | null>(null);
  const [selectedStudentForEnroll, setSelectedStudentForEnroll] = useState<User | null>(null);
  const [selectedStudentForIdCard, setSelectedStudentForIdCard] = useState<User | null>(null);

  // Master Data from DAL
  const [masterStages, setMasterStages] = useState<EducationalStage[]>([]);
  const [masterSubjects, setMasterSubjects] = useState<Subject[]>([]);

  // Refresh handler
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allUsers, allGroups, allEnrollments, allInvoices, allStages, allSubjects] = await Promise.all([
        dal.getUsers(tenant.id, { role: 'STUDENT' }),
        dal.getGroups(tenant.id),
        dal.getEnrollments(tenant.id),
        dal.getInvoices(tenant.id),
        dal.getStages(tenant.id),
        dal.getSubjects(tenant.id),
      ]);
      setStudents(allUsers);
      setGroups(allGroups);
      setEnrollments(allEnrollments);
      setInvoices(allInvoices);
      setMasterStages(allStages);
      setMasterSubjects(allSubjects);
    } finally {
      setIsLoading(false);
    }
  }, [dal, tenant.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Available grades for selected stage
  const availableGrades = useMemo(() => {
    if (selectedStage === 'all') return [];
    const stage = masterStages.find((s) => s.id === selectedStage);
    return stage ? stage.grades : [];
  }, [selectedStage, masterStages]);

  // Available divisions for selected grade
  const availableDivisions = useMemo(() => {
    if (selectedGrade === 'all') return [];
    for (const s of masterStages) {
      const g = (s.grades || []).find((grade) => grade.id === selectedGrade);
      if (g && g.hasDivisions && g.divisions) {
        return g.divisions;
      }
    }
    return [];
  }, [selectedGrade, masterStages]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = s.fullName.toLowerCase().includes(q);
        const matchesCode = s.studentCode?.toLowerCase().includes(q);
        const matchesPhone = s.phone?.includes(q) || s.guardianPhone?.includes(q);
        if (!matchesName && !matchesCode && !matchesPhone) return false;
      }

      // Stage
      if (selectedStage !== 'all' && s.stage !== selectedStage) return false;

      // Grade
      if (selectedGrade !== 'all' && s.grade !== selectedGrade) return false;

      // Division
      if (selectedDivision !== 'all' && s.division !== selectedDivision) return false;

      // Payment Status
      if (paymentFilter === 'due' && (s.balanceDue || 0) <= 0) return false;
      if (paymentFilter === 'paid' && (s.balanceDue || 0) > 0) return false;
      if (paymentFilter === 'scholarship') {
        const hasScholarship = enrollments.some(
          (e) => e.studentId === s.id && e.discountType === 'free_100' && e.isActive
        );
        if (!hasScholarship) return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedStage, selectedGrade, selectedDivision, paymentFilter, enrollments]);

  // KPI Calculations
  const kpiTotalStudents = students.length;
  const kpiActiveEnrollments = enrollments.filter((e) => e.isActive).length;
  const kpiOverdueStudents = students.filter((s) => (s.balanceDue || 0) > 0).length;
  const kpiTotalBalanceDue = students.reduce((acc, s) => acc + (s.balanceDue || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-brand-cyan-600" />
            <span>شؤون الطلاب والتسجيل</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            إدارة بيانات الطلاب، الاشتراكات بالمجموعات، التحصيل المالي، وفحص التعارض الزمني في {tenant.nameAr}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={() => setIsRegisterModalOpen(true)}
            className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white font-bold flex items-center gap-2 shadow-lg shadow-brand-cyan-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>تسجيل طالب جديد</span>
          </Button>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">إجمالي الطلاب المقيدين</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{kpiTotalStudents}</h3>
              <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1 font-medium">
                <TrendingUp className="w-3 h-3" /> مقيدين بالسجلات
              </p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-cyan-500/10 text-brand-cyan-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">الاشتراكات النشطة بالمجموعات</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{kpiActiveEnrollments}</h3>
              <p className="text-[11px] text-brand-cyan-600 font-medium mt-1">حصة / مقعد نشط</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">طلاب لديهم مستحقات</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">{kpiOverdueStudents}</h3>
              <p className="text-[11px] text-rose-500 font-medium mt-1">متبقي عليهم رسوم</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">إجمالي المستحقات المطلوبة</p>
              <h3 className="text-2xl font-black text-amber-500 mt-1">
                {kpiTotalBalanceDue.toLocaleString('ar-EG')} <span className="text-xs">ج.م</span>
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-1">مستحقات واجبة التحصيل</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <CreditCard className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="card-elevated border-border">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Search Input */}
            <div className="relative md:col-span-2">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث بالاسم، كود الطالب (STD-...)، أو هاتف ولي الأمر..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
              />
            </div>

            {/* Stage Selector */}
            <div>
              <select
                value={selectedStage}
                onChange={(e) => {
                  setSelectedStage(e.target.value);
                  setSelectedGrade('all');
                  setSelectedDivision('all');
                }}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
              >
                <option value="all">كل المراحل الدراسية</option>
                {masterStages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Grade Selector */}
            <div>
              <select
                value={selectedGrade}
                onChange={(e) => {
                  setSelectedGrade(e.target.value);
                  setSelectedDivision('all');
                }}
                disabled={selectedStage === 'all'}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 disabled:opacity-50"
              >
                <option value="all">كل الصفوف</option>
                {availableGrades.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameAr}
                  </option>
                ))}
              </select>
            </div>

            {/* Division Selector */}
            <div>
              <select
                value={selectedDivision}
                onChange={(e) => setSelectedDivision(e.target.value)}
                disabled={availableDivisions.length === 0}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500 disabled:opacity-50"
              >
                <option value="all">كل الشُعب</option>
                {availableDivisions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nameAr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Payment Status Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 text-xs">
            <span className="text-muted-foreground font-semibold flex items-center gap-1">
              <Filter className="w-3.5 h-3.5" /> الحالة المالية:
            </span>
            <button
              onClick={() => setPaymentFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                paymentFilter === 'all'
                  ? 'bg-foreground text-background'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              الكل ({students.length})
            </button>
            <button
              onClick={() => setPaymentFilter('due')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                paymentFilter === 'due'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-500/10 text-rose-600 hover:bg-rose-500/20'
              }`}
            >
              مستحق عليه مبالغ ({kpiOverdueStudents})
            </button>
            <button
              onClick={() => setPaymentFilter('paid')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                paymentFilter === 'paid'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20'
              }`}
            >
              مسدد بالكامل ({students.length - kpiOverdueStudents})
            </button>
            <button
              onClick={() => setPaymentFilter('scholarship')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                paymentFilter === 'scholarship'
                  ? 'bg-purple-600 text-white'
                  : 'bg-purple-500/10 text-purple-600 hover:bg-purple-500/20'
              }`}
            >
              منحة كاملة 100%
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Students Data Table */}
      <Card className="card-elevated border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="py-3 px-4">الطالب</th>
                <th className="py-3 px-4">المرحلة والصف</th>
                <th className="py-3 px-4">بيانات ولي الأمر</th>
                <th className="py-3 px-4">المجموعات المقيد بها</th>
                <th className="py-3 px-4">الرصيد المالي</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <GraduationCap className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-bold">لا يوجد طلاب يطابقون شروط البحث</p>
                    <p className="text-xs text-muted-foreground mt-1">جرب تغيير كلمات البحث أو إعادة ضبط الفلاتر</p>
                  </td>
                </tr>
              ) : (
                filteredStudents.map((student) => {
                  const studentActiveEnrollments = enrollments.filter(
                    (e) => e.studentId === student.id && e.isActive
                  );

                  return (
                    <tr key={student.id} className="hover:bg-muted/30 transition-colors">
                      {/* Student Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={student.avatarUrl || '/brand/yalla-center-icon.png'}
                            alt={student.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-border shadow-sm"
                          />
                          <div>
                            <p className="font-bold text-foreground text-sm">{student.fullName}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-[11px] bg-brand-cyan-500/10 text-brand-cyan-700 dark:text-brand-cyan-400 px-1.5 py-0.5 rounded font-semibold">
                                {student.studentCode || 'STD-0000'}
                              </span>
                              {student.phone && (
                                <span className="text-[11px] text-muted-foreground">{student.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Stage & Grade */}
                      <td className="py-3 px-4">
                        <div className="space-y-1">
                          <Badge variant="outline" className="text-[11px] font-medium">
                            {student.stage === 'secondary'
                              ? 'ثانوي'
                              : student.stage === 'preparatory'
                              ? 'إعدادي'
                              : 'ابتدائي'}
                          </Badge>
                          {student.division && (
                            <span className="inline-block mr-1 text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {student.division === 'scientific_math'
                                ? 'علمي رياضة'
                                : student.division === 'scientific_science'
                                ? 'علمي علوم'
                                : student.division === 'scientific'
                                ? 'علمي'
                                : student.division === 'literary'
                                ? 'أدبي'
                                : 'عام'}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Guardian Info */}
                      <td className="py-3 px-4">
                        <div>
                          <p className="font-medium text-foreground text-xs">{student.guardianName || 'غير مسجل'}</p>
                          {student.guardianPhone && (
                            <div className="flex items-center gap-2 mt-1">
                              <a
                                href={`tel:${student.guardianPhone}`}
                                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                              >
                                <Phone className="w-3 h-3 text-brand-cyan-600" />
                                {student.guardianPhone}
                              </a>
                              <a
                                href={`https://wa.me/2${student.guardianPhone}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-600 hover:text-emerald-700 text-[11px] flex items-center gap-0.5"
                                title="مراسلة واتساب"
                              >
                                <MessageCircle className="w-3 h-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Enrolled Groups */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <Badge variant="cyan" className="font-bold">
                            {studentActiveEnrollments.length} مجموعات
                          </Badge>
                        </div>
                      </td>

                      {/* Financial Balance */}
                      <td className="py-3 px-4">
                        {(student.balanceDue || 0) <= 0 ? (
                          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                            مسدد بالكامل ✓
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/30 font-bold">
                            مستحق: {(student.balanceDue || 0).toLocaleString('ar-EG')} ج.م
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedStudentForDrawer(student)}
                            className="h-8 px-2 text-xs gap-1 border-border"
                            title="الملف الكامل"
                          >
                            <Eye className="w-3.5 h-3.5 text-brand-cyan-600" />
                            <span className="hidden sm:inline">الملف</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedStudentForEnroll(student)}
                            className="h-8 px-2 text-xs gap-1 border-border text-teal-600 hover:text-teal-700"
                            title="تسجيل بمجموعة"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">مجموعة</span>
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedStudentForIdCard(student)}
                            className="h-8 px-2 text-xs gap-1 border-border"
                            title="طباعة الكارنيه"
                          >
                            <QrCode className="w-3.5 h-3.5 text-amber-500" />
                            <span className="hidden sm:inline">كارنيه</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 1. Modal: Student Registration Intake */}
      {isRegisterModalOpen && (
        <StudentRegistrationModal
          tenantId={tenant.id}
          stages={masterStages}
          subjects={masterSubjects}
          onClose={() => setIsRegisterModalOpen(false)}
          onSuccess={() => {
            setIsRegisterModalOpen(false);
            loadData();
          }}
          dal={dal}
        />
      )}

      {/* 2. Modal: Group Enrollment with Live Preflight Conflict Radar HUD */}
      {selectedStudentForEnroll && (
        <GroupEnrollmentModal
          tenantId={tenant.id}
          student={selectedStudentForEnroll}
          groups={groups}
          subjects={masterSubjects}
          enrollments={enrollments}
          onClose={() => setSelectedStudentForEnroll(null)}
          onSuccess={() => {
            setSelectedStudentForEnroll(null);
            loadData();
          }}
          dal={dal}
        />
      )}

      {/* 3. Drawer: 360-Degree Student Detail Drawer (Groups, Attendance, Finances) */}
      {selectedStudentForDrawer && (
        <StudentDetailDrawer
          tenantId={tenant.id}
          student={selectedStudentForDrawer}
          onClose={() => setSelectedStudentForDrawer(null)}
          onEnrollClick={(st) => {
            setSelectedStudentForDrawer(null);
            setSelectedStudentForEnroll(st);
          }}
          onIdCardClick={(st) => {
            setSelectedStudentForDrawer(null);
            setSelectedStudentForIdCard(st);
          }}
          onDataChanged={loadData}
          dal={dal}
        />
      )}

      {/* 4. Modal: Official Branded Student ID Card with SVG Code 128 Barcode */}
      {selectedStudentForIdCard && (
        <StudentIdCardModal
          tenantName={tenant.nameAr}
          student={selectedStudentForIdCard}
          onClose={() => setSelectedStudentForIdCard(null)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Component: Student Registration Modal
// ---------------------------------------------------------------------------
function StudentRegistrationModal({
  tenantId,
  stages,
  subjects,
  onClose,
  onSuccess,
  dal,
}: {
  tenantId: string;
  stages: EducationalStage[];
  subjects: Subject[];
  onClose: () => void;
  onSuccess: () => void;
  dal: any;
}) {
  const [fullName, setFullName] = useState('');
  const [studentCode, setStudentCode] = useState('');
  const [phone, setPhone] = useState('');
  const [nationalId, setNationalId] = useState('');
  const [stage, setStage] = useState(stages[0]?.id || 'secondary');
  const [grade, setGrade] = useState(stages[0]?.grades?.[0]?.id || '1_sec');
  const [division, setDivision] = useState('');
  const [seatNumber, setSeatNumber] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync initial stage/grade once stages arrive
  useEffect(() => {
    if (stages.length > 0 && !stages.some((s) => s.id === stage)) {
      const firstStage = stages[0];
      setStage(firstStage.id);
      const firstGrade = firstStage.grades?.[0];
      setGrade(firstGrade?.id || '');
      if (firstGrade?.hasDivisions && (firstGrade.divisions || []).length > 0) {
        setDivision(firstGrade.divisions![0].id);
      }
    }
  }, [stages, stage]);

  const currentStageObj = useMemo(() => stages.find((s) => s.id === stage), [stages, stage]);
  const currentGrades = useMemo(() => currentStageObj?.grades || [], [currentStageObj]);
  const currentGradeObj = useMemo(() => currentGrades.find((g) => g.id === grade), [currentGrades, grade]);

  // Subjects available for this selected grade
  const gradeSubjects = useMemo(() => subjects.filter((s) => s.grade === grade), [subjects, grade]);

  const handleStageChange = (newStageId: string) => {
    setStage(newStageId);
    const targetStage = stages.find((s) => s.id === newStageId);
    const firstGrade = targetStage?.grades?.[0];
    setGrade(firstGrade?.id || '');
    if (firstGrade?.hasDivisions && (firstGrade.divisions || []).length > 0) {
      setDivision(firstGrade.divisions![0].id);
    } else {
      setDivision('');
    }
  };

  const handleGradeChange = (newGradeId: string) => {
    setGrade(newGradeId);
    const targetGrade = currentGrades.find((g) => g.id === newGradeId);
    if (targetGrade?.hasDivisions && (targetGrade.divisions || []).length > 0) {
      setDivision(targetGrade.divisions![0].id);
    } else {
      setDivision('');
    }
  };

  // Auto-generate next student code on mount
  useEffect(() => {
    dal.getUsers(tenantId, { role: 'STUDENT' }).then((students: User[]) => {
      const nextNum = 1000 + students.length + 1;
      setStudentCode(`STD-${nextNum}`);
    });
  }, [tenantId, dal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('يرجى إدخال اسم الطالب كاملاً');
      return;
    }
    if (!guardianPhone.trim()) {
      setErrorMessage('يرجى إدخال رقم هاتف ولي الأمر للطوارئ وإشعارات الواتساب');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await dal.createStudent(tenantId, {
        fullName: fullName.trim(),
        studentCode: studentCode.trim(),
        phone: phone.trim() || undefined,
        nationalId: nationalId.trim() || undefined,
        stage,
        grade,
        division: currentGradeObj?.hasDivisions ? division : undefined,
        seatNumber: seatNumber.trim() || undefined,
        guardianName: guardianName.trim() || undefined,
        guardianPhone: guardianPhone.trim(),
        avatarUrl: '/brand/yalla-center-icon.png',
      });
      onSuccess();
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ بيانات الطالب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-brand-cyan-600" />
            <h2 className="font-bold text-foreground text-base">تسجيل طالب جديد في السنتر</h2>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Section 1: Personal Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground border-b border-border/50 pb-1">
              1. البيانات الشخصية والأكاديمية
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold mb-1 text-foreground">الاسم الرباعي للطالب *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: زياد حسام الدين مصطفى"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">كود الطالب / الباركود *</label>
                <input
                  type="text"
                  required
                  value={studentCode}
                  onChange={(e) => setStudentCode(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">هاتف الطالب</label>
                <input
                  type="tel"
                  placeholder="010XXXXXXXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">المرحلة الدراسية *</label>
                <select
                  value={stage}
                  onChange={(e) => handleStageChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">الصف الدراسي *</label>
                <select
                  value={grade}
                  onChange={(e) => handleGradeChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                >
                  {currentGrades.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.nameAr}
                    </option>
                  ))}
                </select>
              </div>

              {currentGradeObj?.hasDivisions && currentGradeObj.divisions && currentGradeObj.divisions.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">الشعبة</label>
                  <select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  >
                    {currentGradeObj.divisions.map((div) => (
                      <option key={div.id} value={div.id}>
                        {div.nameAr}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Dynamic Subjects List for selected Grade */}
              <div className="sm:col-span-2 p-3 rounded-xl bg-muted/40 border border-border/60">
                <span className="text-[11px] font-bold text-muted-foreground block mb-1.5">
                  المواد الدراسية المقيدة لهذا الصف ({gradeSubjects.length}):
                </span>
                {gradeSubjects.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {gradeSubjects.map((sub) => (
                      <span
                        key={sub.id}
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-brand-cyan-500/10 text-brand-cyan-400 border border-brand-cyan-500/20"
                      >
                        {sub.nameAr} {sub.code ? `(${sub.code})` : ''}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">لا توجد مواد مسجلة لهذا الصف بعد في البيانات الأساسية.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">رقم الجلوس (اختياري)</label>
                <input
                  type="text"
                  placeholder="مثال: 5142"
                  value={seatNumber}
                  onChange={(e) => setSeatNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Guardian Info */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-bold text-muted-foreground border-b border-border/50 pb-1">
              2. بيانات ولي الأمر والتواصل الطارئ
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">اسم ولي الأمر</label>
                <input
                  type="text"
                  placeholder="مثال: حسام الدين مصطفى"
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">هاتف ولي الأمر (واتساب) *</label>
                <input
                  type="tel"
                  required
                  placeholder="010XXXXXXXX"
                  value={guardianPhone}
                  onChange={(e) => setGuardianPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold px-5"
            >
              {isSubmitting ? 'جاري التسجيل...' : 'حفظ وتسجيل الطالب'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Component: Group Enrollment Modal with Live Preflight Conflict Radar HUD
// ---------------------------------------------------------------------------
function GroupEnrollmentModal({
  tenantId,
  student,
  groups,
  subjects = [],
  enrollments,
  onClose,
  onSuccess,
  dal,
}: {
  tenantId: string;
  student: User;
  groups: Group[];
  subjects?: Subject[];
  enrollments: Enrollment[];
  onClose: () => void;
  onSuccess: () => void;
  dal: any;
}) {
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('all');
  const [selectedGroupId, setSelectedGroupId] = useState<string>(groups[0]?.id || '');
  const [pricingModel, setPricingModel] = useState<PricingModel>('center');
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter subjects matching student's grade
  const studentSubjects = useMemo(() => {
    if (!student.grade) return subjects;
    const match = subjects.filter((s) => s.grade === student.grade);
    return match.length > 0 ? match : subjects;
  }, [subjects, student.grade]);

  // Filter groups by selected subject
  const availableGroups = useMemo(() => {
    if (selectedSubjectId === 'all') return groups;
    return groups.filter((g) => g.subjectId === selectedSubjectId);
  }, [groups, selectedSubjectId]);

  // Sync selected group when subject filter changes
  const handleSubjectChange = (subjectId: string) => {
    setSelectedSubjectId(subjectId);
    const filtered = subjectId === 'all' ? groups : groups.filter((g) => g.subjectId === subjectId);
    setSelectedGroupId(filtered[0]?.id || '');
  };

  // Selected candidate group
  const candidateGroup = useMemo(() => {
    return availableGroups.find((g) => g.id === selectedGroupId) || null;
  }, [availableGroups, selectedGroupId]);

  // Student's currently active enrolled groups
  const studentActiveGroups = useMemo(() => {
    const activeEnrs = enrollments.filter((e) => e.studentId === student.id && e.isActive);
    return activeEnrs
      .map((e) => groups.find((g) => g.id === e.groupId))
      .filter((g): g is Group => Boolean(g));
  }, [enrollments, groups, student.id]);

  // Current enrolled count in target group
  const currentEnrolledCount = useMemo(() => {
    if (!candidateGroup) return 0;
    return enrollments.filter((e) => e.groupId === candidateGroup.id && e.isActive).length;
  }, [enrollments, candidateGroup]);

  // Preflight Conflict Radar HUD Evaluation
  const preflight: StudentEnrollmentConflictCheckResult | null = useMemo(() => {
    if (!candidateGroup) return null;
    return checkStudentEnrollmentConflict(
      candidateGroup,
      studentActiveGroups,
      currentEnrolledCount,
      DAYS_NAMES[candidateGroup.scheduleDay]
    );
  }, [candidateGroup, studentActiveGroups, currentEnrolledCount]);

  // Live Pricing Calculation
  const pricePreview = useMemo(() => {
    if (!candidateGroup) return { base: 0, discount: 0, net: 0 };
    const base = candidateGroup.monthlyFee || candidateGroup.sessionFee || 0;
    const calc = calculateDiscount({
      basePrice: base,
      discountType,
      discountValue,
    });
    return {
      base: calc.basePrice,
      discount: calc.discountAmount,
      net: calc.netPrice,
    };
  }, [candidateGroup, discountType, discountValue]);

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateGroup || !preflight || !preflight.canEnroll) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await dal.enrollStudent({
        tenantId,
        studentId: student.id,
        groupId: candidateGroup.id,
        pricingModel,
        discountType,
        discountValue,
      });

      if (!res.success) {
        setErrorMessage(res.error || 'فشل في تسجيل الاشتراك');
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ القيد');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-card border border-border w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div>
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Plus className="w-5 h-5 text-brand-cyan-600" />
              <span>تسجيل الطالب في مجموعة دراسية</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              الطالب: <span className="font-bold text-foreground">{student.fullName}</span> ({student.studentCode})
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleEnrollSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 rounded-xl text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Subject Filter Selector */}
          {studentSubjects.length > 0 && (
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">تحديد المادة الدراسية</label>
              <select
                value={selectedSubjectId}
                onChange={(e) => handleSubjectChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
              >
                <option value="all">جميع المواد الدراسية</option>
                {studentSubjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.nameAr} {s.code ? `(${s.code})` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group Selector OR Empty State Warning */}
          {selectedSubjectId !== 'all' && availableGroups.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="font-bold">لا توجد مجموعات متاحة لهذه المادة</span>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold mb-1 text-foreground">اختيار المجموعة الدراسية *</label>
              <select
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
              >
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameAr} | يوم ({DAYS_NAMES[g.scheduleDay]}) من {g.startTime} إلى {g.endTime}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Group Metadata Badge */}
          {candidateGroup && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border/60 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">الموعد المحدد:</span>
                <span className="font-bold text-foreground">
                  يوم ({DAYS_NAMES[candidateGroup.scheduleDay]}) من {candidateGroup.startTime} إلى {candidateGroup.endTime}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">حالة السعة بالمجموعة:</span>
                <span className="font-bold">
                  {currentEnrolledCount} / {candidateGroup.maxStudents} مقعد ({Math.round((currentEnrolledCount / candidateGroup.maxStudents) * 100)}%)
                </span>
              </div>
            </div>
          )}

          {/* LIVE CONFLICT RADAR PREFLIGHT HUD */}
          {preflight && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-muted-foreground">رادار فحص التعارض الزمني الفوري:</label>
              {preflight.canEnroll && preflight.warnings.length === 0 && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <div>
                    <p className="font-bold">الموعد متوافق تماماً مع جدول الطالب ولا يوجد أي تعارض زمني ✓</p>
                    <p className="text-[11px] opacity-80 mt-0.5">
                      يمكن تأكيد التسجيل بأمان. الحصة لا تتقاطع مع أي من مجموعات الطالب الحالية.
                    </p>
                  </div>
                </div>
              )}

              {/* Hard Collision Errors */}
              {preflight.errors.length > 0 && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-600 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-rose-700 dark:text-rose-400">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>تعارض زمني حاسم في جدول الطالب (حظر تسجيل)!</span>
                  </div>
                  {preflight.errors.map((err, i) => (
                    <p key={i} className="text-[11px] text-rose-600 pr-6 leading-relaxed">
                      • {err.messageAr}
                    </p>
                  ))}
                </div>
              )}

              {/* Capacity or Transit Warnings */}
              {preflight.warnings.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-xl text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>تنبيهات إدارية:</span>
                  </div>
                  {preflight.warnings.map((warn, i) => (
                    <p key={i} className="text-[11px] pr-6">
                      • {warn.messageAr}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pricing Model & Discount Engine */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h3 className="text-xs font-bold text-muted-foreground">نظام المحاسبة وسياسة الخصم:</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">نموذج التسعير</label>
                <select
                  value={pricingModel}
                  onChange={(e) => setPricingModel(e.target.value as PricingModel)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                >
                  <option value="center">نظام السنتر (اشتراك شهري)</option>
                  <option value="private">نظام البرايفت (حصة خاصة / نسبة)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1 text-foreground">سياسة الخصم</label>
                <select
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                  className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                >
                  <option value="none">بدون خصم (كامل المصروفات)</option>
                  <option value="percentage">نسبة مئوية % (أشقاء / تفوق)</option>
                  <option value="fixed">مبلغ ثابت ج.م</option>
                  <option value="free_100">منحة دراسية كاملة 100%</option>
                </select>
              </div>

              {discountType === 'percentage' && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">نسبة الخصم %</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  />
                </div>
              )}

              {discountType === 'fixed' && (
                <div>
                  <label className="block text-xs font-semibold mb-1 text-foreground">قيمة الخصم بالجنيه</label>
                  <input
                    type="number"
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Price Preview Card */}
            <div className="p-3 bg-brand-cyan-500/5 border border-brand-cyan-500/20 rounded-xl text-xs space-y-1">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>المصروفات الشهرية المقررة:</span>
                <span>{pricePreview.base} ج.م</span>
              </div>
              <div className="flex justify-between items-center text-rose-500">
                <span>قيمة الخصم المعتمد:</span>
                <span>- {pricePreview.discount} ج.م</span>
              </div>
              <div className="flex justify-between items-center font-bold text-foreground pt-1 border-t border-border/50 text-sm">
                <span>صافي الفاتورة المطلوبة:</span>
                <span className="text-brand-cyan-600">{pricePreview.net} ج.م</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={!preflight?.canEnroll || isSubmitting}
              className="bg-brand-cyan-600 hover:bg-brand-cyan-700 disabled:opacity-40 text-white text-xs font-bold px-5"
            >
              {isSubmitting ? 'جاري القيد...' : 'تأكيد التسجيل بالمجموعة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Component: 360-Degree Student Detail Drawer
// ---------------------------------------------------------------------------
function StudentDetailDrawer({
  tenantId,
  student,
  onClose,
  onEnrollClick,
  onIdCardClick,
  onDataChanged,
  dal,
}: {
  tenantId: string;
  student: User;
  onClose: () => void;
  onEnrollClick: (st: User) => void;
  onIdCardClick: (st: User) => void;
  onDataChanged: () => void;
  dal: any;
}) {
  const [activeTab, setActiveTab] = useState<'groups' | 'attendance' | 'finances'>('groups');
  const [enrollmentDetails, setEnrollmentDetails] = useState<StudentEnrollmentDetail[]>([]);
  const [attendanceHistory, setAttendanceHistory] = useState<StudentAttendanceDetail[]>([]);
  const [studentInvoices, setStudentInvoices] = useState<Invoice[]>([]);
  const [studentPayments, setStudentPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDrawerData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [enrs, atts, invs, pays] = await Promise.all([
        dal.getStudentEnrollmentDetails(tenantId, student.id),
        dal.getStudentAttendanceHistory(tenantId, student.id),
        dal.getInvoices(tenantId, { studentId: student.id }),
        dal.getPayments(tenantId, { studentId: student.id }),
      ]);
      setEnrollmentDetails(enrs);
      setAttendanceHistory(atts);
      setStudentInvoices(invs);
      setStudentPayments(pays);
    } finally {
      setIsLoading(false);
    }
  }, [dal, tenantId, student.id]);

  useEffect(() => {
    fetchDrawerData();
  }, [fetchDrawerData]);

  const handleUnenroll = async (enrollmentId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء قيد الطالب في هذه المجموعة؟')) return;
    await dal.unenrollStudent(tenantId, enrollmentId);
    await fetchDrawerData();
    onDataChanged();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex justify-start" dir="rtl">
      <div className="bg-card border-l border-border w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="p-5 border-b border-border bg-muted/30 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <img
              src={student.avatarUrl || '/brand/yalla-center-icon.png'}
              alt={student.fullName}
              className="w-14 h-14 rounded-2xl object-cover border border-border shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground">{student.fullName}</h2>
                <Badge variant="cyan" className="font-mono text-xs">
                  {student.studentCode}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {student.stage === 'secondary'
                  ? 'المرحلة الثانوية'
                  : student.stage === 'preparatory'
                  ? 'المرحلة الإعدادية'
                  : 'المرحلة الابتدائية'}{' '}
                {student.division ? `— شعبة ${student.division}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onIdCardClick(student)}
              className="text-xs gap-1 border-border"
            >
              <QrCode className="w-3.5 h-3.5 text-amber-500" />
              <span>كارنيه</span>
            </Button>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3 Drawer Navigation Tabs */}
        <div className="flex border-b border-border bg-muted/20 px-5 gap-6 text-xs font-bold">
          <button
            onClick={() => setActiveTab('groups')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'groups'
                ? 'border-brand-cyan-600 text-brand-cyan-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>المجموعات المقيد بها ({enrollmentDetails.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('attendance')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'attendance'
                ? 'border-brand-cyan-600 text-brand-cyan-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>سجل الحضور والغياب ({attendanceHistory.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('finances')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'finances'
                ? 'border-brand-cyan-600 text-brand-cyan-600'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <CreditCard className="w-4 h-4" />
            <span>الحساب المالي والفواتير</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: GROUPS */}
          {activeTab === 'groups' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted-foreground">المجموعات الدراسية النشطة</h3>
                <Button
                  size="sm"
                  onClick={() => onEnrollClick(student)}
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs h-8 gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>تسجيل في مجموعة جديدة</span>
                </Button>
              </div>

              {enrollmentDetails.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center text-muted-foreground text-xs">
                  الطالب غير مسجل في أي مجموعة حالياً
                </div>
              ) : (
                enrollmentDetails.map((enr) => (
                  <div
                    key={enr.id}
                    className="p-4 rounded-xl border border-border bg-card hover:border-brand-cyan-500/30 transition-colors flex items-start justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <h4 className="font-bold text-foreground text-sm">{enr.group?.nameAr || 'مجموعة دراسية'}</h4>
                      <p className="text-xs text-muted-foreground">
                        المعلم: <span className="text-foreground">{enr.teacher?.fullName || 'غير محدد'}</span> | القاعة:{' '}
                        {enr.classroom?.nameAr || 'غير محددة'} ({enr.branch?.nameAr || ''})
                      </p>
                      <div className="flex items-center gap-2 pt-1 text-xs">
                        <Badge variant="cyan">
                          {enr.pricingModel === 'center' ? 'نظام السنتر' : 'نظام البرايفت'}
                        </Badge>
                        {enr.discountType !== 'none' && (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/20">
                            خصم:{' '}
                            {enr.discountType === 'free_100'
                              ? 'منحة كاملة 100%'
                              : enr.discountType === 'percentage'
                              ? `${enr.discountValue}%`
                              : `${enr.discountValue} ج.م`}
                          </Badge>
                        )}
                        <span className="text-muted-foreground text-[11px]">
                          الموعد: يوم ({DAYS_NAMES[enr.group?.scheduleDay || 0]}) من {enr.group?.startTime} إلى{' '}
                          {enr.group?.endTime}
                        </span>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnenroll(enr.id)}
                      className="text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 border-rose-500/20 h-8 px-2 text-xs gap-1 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>إلغاء القيد</span>
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 2: ATTENDANCE HISTORY */}
          {activeTab === 'attendance' && (
            <div className="space-y-3">
              <div className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">نسبة الحضور الملتزم:</span>
                  <p className="text-lg font-black text-emerald-600">95% (حضور منتظم)</p>
                </div>
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  {attendanceHistory.length} حصص مسجلة
                </Badge>
              </div>

              {attendanceHistory.length === 0 ? (
                <div className="p-8 border border-dashed border-border rounded-xl text-center text-muted-foreground text-xs">
                  لا توجد سجلات حضور مسجلة لهذا الطالب حتى الآن
                </div>
              ) : (
                <div className="space-y-2">
                  {attendanceHistory.map((att) => (
                    <div
                      key={att.id}
                      className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                          ✓
                        </div>
                        <div>
                          <p className="font-bold text-foreground">{att.group?.nameAr || 'حصة دراسية'}</p>
                          <p className="text-[11px] text-muted-foreground">
                            التاريخ: {att.session?.sessionDate || '2026-10-18'} | وقت المسح:{' '}
                            {new Date(att.scannedAt).toLocaleTimeString('ar-EG')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[11px]">
                        {att.verificationMethod === 'barcode'
                          ? 'مسح باركود'
                          : att.verificationMethod === 'qr'
                          ? 'رمز QR'
                          : 'تسجيل يدوي'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FINANCIAL LEDGER */}
          {activeTab === 'finances' && (
            <div className="space-y-4">
              {/* Financial Banner */}
              <div className="p-4 bg-muted/40 rounded-xl border border-border grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-muted-foreground">إجمالي المطلوب:</span>
                  <p className="text-sm font-black text-foreground mt-0.5">
                    {studentInvoices.reduce((a, b) => a + b.netAmount, 0)} ج.م
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">المسدد فعلياً:</span>
                  <p className="text-sm font-black text-emerald-600 mt-0.5">
                    {studentInvoices.reduce((a, b) => a + b.paidAmount, 0)} ج.م
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">الرصيد المتبقي:</span>
                  <p className="text-sm font-black text-rose-600 mt-0.5">{student.balanceDue || 0} ج.م</p>
                </div>
              </div>

              {/* Invoices List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-muted-foreground">فواتير ومطالبات الطالب:</h4>
                {studentInvoices.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد فواتير مصدرة</p>
                ) : (
                  studentInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">{inv.invoiceNumber}</span>
                          <Badge
                            variant="outline"
                            className={
                              inv.status === 'paid'
                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                            }
                          >
                            {inv.status === 'paid' ? 'مسدد' : inv.status === 'partially_paid' ? 'مسدد جزئياً' : 'مستحق'}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          شهر {inv.billingMonth} / {inv.billingYear} | تاريخ الاستحقاق: {inv.dueDate}
                        </p>
                      </div>

                      <div className="text-left font-mono">
                        <p className="font-bold text-foreground text-sm">{inv.netAmount} ج.م</p>
                        <p className="text-[11px] text-muted-foreground">المسدد: {inv.paidAmount} ج.م</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Payments List */}
              <div className="space-y-2 pt-2 border-t border-border">
                <h4 className="text-xs font-bold text-muted-foreground">إيصالات السداد والمقبوضات:</h4>
                {studentPayments.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">لا توجد إيصالات سداد مسجلة</p>
                ) : (
                  studentPayments.map((p) => (
                    <div
                      key={p.id}
                      className="p-3 bg-card border border-border rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-bold text-foreground">{p.receiptNumber}</span>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          طريقة الدفع: {p.paymentMethod} | التاريخ: {new Date(p.paidAt).toLocaleDateString('ar-EG')}
                        </p>
                      </div>
                      <span className="font-bold text-emerald-600 text-sm">+{p.amountPaid} ج.م</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Component: Official Branded Student ID Card Modal with Code 128 SVG
// ---------------------------------------------------------------------------
function StudentIdCardModal({
  tenantName,
  student,
  onClose,
}: {
  tenantName: string;
  student: User;
  onClose: () => void;
}) {
  const code = student.studentCode || 'STD-1001';
  const { bars, totalWidth } = useMemo(() => generateBarcodePattern(code), [code]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <h2 className="font-bold text-foreground text-sm flex items-center gap-2">
            <QrCode className="w-4 h-4 text-brand-cyan-600" />
            <span>بطاقة الطالب المعتمدة (Student ID Card)</span>
          </h2>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Official Printable ID Card Container */}
          <div
            id="student-id-card-print"
            className="w-full bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-2xl border-2 border-brand-cyan-500/40 p-5 shadow-xl relative overflow-hidden space-y-4"
          >
            {/* Header with Logo */}
            <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
              <div className="h-8">
                <BrandLogo theme="light" />
              </div>
              <div className="text-left">
                <p className="text-[11px] font-bold text-brand-cyan-400">{tenantName}</p>
                <p className="text-[9px] text-slate-400">بطاقة قيد دراسي رسمية</p>
              </div>
            </div>

            {/* Student Photo & Identity */}
            <div className="flex items-center gap-4">
              <img
                src={student.avatarUrl || '/brand/yalla-center-icon.png'}
                alt={student.fullName}
                className="w-16 h-16 rounded-xl object-cover border-2 border-brand-cyan-400 shadow-md bg-white"
              />
              <div className="space-y-1">
                <h3 className="text-sm font-black text-white">{student.fullName}</h3>
                <p className="text-[11px] text-slate-300">
                  {student.stage === 'secondary'
                    ? 'المرحلة الثانوية'
                    : student.stage === 'preparatory'
                    ? 'المرحلة الإعدادية'
                    : 'المرحلة الابتدائية'}
                </p>
                {student.division && (
                  <span className="inline-block bg-brand-cyan-500/20 text-brand-cyan-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    شعبة: {student.division}
                  </span>
                )}
              </div>
            </div>

            {/* High-Contrast SVG Code 128 Barcode */}
            <div className="bg-white p-3 rounded-xl flex flex-col items-center justify-center space-y-1">
              <svg width="100%" height="45" viewBox={`0 0 ${totalWidth} 45`} className="overflow-visible">
                {bars.map((b, i) => (
                  <rect key={i} x={b.x} y="0" width={b.width} height="45" fill="black" />
                ))}
              </svg>
              <span className="font-mono font-black text-black tracking-widest text-xs">{code}</span>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800">
              <span>طوارئ: {student.guardianPhone || 'لا يوجد'}</span>
              <span>عام دراسي: 2026/2027</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-muted/30 border-t border-border flex items-center justify-end gap-3">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs">
            إغلاق
          </Button>
          <Button
            size="sm"
            onClick={handlePrint}
            className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة البطاقة</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
