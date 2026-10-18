'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Briefcase,
  Users,
  Search,
  Filter,
  DollarSign,
  Layers,
  Edit3,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Lock,
  X,
  Phone,
  Calendar,
  Percent,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDataProvider } from '@/lib/dal/factory';
import {
  User,
  Group,
  TeacherRate,
  Subject,
  PricingModel,
  UserRole,
} from '@/lib/dal/types';

export default function TeachersDirectoryPage() {
  const { tenant, currentUser, currentRole } = useTenant();
  const dal = useMemo(() => getDataProvider(), []);

  const [teachers, setTeachers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rates, setRates] = useState<TeacherRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<string>('all');

  // Modals
  const [selectedTeacherForRate, setSelectedTeacherForRate] = useState<User | null>(null);

  const isTeacherRole = currentRole === 'TEACHER';

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [allUsers, allGroups, allSubjects, allRates] = await Promise.all([
        dal.getUsers(tenant.id, { role: 'TEACHER' }),
        dal.getGroups(tenant.id),
        dal.getSubjects(tenant.id),
        dal.getTeacherRates(tenant.id),
      ]);
      setTeachers(allUsers);
      setGroups(allGroups);
      setSubjects(allSubjects);
      setRates(allRates);
    } finally {
      setIsLoading(false);
    }
  }, [dal, tenant.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered teachers list (if logged in as Teacher, AC-6 allows viewing self or read-only directory)
  const filteredTeachers = useMemo(() => {
    return teachers.filter((t) => {
      // If logged in as Teacher, they may only see their own row if strictly restricted,
      // or view directory in read-only mode with action buttons locked
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = t.fullName.toLowerCase().includes(q);
        const matchesPhone = t.phone?.includes(q);
        if (!matchesName && !matchesPhone) return false;
      }

      if (selectedModel !== 'all') {
        const teacherRate = rates.find((r) => r.teacherId === t.id);
        if (teacherRate && teacherRate.model !== selectedModel) return false;
      }

      return true;
    });
  }, [teachers, searchQuery, selectedModel, rates]);

  // KPIs
  const totalTeachers = teachers.length;
  const centerGroupsCount = groups.filter((g) => g.pricingModel === 'center').length;
  const privateGroupsCount = groups.filter((g) => g.pricingModel === 'private').length;
  const avgCenterRate = useMemo(() => {
    const centerRates = rates.filter((r) => r.model === 'center' && r.fixedRatePerStudent > 0);
    if (centerRates.length === 0) return 20;
    const sum = centerRates.reduce((acc, r) => acc + r.fixedRatePerStudent, 0);
    return Math.round(sum / centerRates.length);
  }, [rates]);

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <Briefcase className="w-8 h-8 text-brand-cyan-600" />
            <span>شؤون المعلمين وأسعار التعاقد</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            سجل هيئة التدريس، ضبط نماذج التسعير (سنتر / برايفت)، ومعدلات الأجر الثابت ونسب التقاسم في {tenant.nameAr}.
          </p>
        </div>
      </div>

      {/* AC-6 Security Lockout Banner for Teachers */}
      {isTeacherRole && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-xs sm:text-sm text-amber-800 dark:text-amber-300">
          <Lock className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-bold">وضع العرض المقيد للمعلم (AC-6 Security Enforcement):</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              بصفتك معلماً، أسعار التعاقد ونسب التقاسم للقراءة فقط. تعديل العقود مقتصر حصراً على إدارة السنتر والمحاسب.
            </p>
          </div>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">إجمالي المعلمين النشطين</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{totalTeachers}</h3>
              <p className="text-[11px] text-brand-cyan-600 font-medium mt-1">هيئة التدريس المعتمدة</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-brand-cyan-500/10 text-brand-cyan-600 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">مجموعات نظام السنتر</p>
              <h3 className="text-2xl font-black text-foreground mt-1">{centerGroupsCount}</h3>
              <p className="text-[11px] text-teal-600 font-medium mt-1">محاسبة متوسط الحضور</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">مجموعات نظام البرايفت</p>
              <h3 className="text-2xl font-black text-purple-600 mt-1">{privateGroupsCount}</h3>
              <p className="text-[11px] text-purple-600 font-medium mt-1">تقاسم نسب الإيرادات</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Percent className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="card-elevated border-border">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold">متوسط أجر الطالب للسنتر</p>
              <h3 className="text-2xl font-black text-amber-500 mt-1">
                {avgCenterRate} <span className="text-xs">ج.م</span>
              </h3>
              <p className="text-[11px] text-amber-600 font-medium mt-1">لكل طالب بالحصة</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="card-elevated border-border">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <input
                type="text"
                placeholder="بحث بالاسم أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
              />
            </div>

            <div>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full px-3 py-2 text-xs sm:text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-cyan-500"
              >
                <option value="all">كل نماذج التعاقد</option>
                <option value="center">نظام السنتر (أجر ثابت)</option>
                <option value="private">نظام البرايفت (نسبة مئوية)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Teachers Directory Table */}
      <Card className="card-elevated border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs sm:text-sm">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground font-bold">
              <tr>
                <th className="py-3 px-4">المعلم</th>
                <th className="py-3 px-4">المواد والمراحل</th>
                <th className="py-3 px-4">المجموعات النشطة</th>
                <th className="py-3 px-4">نموذج التعاقد السائد</th>
                <th className="py-3 px-4">سعر التعاقد المعتمد</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTeachers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Briefcase className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <p className="font-bold">لا يوجد معلمون مطابقون للبحث</p>
                  </td>
                </tr>
              ) : (
                filteredTeachers.map((teacher) => {
                  const teacherGroups = groups.filter((g) => g.teacherId === teacher.id);
                  const teacherRate = rates.find((r) => r.teacherId === teacher.id);
                  const subjectNames = Array.from(
                    new Set(
                      teacherGroups
                        .map((g) => subjects.find((s) => s.id === g.subjectId)?.nameAr)
                        .filter(Boolean)
                    )
                  );

                  return (
                    <tr key={teacher.id} className="hover:bg-muted/30 transition-colors">
                      {/* Teacher Identity */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={teacher.avatarUrl || '/brand/yalla-center-icon.png'}
                            alt={teacher.fullName}
                            className="w-10 h-10 rounded-xl object-cover border border-border shadow-sm"
                          />
                          <div>
                            <p className="font-bold text-foreground text-sm">{teacher.fullName}</p>
                            {teacher.phone && (
                              <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-brand-cyan-600" />
                                {teacher.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Subjects & Stages */}
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {subjectNames.length === 0 ? (
                            <span className="text-muted-foreground text-xs">عام</span>
                          ) : (
                            subjectNames.map((s, i) => (
                              <Badge key={i} variant="outline" className="text-[11px] font-semibold">
                                {s}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>

                      {/* Active Groups */}
                      <td className="py-3 px-4">
                        <Badge variant="cyan" className="font-bold">
                          {teacherGroups.length} مجموعات
                        </Badge>
                      </td>

                      {/* Compensation Model Badge */}
                      <td className="py-3 px-4">
                        {teacherRate?.model === 'private' ? (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-500/30">
                            نظام البرايفت
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-teal-500/10 text-teal-600 border-teal-500/30">
                            نظام السنتر
                          </Badge>
                        )}
                      </td>

                      {/* Contractual Rate Value */}
                      <td className="py-3 px-4 font-mono font-bold">
                        {teacherRate?.model === 'private' ? (
                          <span className="text-purple-600">
                            {teacherRate.teacherPercentage || 70}% معلم / {teacherRate.centerPercentage || 30}% سنتر
                          </span>
                        ) : (
                          <span className="text-teal-600">
                            {(teacherRate?.fixedRatePerStudent || 20).toFixed(2)} ج.م / طالب
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isTeacherRole}
                            onClick={() => setSelectedTeacherForRate(teacher)}
                            className="h-8 px-2.5 text-xs gap-1 border-border disabled:opacity-40"
                            title={isTeacherRole ? 'تعديل الأسعار محظور على المعلمين (AC-6)' : 'تعديل أسعار التعاقد'}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-brand-cyan-600" />
                            <span>تعديل الأسعار</span>
                          </Button>

                          <a
                            href={`/center/${tenant.slug}/finance?tab=payroll&teacherId=${teacher.id}`}
                            className="inline-flex items-center justify-center h-8 px-2.5 text-xs gap-1 rounded-md border border-border bg-background hover:bg-muted text-foreground transition-colors font-medium"
                          >
                            <FileText className="w-3.5 h-3.5 text-amber-500" />
                            <span>كشف الحساب</span>
                          </a>
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

      {/* Modal: Teacher Rate Configuration */}
      {selectedTeacherForRate && (
        <TeacherRateModal
          tenantId={tenant.id}
          teacher={selectedTeacherForRate}
          currentRate={rates.find((r) => r.teacherId === selectedTeacherForRate.id)}
          currentRole={currentRole}
          onClose={() => setSelectedTeacherForRate(null)}
          onSuccess={() => {
            setSelectedTeacherForRate(null);
            loadData();
          }}
          dal={dal}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-Component: Teacher Rate Configuration Modal (AC-6 Guarded)
// ---------------------------------------------------------------------------
function TeacherRateModal({
  tenantId,
  teacher,
  currentRate,
  currentRole,
  onClose,
  onSuccess,
  dal,
}: {
  tenantId: string;
  teacher: User;
  currentRate?: TeacherRate;
  currentRole: UserRole;
  onClose: () => void;
  onSuccess: () => void;
  dal: any;
}) {
  const [model, setModel] = useState<PricingModel>(currentRate?.model || 'center');
  const [fixedRate, setFixedRate] = useState<number>(currentRate?.fixedRatePerStudent || 20);
  const [teacherPercentage, setTeacherPercentage] = useState<number>(currentRate?.teacherPercentage || 70);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const centerPercentage = useMemo(() => {
    return Math.max(0, 100 - teacherPercentage);
  }, [teacherPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Invariant check: teacher + center === 100%
    if (model === 'private' && teacherPercentage + centerPercentage !== 100) {
      setErrorMessage('مجموع نسبة المعلم ونسبة السنتر يجب أن يساوي 100% بالضبط دون تسريب');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const rateId = currentRate?.id || `rate-${teacher.id}`;
      const res = await dal.updateTeacherRate(
        rateId,
        {
          model,
          fixedRatePerStudent: model === 'center' ? fixedRate : 0,
          teacherPercentage: model === 'private' ? teacherPercentage : 0,
          centerPercentage: model === 'private' ? centerPercentage : 0,
          splitPercentage: model === 'private' ? teacherPercentage : 0,
        },
        currentRole
      );

      if (!res.success) {
        setErrorMessage(res.error || 'فشل في حفظ التعديلات');
      } else {
        onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'حدث خطأ أثناء حفظ أسعار التعاقد');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto" dir="rtl">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden my-8">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/40">
          <div>
            <h2 className="font-bold text-foreground text-base flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-brand-cyan-600" />
              <span>ضبط أسعار التعاقد والتقاسم</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              المعلم: <span className="font-bold text-foreground">{teacher.fullName}</span>
            </p>
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

          {/* Model Switcher */}
          <div>
            <label className="block text-xs font-semibold mb-1 text-foreground">نموذج المحاسبة والتعاقد</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setModel('center')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  model === 'center'
                    ? 'border-teal-500 bg-teal-500/10 text-teal-700 dark:text-teal-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                نظام السنتر (أجر ثابت للحصة)
              </button>

              <button
                type="button"
                onClick={() => setModel('private')}
                className={`p-3 rounded-xl border text-xs font-bold transition-all text-center ${
                  model === 'private'
                    ? 'border-purple-500 bg-purple-500/10 text-purple-700 dark:text-purple-300'
                    : 'border-border bg-background text-muted-foreground hover:bg-muted/50'
                }`}
              >
                نظام البرايفت (نسبة مئوية)
              </button>
            </div>
          </div>

          {/* Center Fixed Rate Setting */}
          {model === 'center' && (
            <div className="space-y-2 p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl">
              <label className="block text-xs font-bold text-teal-800 dark:text-teal-300">
                أجر الطالب التعاقدي بالحصة (ج.م) *
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={fixedRate}
                onChange={(e) => setFixedRate(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                معادلة الحساب: <span className="font-bold text-foreground">متوسط الحضور الفعلي × {fixedRate} ج.م</span>{' '}
                (مع استبعاد الحصص الملغاة والمؤجلة تماماً).
              </p>
            </div>
          )}

          {/* Private Split Percentage Setting */}
          {model === 'private' && (
            <div className="space-y-3 p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-purple-800 dark:text-purple-300 mb-1">
                    نسبة المعلم (%) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={teacherPercentage}
                    onChange={(e) => {
                      const val = Math.min(100, Math.max(0, Number(e.target.value)));
                      setTeacherPercentage(val);
                    }}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1">نسبة السنتر المحسوبة (%)</label>
                  <input
                    type="number"
                    readOnly
                    value={centerPercentage}
                    className="w-full px-3 py-2 text-sm font-mono font-bold bg-muted border border-border rounded-xl opacity-90 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-lg text-[11px] flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>نسبة التقاسم متطابقة بنسبة 100% دون تسريب كسور ({teacherPercentage}% + {centerPercentage}%)</span>
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-border flex items-center justify-end gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold px-5"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'حفظ أسعار التعاقد'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
