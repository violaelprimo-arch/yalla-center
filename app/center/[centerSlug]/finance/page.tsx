'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wallet,
  CreditCard,
  Receipt,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Printer,
  Download,
  Search,
  Filter,
  Plus,
  X,
  Lock,
  FileText,
  DollarSign,
  Layers,
  Package,
  Clock,
  Sparkles,
  RefreshCw,
  Coins,
  Eye,
  TrendingUp,
  TrendingDown,
  Building2,
  UserCheck,
  ArrowDownLeft,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getDataProvider } from '@/lib/dal/factory';
import {
  User,
  Group,
  Subject,
  Branch,
  Invoice,
  Payment,
  CashierShift,
  TeacherPayroll,
  TeacherMonthlyStatement,
  Expense,
  BookInventoryItem,
  PaymentMethod,
  DiscountType,
  InvoiceStatus,
  PayrollStatus,
} from '@/lib/dal/types';
import { calculateDiscount } from '@/lib/finance/discounts';
import {
  numberToArabicWords,
  generatePayrollCSV,
  downloadCSV,
  TeacherPayrollExportRecord,
} from '@/lib/finance/export';
import { BrandLogo } from '@/components/brand/brand-logo';

type TabKey = 'shifts' | 'invoices' | 'payments' | 'payroll' | 'expenses';

export default function FinancePage() {
  const { tenant, branches, currentUser, currentRole } = useTenant();
  const dal = useMemo(() => getDataProvider(), []);

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabKey>('shifts');

  // Core Data States
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [activeShift, setActiveShift] = useState<CashierShift | null>(null);
  const [allShifts, setAllShifts] = useState<CashierShift[]>([]);
  const [payrollList, setPayrollList] = useState<TeacherPayroll[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [books, setBooks] = useState<BookInventoryItem[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Filters
  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('all');
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [payrollMonthFilter, setPayrollMonthFilter] = useState<number>(10);
  const [payrollYearFilter, setPayrollYearFilter] = useState<number>(2026);

  // Modals
  const [isOpenShiftModalOpen, setIsOpenShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const [isRecordPaymentModalOpen, setIsRecordPaymentModalOpen] = useState(false);
  const [selectedInvoiceForPayment, setSelectedInvoiceForPayment] = useState<Invoice | null>(null);
  const [isCreateInvoiceModalOpen, setIsCreateInvoiceModalOpen] = useState(false);
  const [isRecordExpenseModalOpen, setIsRecordExpenseModalOpen] = useState(false);
  const [isPrintableReceiptOpen, setIsPrintableReceiptOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<Payment | null>(null);
  const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
  const [statementData, setStatementData] = useState<TeacherMonthlyStatement | null>(null);
  const [isStatementLoading, setIsStatementLoading] = useState(false);

  // AC-6 RBAC Security
  const isTeacherRole = currentRole === 'TEACHER';

  // Load All Finance Data
  const loadFinanceData = useCallback(async () => {
    setIsLoading(true);
    setActionError(null);
    try {
      const [
        fetchedInvoices,
        fetchedPayments,
        fetchedShift,
        fetchedAllShifts,
        fetchedPayroll,
        fetchedExpenses,
        fetchedBooks,
        fetchedStudents,
        fetchedTeachers,
        fetchedGroups,
        fetchedSubjects,
      ] = await Promise.all([
        dal.getInvoices(tenant.id),
        dal.getPayments(tenant.id),
        dal.getActiveCashierShift(tenant.id),
        dal.getCashierShifts(tenant.id),
        dal.getTeacherPayroll(tenant.id),
        dal.getExpenses(tenant.id),
        dal.getBooksInventory(tenant.id),
        dal.getUsers(tenant.id, { role: 'STUDENT' }),
        dal.getUsers(tenant.id, { role: 'TEACHER' }),
        dal.getGroups(tenant.id),
        dal.getSubjects(tenant.id),
      ]);

      setInvoices(fetchedInvoices);
      setPayments(fetchedPayments);
      setActiveShift(fetchedShift);
      setAllShifts(fetchedAllShifts);
      setPayrollList(fetchedPayroll);
      setExpenses(fetchedExpenses);
      setBooks(fetchedBooks);
      setStudents(fetchedStudents);
      setTeachers(fetchedTeachers);
      setGroups(fetchedGroups);
      setSubjects(fetchedSubjects);
    } catch (err: any) {
      console.error('Failed to load finance data:', err);
      setActionError(err?.message || 'تعذر تحميل البيانات المالية');
    } finally {
      setIsLoading(false);
    }
  }, [dal, tenant.id]);

  useEffect(() => {
    loadFinanceData();
  }, [loadFinanceData]);

  // Lookup maps for fast rendering
  const studentMap = useMemo(() => {
    const map = new Map<string, User>();
    students.forEach((s) => map.set(s.id, s));
    return map;
  }, [students]);

  const teacherMap = useMemo(() => {
    const map = new Map<string, User>();
    teachers.forEach((t) => map.set(t.id, t));
    return map;
  }, [teachers]);

  const groupMap = useMemo(() => {
    const map = new Map<string, Group>();
    groups.forEach((g) => map.set(g.id, g));
    return map;
  }, [groups]);

  const subjectMap = useMemo(() => {
    const map = new Map<string, Subject>();
    subjects.forEach((s) => map.set(s.id, s));
    return map;
  }, [subjects]);

  const branchMap = useMemo(() => {
    const map = new Map<string, Branch>();
    branches.forEach((b) => map.set(b.id, b));
    return map;
  }, [branches]);

  // Top KPI Ribbon Calculations
  const kpiData = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.netAmount, 0);
    const totalCollected = payments.reduce((sum, pay) => sum + pay.amountPaid, 0);
    const totalOutstanding = invoices.reduce((sum, inv) => {
      const remaining = Math.max(0, inv.netAmount - inv.paidAmount);
      return sum + remaining;
    }, 0);
    const currentDrawerExpected = activeShift?.expectedCash ?? 0;
    return {
      totalInvoiced,
      totalCollected,
      totalOutstanding,
      currentDrawerExpected,
    };
  }, [invoices, payments, activeShift]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (invoiceStatusFilter !== 'all' && inv.status !== invoiceStatusFilter) return false;
      if (invoiceSearch.trim()) {
        const q = invoiceSearch.trim().toLowerCase();
        const student = studentMap.get(inv.studentId);
        const studentName = student?.fullName?.toLowerCase() || '';
        const studentCode = student?.studentCode?.toLowerCase() || '';
        const invNum = inv.invoiceNumber?.toLowerCase() || '';
        if (!studentName.includes(q) && !studentCode.includes(q) && !invNum.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, invoiceStatusFilter, invoiceSearch, studentMap]);

  // Filtered Payments
  const filteredPayments = useMemo(() => {
    return payments.filter((pay) => {
      if (paymentMethodFilter !== 'all' && pay.paymentMethod !== paymentMethodFilter) return false;
      if (paymentSearch.trim()) {
        const q = paymentSearch.trim().toLowerCase();
        const student = studentMap.get(pay.studentId);
        const studentName = student?.fullName?.toLowerCase() || '';
        const recNum = pay.receiptNumber?.toLowerCase() || '';
        if (!studentName.includes(q) && !recNum.includes(q)) return false;
      }
      return true;
    });
  }, [payments, paymentMethodFilter, paymentSearch, studentMap]);

  // Filtered Payroll (AC-6: Teachers see only their own)
  const filteredPayroll = useMemo(() => {
    return payrollList.filter((p) => {
      if (isTeacherRole && p.teacherId !== currentUser.id) return false;
      if (p.payrollMonth !== payrollMonthFilter) return false;
      if (p.payrollYear !== payrollYearFilter) return false;
      return true;
    });
  }, [payrollList, isTeacherRole, currentUser.id, payrollMonthFilter, payrollYearFilter]);

  // Handle Export Payroll to CSV
  const handleExportPayroll = () => {
    const exportRecords: TeacherPayrollExportRecord[] = filteredPayroll.map((p) => {
      const teacher = teacherMap.get(p.teacherId);
      return {
        teacherName: teacher?.fullName || 'معلم غير محدد',
        month: p.payrollMonth,
        year: p.payrollYear,
        conductedSessions: p.conductedSessions,
        totalAttendance: p.totalAttendance,
        averageAttendance: p.averageAttendance,
        calculatedCompensation: p.calculatedCompensation,
        bonuses: p.bonuses,
        deductions: p.deductions,
        netPayroll: p.netPayroll,
        status:
          p.status === 'approved'
            ? 'معتمد'
            : p.status === 'paid'
            ? 'مسدد'
            : p.status === 'reviewed'
            ? 'تمت المراجعـة'
            : 'مسودة',
      };
    });

    const csv = generatePayrollCSV(exportRecords);
    const filename = `كشف_مرتبات_المعلمين_${payrollMonthFilter}_${payrollYearFilter}`;
    downloadCSV(filename, csv);
    setActionSuccess('تم تصدير كشف المرتبات بنجاح بصيغة CSV المتوافقة مع Excel');
  };

  // View Teacher Monthly Statement
  const handleViewStatement = async (teacherId: string, month: number, year: number) => {
    setIsStatementLoading(true);
    setIsStatementModalOpen(true);
    try {
      const stmt = await dal.calculateMonthlyTeacherPayroll({
        tenantId: tenant.id,
        teacherId,
        month,
        year,
      });
      setStatementData(stmt);
    } catch (err: any) {
      console.error('Error fetching statement:', err);
      setActionError(err?.message || 'تعذر حساب كشف الحساب التفصيلي للمعلم');
      setIsStatementModalOpen(false);
    } finally {
      setIsStatementLoading(false);
    }
  };

  // Approve Payroll Action
  const handleApprovePayroll = async (payrollId: string) => {
    if (isTeacherRole) return;
    try {
      const res = await dal.approveTeacherPayroll(payrollId, currentUser.id, currentRole);
      if (res.success && res.data) {
        setPayrollList((prev) =>
          prev.map((item) => (item.id === payrollId ? res.data! : item))
        );
        setActionSuccess('تم اعتماد كشف الراتب بنجاح');
      } else {
        setActionError(res.error || 'تعذر اعتماد الكشف');
      }
    } catch (err: any) {
      setActionError(err?.message || 'حدث خطأ أثناء اعتماد الكشف');
    }
  };

  // Disburse Payroll Action
  const handleDisbursePayroll = async (payrollId: string) => {
    if (isTeacherRole) return;
    try {
      const res = await dal.disburseTeacherPayroll(payrollId, 'cash', currentUser.id, currentRole);
      if (res.success && res.data) {
        setPayrollList((prev) =>
          prev.map((item) => (item.id === payrollId ? res.data! : item))
        );
        setActionSuccess('تم صرف الراتب وتسجيله كمسدد بنجاح');
      } else {
        setActionError(res.error || 'تعذر صرف الراتب');
      }
    } catch (err: any) {
      setActionError(err?.message || 'حدث خطأ أثناء صرف الراتب');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2">
            <Wallet className="w-8 h-8 text-brand-cyan-600" />
            <span>الخزينة والمالية وحسابات المعلمين</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            إدارة الورديات، إصدار الفواتير، التحصيلات، كشوف مرتبات المعلمين، ومتابعة جرد المذكرات لـ {tenant.nameAr}.
          </p>
        </div>

        {/* Global Action Buttons */}
        {!isTeacherRole && (
          <div className="flex flex-wrap items-center gap-2">
            {activeShift ? (
              <Button
                variant="outline"
                className="border-amber-500/30 text-amber-600 hover:bg-amber-500/10 text-xs font-bold"
                onClick={() => setIsCloseShiftModalOpen(true)}
              >
                <Coins className="w-4 h-4 ml-1.5" />
                إغلاق الوردية وجرد الخزينة
              </Button>
            ) : (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                onClick={() => setIsOpenShiftModalOpen(true)}
              >
                <Sparkles className="w-4 h-4 ml-1.5" />
                فتح وردية كاشير جديدة
              </Button>
            )}

            <Button
              className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold"
              onClick={() => {
                setSelectedInvoiceForPayment(null);
                setIsRecordPaymentModalOpen(true);
              }}
            >
              <CreditCard className="w-4 h-4 ml-1.5" />
              تحصيل نقدية سريع
            </Button>

            <Button
              variant="outline"
              className="text-xs font-bold"
              onClick={() => setIsCreateInvoiceModalOpen(true)}
            >
              <Plus className="w-4 h-4 ml-1.5" />
              إصدار فاتورة
            </Button>

            <Button
              variant="ghost"
              className="text-xs font-bold text-muted-foreground hover:text-foreground"
              onClick={() => setIsRecordExpenseModalOpen(true)}
            >
              <ArrowDownLeft className="w-4 h-4 ml-1.5" />
              تسجيل مصروف
            </Button>
          </div>
        )}
      </div>

      {/* AC-6 Security Lockout Banner */}
      {isTeacherRole && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-center gap-3 text-amber-700 dark:text-amber-400">
          <Lock className="w-5 h-5 shrink-0 text-amber-600" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">وضع استعراض المعلم (صلاحيات مالية مقيدة): </span>
            يمكنك فقط استعراض كشف حسابك ومستحقاتك الشهرية الشخصية. لا تتاح لك صلاحيات إدارة ورديات الخزينة أو الاطلاع على فواتير ومصروفات السنتر.
          </div>
        </div>
      )}

      {/* Notifications / Alerts */}
      {actionSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {actionError && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 p-3 rounded-xl flex items-center justify-between text-xs sm:text-sm animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top 4 Elevated KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Invoiced */}
        <Card className="card-elevated border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground">إجمالي المطالبات والفواتير</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-foreground">
              {kpiData.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">صافي قيمة الاشتراكات المفوترة</p>
          </CardContent>
        </Card>

        {/* Card 2: Actual Collected */}
        <Card className="card-elevated border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground">إجمالي المتحصلات الفعلية</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
              {kpiData.totalCollected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">المقبوضات النقدية والإلكترونية</p>
          </CardContent>
        </Card>

        {/* Card 3: Outstanding Receivables */}
        <Card className="card-elevated border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground">المتأخرات والمستحقات</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400">
              {kpiData.totalOutstanding.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-normal text-muted-foreground">ج.م</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">متبقي على ذمة الطلاب</p>
          </CardContent>
        </Card>

        {/* Card 4: Active Drawer State */}
        <Card className="card-elevated border-border bg-card/60 backdrop-blur-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-bold text-muted-foreground">رصيد الدرج النشط</CardTitle>
            <div className="w-8 h-8 rounded-lg bg-brand-cyan-500/10 text-brand-cyan-600 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-xl sm:text-2xl font-black text-brand-cyan-600 dark:text-brand-cyan-400">
                {activeShift ? (
                  <>
                    {kpiData.currentDrawerExpected.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{' '}
                    <span className="text-xs font-normal text-muted-foreground">ج.م</span>
                  </>
                ) : (
                  <span className="text-muted-foreground text-sm font-bold">مغلقة</span>
                )}
              </div>
              <Badge variant={activeShift ? 'cyan' : 'default'} className="text-[10px]">
                {activeShift ? 'وردية نشطة' : 'لا يوجد وردية'}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">النقدية الفعلية المتوقعة بالخزينة</p>
          </CardContent>
        </Card>
      </div>

      {/* Main 5 Navigation Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {!isTeacherRole && (
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'shifts'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Coins className="w-4 h-4" />
              الورديات والخزينة
              {activeShift && (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse mr-1" />
              )}
            </button>
          )}

          {!isTeacherRole && (
            <button
              onClick={() => setActiveTab('invoices')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'invoices'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <FileText className="w-4 h-4" />
              الفواتير والمطالبات
              <Badge variant="default" className="mr-1 text-[10px] px-1.5 py-0">
                {invoices.length}
              </Badge>
            </button>
          )}

          {!isTeacherRole && (
            <button
              onClick={() => setActiveTab('payments')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'payments'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Receipt className="w-4 h-4" />
              إيصالات السداد والمقبوضات
              <Badge variant="default" className="mr-1 text-[10px] px-1.5 py-0">
                {payments.length}
              </Badge>
            </button>
          )}

          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'payroll'
                ? 'bg-brand-cyan-600 text-white shadow-sm'
                : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <DollarSign className="w-4 h-4" />
            حسابات وكشوف المعلمين
          </button>

          {!isTeacherRole && (
            <button
              onClick={() => setActiveTab('expenses')}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all whitespace-nowrap ${
                activeTab === 'expenses'
                  ? 'bg-brand-cyan-600 text-white shadow-sm'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Layers className="w-4 h-4" />
              المصروفات وجرد الكتب
            </button>
          )}
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading ? (
        <div className="card-elevated p-12 text-center rounded-2xl border border-border">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-cyan-600 mb-3" />
          <p className="text-sm text-muted-foreground">جاري تحميل السجلات والعمليات المالية...</p>
        </div>
      ) : (
        <>
          {/* ========================================================================= */}
          {/* TAB 1: الورديات والخزينة (Cashier Shifts & Cash Drawer HUD)              */}
          {/* ========================================================================= */}
          {activeTab === 'shifts' && !isTeacherRole && (
            <div className="space-y-6">
              {/* Active Shift HUD Banner */}
              {activeShift ? (
                <div className="card-elevated p-6 rounded-2xl border-2 border-brand-cyan-500/30 bg-gradient-to-l from-brand-cyan-500/5 via-card to-card">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                        <Coins className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-bold text-foreground">وردية الخزينة الحالية (الدرج مفتوح)</h2>
                          <Badge variant="cyan" className="text-[11px] animate-pulse">
                            نشطة الآن
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          تاريخ الفتح: {new Date(activeShift.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} — مسؤول الخزينة:{' '}
                          <span className="font-semibold text-foreground">
                            {currentUser.fullName}
                          </span>
                        </p>
                      </div>
                    </div>

                    <Button
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs"
                      onClick={() => setIsCloseShiftModalOpen(true)}
                    >
                      <Coins className="w-4 h-4 ml-1.5" />
                      إغلاق الوردية وجرد الدرج
                    </Button>
                  </div>

                  {/* Cashier Shift Metrics Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 pt-4">
                    <div className="bg-muted/30 p-3 rounded-xl border border-border">
                      <span className="text-[11px] text-muted-foreground block">عهدة البداية (Float)</span>
                      <span className="text-base sm:text-lg font-black text-foreground">
                        {activeShift.openingCash.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="bg-emerald-500/5 p-3 rounded-xl border border-emerald-500/20">
                      <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block">+ مقبوضات نقدية</span>
                      <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {activeShift.cashCollected.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="bg-blue-500/5 p-3 rounded-xl border border-blue-500/20">
                      <span className="text-[11px] text-blue-600 dark:text-blue-400 block">+ مقبوضات إلكترونية</span>
                      <span className="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400">
                        {activeShift.digitalCollected.toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="bg-rose-500/5 p-3 rounded-xl border border-rose-500/20">
                      <span className="text-[11px] text-rose-600 dark:text-rose-400 block">- مصروفات نقدية</span>
                      <span className="text-base sm:text-lg font-black text-rose-600 dark:text-rose-400">
                        {(activeShift.cashDisbursed || 0).toFixed(2)} ج.م
                      </span>
                    </div>

                    <div className="bg-brand-cyan-500/10 p-3 rounded-xl border-2 border-brand-cyan-500/40 col-span-2 sm:col-span-1">
                      <span className="text-[11px] text-brand-cyan-700 dark:text-brand-cyan-300 font-bold block">
                        = النقدية المتوقعة بالدرج
                      </span>
                      <span className="text-lg sm:text-xl font-black text-brand-cyan-700 dark:text-brand-cyan-300">
                        {activeShift.expectedCash.toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="card-elevated p-8 rounded-2xl border border-border text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto text-2xl">
                    <Coins className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">لا توجد وردية كاشير نشطة حالياً</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                      الخزينة النقدية مغلقة. لبدء تحصيل الاشتراكات نقداً وإجراء المصروفات، يرجى فتح وردية جديدة وتحديد رصيد العهدة الافتتاحية.
                    </p>
                  </div>
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    onClick={() => setIsOpenShiftModalOpen(true)}
                  >
                    <Sparkles className="w-4 h-4 ml-1.5" />
                    فتح وردية كاشير جديدة الآن
                  </Button>
                </div>
              )}

              {/* Historical Shifts Archive & Reconciliation Table */}
              <Card className="card-elevated border-border">
                <CardHeader>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-brand-cyan-600" />
                    <span>أرشيف الورديات وجرد الخزينة (المطابقة والعجز)</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border font-bold">
                        <tr>
                          <th className="py-3 px-4">رقم الوردية</th>
                          <th className="py-3 px-4">تاريخ الفتح والإغلاق</th>
                          <th className="py-3 px-4">العهدة</th>
                          <th className="py-3 px-4">نقدية محصلة</th>
                          <th className="py-3 px-4">مصروفات</th>
                          <th className="py-3 px-4">المتوقع</th>
                          <th className="py-3 px-4">الفعلي</th>
                          <th className="py-3 px-4">الفارق (العجز/الزيادة)</th>
                          <th className="py-3 px-4">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {allShifts.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-8 text-center text-muted-foreground">
                              لا توجد ورديات مسجلة حتى الآن.
                            </td>
                          </tr>
                        ) : (
                          allShifts.map((shift) => {
                            const isShiftOpen = shift.status === 'open';
                            const diff = shift.cashDifference ?? 0;
                            return (
                              <tr key={shift.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-brand-cyan-600">
                                  {shift.id.slice(-8)}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  <div>{new Date(shift.openedAt).toLocaleDateString('ar-EG')}</div>
                                  <div className="text-[10px]">
                                    {new Date(shift.openedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                    {shift.closedAt && ` ← ${new Date(shift.closedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`}
                                  </div>
                                </td>
                                <td className="py-3 px-4 font-mono">{shift.openingCash.toFixed(2)} ج.م</td>
                                <td className="py-3 px-4 font-mono text-emerald-600">+{shift.cashCollected.toFixed(2)}</td>
                                <td className="py-3 px-4 font-mono text-rose-600">-{(shift.cashDisbursed || 0).toFixed(2)}</td>
                                <td className="py-3 px-4 font-mono font-bold">{shift.expectedCash.toFixed(2)} ج.م</td>
                                <td className="py-3 px-4 font-mono font-bold">
                                  {shift.actualCash != null ? `${shift.actualCash.toFixed(2)} ج.م` : '—'}
                                </td>
                                <td className="py-3 px-4">
                                  {isShiftOpen ? (
                                    <span className="text-muted-foreground text-[11px]">—</span>
                                  ) : diff === 0 ? (
                                    <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                      مطابقة تامة (0.00)
                                    </Badge>
                                  ) : diff < 0 ? (
                                    <Badge variant="default" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                                      عجز ({Math.abs(diff).toFixed(2)} ج.م)
                                    </Badge>
                                  ) : (
                                    <Badge variant="default" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                                      زيادة (+{diff.toFixed(2)} ج.م)
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 px-4">
                                  <Badge variant={isShiftOpen ? 'cyan' : 'default'} className="text-[10px]">
                                    {isShiftOpen ? 'مفتوحة' : 'مغلقة ومؤكدة'}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: الفواتير والمطالبات (Student Invoices & Receivables)                */}
          {/* ========================================================================= */}
          {activeTab === 'invoices' && !isTeacherRole && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="بحث برقم الفاتورة أو اسم الطالب أو الكود..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
                    />
                  </div>

                  <select
                    value={invoiceStatusFilter}
                    onChange={(e) => setInvoiceStatusFilter(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
                  >
                    <option value="all">جميع الحالات</option>
                    <option value="pending">مستحقة بالكامل (Pending)</option>
                    <option value="partially_paid">مسددة جزئياً (Partially Paid)</option>
                    <option value="paid">مسددة بالكامل (Paid)</option>
                  </select>
                </div>

                <Button
                  className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold shrink-0"
                  onClick={() => setIsCreateInvoiceModalOpen(true)}
                >
                  <Plus className="w-4 h-4 ml-1.5" />
                  إصدار فاتورة جديدة
                </Button>
              </div>

              {/* Invoices Table */}
              <Card className="card-elevated border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border font-bold">
                        <tr>
                          <th className="py-3 px-4">رقم الفاتورة</th>
                          <th className="py-3 px-4">الطالب</th>
                          <th className="py-3 px-4">المجموعة الدراسية</th>
                          <th className="py-3 px-4">الشهر / السنة</th>
                          <th className="py-3 px-4">الإجمالي</th>
                          <th className="py-3 px-4">الخصم</th>
                          <th className="py-3 px-4">الصافي</th>
                          <th className="py-3 px-4">المسدد</th>
                          <th className="py-3 px-4">المتبقي</th>
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-4 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {filteredInvoices.length === 0 ? (
                          <tr>
                            <td colSpan={11} className="py-8 text-center text-muted-foreground">
                              لا توجد فواتير مطابقة لمعايير البحث الحالية.
                            </td>
                          </tr>
                        ) : (
                          filteredInvoices.map((inv) => {
                            const student = studentMap.get(inv.studentId);
                            const group = inv.groupId ? groupMap.get(inv.groupId) : undefined;
                            const remaining = Math.max(0, inv.netAmount - inv.paidAmount);
                            const isPaid = inv.status === 'paid' || remaining <= 0;

                            return (
                              <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-brand-cyan-600">
                                  {inv.invoiceNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-foreground">{student?.fullName || 'طالب غير محدد'}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{student?.studentCode}</div>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {group?.nameAr || '—'}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground font-mono">
                                  {inv.billingMonth} / {inv.billingYear}
                                </td>
                                <td className="py-3 px-4 font-mono">{inv.totalAmount.toFixed(2)}</td>
                                <td className="py-3 px-4 font-mono text-muted-foreground">
                                  {inv.discountAmount > 0 ? `-${inv.discountAmount.toFixed(2)}` : '0.00'}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-foreground">
                                  {inv.netAmount.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4 font-mono text-emerald-600 font-bold">
                                  {inv.paidAmount.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-rose-600">
                                  {remaining.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4">
                                  {isPaid ? (
                                    <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                      مسددة بالكامل
                                    </Badge>
                                  ) : inv.status === 'partially_paid' ? (
                                    <Badge variant="default" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                                      مسددة جزئياً
                                    </Badge>
                                  ) : (
                                    <Badge variant="default" className="bg-rose-500/10 text-rose-600 border-rose-500/20 text-[10px]">
                                      مستحقة
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  {!isPaid && (
                                    <Button
                                      size="sm"
                                      className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-[11px] h-7 px-2.5 font-bold"
                                      onClick={() => {
                                        setSelectedInvoiceForPayment(inv);
                                        setIsRecordPaymentModalOpen(true);
                                      }}
                                    >
                                      تحصيل
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
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 3: إيصالات السداد والمقبوضات (Payment Receipts Ledger)                */}
          {/* ========================================================================= */}
          {activeTab === 'payments' && !isTeacherRole && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-wrap items-center gap-2 flex-1">
                  <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="بحث برقم الإيصال أو اسم الطالب..."
                      value={paymentSearch}
                      onChange={(e) => setPaymentSearch(e.target.value)}
                      className="w-full bg-background border border-border rounded-xl pr-9 pl-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
                    />
                  </div>

                  <select
                    value={paymentMethodFilter}
                    onChange={(e) => setPaymentMethodFilter(e.target.value)}
                    className="bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
                  >
                    <option value="all">جميع وسائل الدفع</option>
                    <option value="cash">نقداً بالخزينة (Cash)</option>
                    <option value="vodafone_cash">فودافون كاش (Vodafone)</option>
                    <option value="instapay">إنستاباي (InstaPay)</option>
                    <option value="card">بطاقة بنكية / فيزا (Card)</option>
                    <option value="fawry">فوري (Fawry)</option>
                  </select>
                </div>
              </div>

              {/* Payments Receipts Table */}
              <Card className="card-elevated border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border font-bold">
                        <tr>
                          <th className="py-3 px-4">رقم الإيصال</th>
                          <th className="py-3 px-4">الطالب</th>
                          <th className="py-3 px-4">المبلغ المسدد</th>
                          <th className="py-3 px-4">وسيلة الدفع</th>
                          <th className="py-3 px-4">تاريخ وساعة السداد</th>
                          <th className="py-3 px-4">ملاحظات</th>
                          <th className="py-3 px-4 text-center">طباعة الإيصال</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {filteredPayments.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 text-center text-muted-foreground">
                              لا توجد إيصالات سداد مسجلة حتى الآن.
                            </td>
                          </tr>
                        ) : (
                          filteredPayments.map((pay) => {
                            const student = studentMap.get(pay.studentId);
                            return (
                              <tr key={pay.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-brand-cyan-600">
                                  {pay.receiptNumber}
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-foreground">{student?.fullName || 'طالب غير محدد'}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{student?.studentCode}</div>
                                </td>
                                <td className="py-3 px-4 font-mono font-black text-emerald-600 text-sm">
                                  {pay.amountPaid.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4">
                                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted text-[11px]">
                                    {pay.paymentMethod === 'cash' ? '💵 نقداً' :
                                     pay.paymentMethod === 'vodafone_cash' ? '📱 فودافون كاش' :
                                     pay.paymentMethod === 'instapay' ? '⚡ إنستاباي' :
                                     pay.paymentMethod === 'card' ? '💳 بطاقة بنكية' : '🧾 فوري'}
                                  </span>
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {new Date(pay.paidAt).toLocaleDateString('ar-EG')} - {new Date(pay.paidAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {pay.notes || '—'}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-[11px] h-7 px-2.5 font-bold"
                                    onClick={() => {
                                      setSelectedPaymentForReceipt(pay);
                                      setIsPrintableReceiptOpen(true);
                                    }}
                                  >
                                    <Printer className="w-3.5 h-3.5 ml-1" />
                                    عرض وطباعة
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 4: حسابات وكشوف المعلمين (Teacher Payroll & Dual Compensation Engine) */}
          {/* ========================================================================= */}
          {activeTab === 'payroll' && (
            <div className="space-y-4">
              {/* Filter & Export Bar */}
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">الشهر:</span>
                    <select
                      value={payrollMonthFilter}
                      onChange={(e) => setPayrollMonthFilter(Number(e.target.value))}
                      className="bg-transparent font-bold outline-none"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
                        <option key={m} value={m}>
                          شهر {m}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 bg-background border border-border rounded-xl px-3 py-1.5 text-xs">
                    <span className="text-muted-foreground">السنة:</span>
                    <select
                      value={payrollYearFilter}
                      onChange={(e) => setPayrollYearFilter(Number(e.target.value))}
                      className="bg-transparent font-bold outline-none"
                    >
                      {[2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {!isTeacherRole && (
                  <Button
                    variant="outline"
                    className="border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10 text-xs font-bold"
                    onClick={handleExportPayroll}
                  >
                    <Download className="w-4 h-4 ml-1.5" />
                    تصدير كشف المرتبات إلى Excel (CSV مع BOM)
                  </Button>
                )}
              </div>

              {/* Payroll Records Table */}
              <Card className="card-elevated border-border">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead className="bg-muted/50 text-muted-foreground border-b border-border font-bold">
                        <tr>
                          <th className="py-3 px-4">المعلم</th>
                          <th className="py-3 px-4">الحصص المنفذة</th>
                          <th className="py-3 px-4">إجمالي الحضور</th>
                          <th className="py-3 px-4">متوسط الحضور</th>
                          <th className="py-3 px-4">المستحق المحسوب</th>
                          <th className="py-3 px-4">المكافآت</th>
                          <th className="py-3 px-4">السلف والخصومات</th>
                          <th className="py-3 px-4">صافي الراتب المستحق</th>
                          <th className="py-3 px-4">الحالة</th>
                          <th className="py-3 px-4 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border font-medium">
                        {filteredPayroll.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="py-8 text-center text-muted-foreground">
                              لا توجد كشوف مرتبات مسجلة لشهر {payrollMonthFilter} / {payrollYearFilter}.
                            </td>
                          </tr>
                        ) : (
                          filteredPayroll.map((p) => {
                            const teacher = teacherMap.get(p.teacherId);
                            const isApproved = p.status === 'approved';
                            const isPaid = p.status === 'paid';

                            return (
                              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4">
                                  <div className="font-bold text-foreground">{teacher?.fullName || 'معلم غير محدد'}</div>
                                  <div className="text-[10px] text-muted-foreground font-mono">{teacher?.phone}</div>
                                </td>
                                <td className="py-3 px-4 font-mono">{p.conductedSessions} حصص</td>
                                <td className="py-3 px-4 font-mono">{p.totalAttendance} طالب</td>
                                <td className="py-3 px-4 font-mono text-muted-foreground">
                                  {p.averageAttendance.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 font-mono font-bold text-foreground">
                                  {p.calculatedCompensation.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4 font-mono text-emerald-600">
                                  +{p.bonuses.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 font-mono text-rose-600">
                                  -{p.deductions.toFixed(2)}
                                </td>
                                <td className="py-3 px-4 font-mono font-black text-brand-cyan-600 text-sm">
                                  {p.netPayroll.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4">
                                  {isPaid ? (
                                    <Badge variant="default" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                                      تم الصرف
                                    </Badge>
                                  ) : isApproved ? (
                                    <Badge variant="default" className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-[10px]">
                                      معتمد
                                    </Badge>
                                  ) : (
                                    <Badge variant="default" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px]">
                                      قيد المراجعة
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-3 px-4 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="text-[11px] h-7 px-2 font-bold"
                                      onClick={() => handleViewStatement(p.teacherId, p.payrollMonth, p.payrollYear)}
                                    >
                                      <Eye className="w-3.5 h-3.5 ml-1" />
                                      تفاصيل الكشف
                                    </Button>

                                    {!isTeacherRole && !isApproved && !isPaid && (
                                      <Button
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] h-7 px-2 font-bold"
                                        onClick={() => handleApprovePayroll(p.id)}
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5 ml-1" />
                                        اعتماد
                                      </Button>
                                    )}

                                    {!isTeacherRole && isApproved && !isPaid && (
                                      <Button
                                        size="sm"
                                        className="bg-blue-600 hover:bg-blue-700 text-white text-[11px] h-7 px-2 font-bold"
                                        onClick={() => handleDisbursePayroll(p.id)}
                                      >
                                        <CreditCard className="w-3.5 h-3.5 ml-1" />
                                        صرف
                                      </Button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 5: المصروفات وجرد الكتب (Operating Expenses & Textbook Inventory)    */}
          {/* ========================================================================= */}
          {activeTab === 'expenses' && !isTeacherRole && (
            <div className="space-y-6">
              {/* Top Sub-section: Operating Expenses */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ArrowDownLeft className="w-5 h-5 text-rose-600" />
                    <h2 className="text-base font-bold text-foreground">سجل المصروفات التشغيلية والنثريات</h2>
                  </div>
                  <Button
                    className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                    onClick={() => setIsRecordExpenseModalOpen(true)}
                  >
                    <Plus className="w-4 h-4 ml-1.5" />
                    تسجيل مصروف جديد
                  </Button>
                </div>

                <Card className="card-elevated border-border">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border font-bold">
                          <tr>
                            <th className="py-3 px-4">رقم القيد</th>
                            <th className="py-3 px-4">التاريخ</th>
                            <th className="py-3 px-4">البند والتصنيف</th>
                            <th className="py-3 px-4">البيان والشرح</th>
                            <th className="py-3 px-4">المبلغ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          {expenses.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-8 text-center text-muted-foreground">
                                لا توجد مصروفات مسجلة حتى الآن.
                              </td>
                            </tr>
                          ) : (
                            expenses.map((exp) => (
                              <tr key={exp.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-mono font-bold text-muted-foreground">
                                  {exp.id.slice(-6)}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {new Date(exp.createdAt).toLocaleDateString('ar-EG')}
                                </td>
                                <td className="py-3 px-4 font-bold text-foreground">
                                  {exp.category}
                                </td>
                                <td className="py-3 px-4 text-muted-foreground">
                                  {exp.description}
                                </td>
                                <td className="py-3 px-4 font-mono font-black text-rose-600 text-sm">
                                  {exp.amount.toFixed(2)} ج.م
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom Sub-section: Textbook & Material Inventory */}
              <div className="space-y-4 pt-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-brand-cyan-600" />
                  <h2 className="text-base font-bold text-foreground">جرد ومخزون المذكرات والكتب الدراسية</h2>
                </div>

                {/* Inventory KPI Summary */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card-elevated p-4 rounded-xl border border-border">
                    <span className="text-xs text-muted-foreground block">إجمالي النسخ المتوفرة</span>
                    <span className="text-xl font-black text-foreground">
                      {books.reduce((sum, b) => sum + b.quantityInStock, 0)} نسخة
                    </span>
                  </div>

                  <div className="card-elevated p-4 rounded-xl border border-border">
                    <span className="text-xs text-muted-foreground block">إجمالي رأس مال الطباعة</span>
                    <span className="text-xl font-black text-foreground">
                      {books.reduce((sum, b) => sum + b.unitCost * b.quantityInStock, 0).toFixed(2)} ج.م
                    </span>
                  </div>

                  <div className="card-elevated p-4 rounded-xl border border-border">
                    <span className="text-xs text-muted-foreground block">هامش الربح الإجمالي المتوقع</span>
                    <span className="text-xl font-black text-emerald-600">
                      {books
                        .reduce((sum, b) => sum + (b.sellingPrice - b.unitCost) * b.quantityInStock, 0)
                        .toFixed(2)}{' '}
                      ج.م
                    </span>
                  </div>
                </div>

                <Card className="card-elevated border-border">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead className="bg-muted/50 text-muted-foreground border-b border-border font-bold">
                          <tr>
                            <th className="py-3 px-4">عنوان المذكرة / الكتاب</th>
                            <th className="py-3 px-4">الصف والمرحلة</th>
                            <th className="py-3 px-4">تكلفة الطباعة</th>
                            <th className="py-3 px-4">سعر البيع للطالب</th>
                            <th className="py-3 px-4">الكمية بالمخزن</th>
                            <th className="py-3 px-4">هامش ربح النسخة</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border font-medium">
                          {books.map((b) => {
                            const profit = b.sellingPrice - b.unitCost;
                            const profitPercent = b.unitCost > 0 ? (profit / b.unitCost) * 100 : 0;
                            return (
                              <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                                <td className="py-3 px-4 font-bold text-foreground">{b.title}</td>
                                <td className="py-3 px-4 text-muted-foreground font-mono">{b.grade}</td>
                                <td className="py-3 px-4 font-mono">{b.unitCost.toFixed(2)} ج.م</td>
                                <td className="py-3 px-4 font-mono font-bold text-foreground">
                                  {b.sellingPrice.toFixed(2)} ج.م
                                </td>
                                <td className="py-3 px-4 font-mono font-bold">
                                  <Badge variant={b.quantityInStock > 10 ? 'default' : 'destructive'} className="text-[10px]">
                                    {b.quantityInStock} نسخة
                                  </Badge>
                                </td>
                                <td className="py-3 px-4 font-mono text-emerald-600 font-bold">
                                  +{profit.toFixed(2)} ج.م ({profitPercent.toFixed(0)}%)
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: Open Cashier Shift Modal                                         */}
      {/* ========================================================================= */}
      {isOpenShiftModalOpen && (
        <OpenCashierShiftModal
          branches={branches}
          currentUser={currentUser}
          onClose={() => setIsOpenShiftModalOpen(false)}
          onSuccess={(shift) => {
            setActiveShift(shift);
            setAllShifts((prev) => [shift, ...prev]);
            setIsOpenShiftModalOpen(false);
            setActionSuccess('تم فتح وردية الخزينة بنجاح وتسجيل عهدة البداية');
          }}
          dal={dal}
          tenantId={tenant.id}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: Close Cashier Shift & Drawer Reconciliation Modal                */}
      {/* ========================================================================= */}
      {isCloseShiftModalOpen && activeShift && (
        <CloseCashierShiftModal
          shift={activeShift}
          onClose={() => setIsCloseShiftModalOpen(false)}
          onSuccess={(closedShift) => {
            setActiveShift(null);
            setAllShifts((prev) =>
              prev.map((s) => (s.id === closedShift.id ? closedShift : s))
            );
            setIsCloseShiftModalOpen(false);
            setActionSuccess('تم إغلاق الوردية واعتماد جرد الخزينة بنجاح');
          }}
          dal={dal}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: Record Payment Modal (Partial / Full)                             */}
      {/* ========================================================================= */}
      {isRecordPaymentModalOpen && (
        <RecordPaymentModal
          invoices={invoices.filter((i) => i.status !== 'paid' && i.netAmount > i.paidAmount)}
          preselectedInvoice={selectedInvoiceForPayment}
          studentMap={studentMap}
          activeShift={activeShift}
          currentUser={currentUser}
          tenantId={tenant.id}
          dal={dal}
          onClose={() => {
            setIsRecordPaymentModalOpen(false);
            setSelectedInvoiceForPayment(null);
          }}
          onSuccess={(payment, updatedInvoice) => {
            setPayments((prev) => [payment, ...prev]);
            setInvoices((prev) =>
              prev.map((i) => (i.id === updatedInvoice.id ? updatedInvoice : i))
            );
            if (activeShift && payment.paymentMethod === 'cash') {
              setActiveShift((prev) =>
                prev
                  ? {
                      ...prev,
                      cashCollected: prev.cashCollected + payment.amountPaid,
                      expectedCash: prev.expectedCash + payment.amountPaid,
                    }
                  : null
              );
            }
            setIsRecordPaymentModalOpen(false);
            setSelectedInvoiceForPayment(null);
            setSelectedPaymentForReceipt(payment);
            setIsPrintableReceiptOpen(true);
            setActionSuccess('تم تسجيل عملية التحصيل وتحديث الفاتورة بنجاح');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: Issue Student Invoice Modal                                      */}
      {/* ========================================================================= */}
      {isCreateInvoiceModalOpen && (
        <CreateInvoiceModal
          students={students}
          groups={groups}
          tenantId={tenant.id}
          dal={dal}
          onClose={() => setIsCreateInvoiceModalOpen(false)}
          onSuccess={(invoice) => {
            setInvoices((prev) => [invoice, ...prev]);
            setIsCreateInvoiceModalOpen(false);
            setActionSuccess(`تم إصدار الفاتورة ${invoice.invoiceNumber} بنجاح`);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: Printable Receipt Voucher Modal                                  */}
      {/* ========================================================================= */}
      {isPrintableReceiptOpen && selectedPaymentForReceipt && (
        <PrintableReceiptModal
          payment={selectedPaymentForReceipt}
          invoice={invoices.find((i) => i.id === selectedPaymentForReceipt.invoiceId)}
          student={studentMap.get(selectedPaymentForReceipt.studentId)}
          tenant={tenant}
          cashierUser={currentUser}
          onClose={() => {
            setIsPrintableReceiptOpen(false);
            setSelectedPaymentForReceipt(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: Record Expense Modal                                             */}
      {/* ========================================================================= */}
      {isRecordExpenseModalOpen && (
        <RecordExpenseModal
          branches={branches}
          currentUser={currentUser}
          activeShift={activeShift}
          tenantId={tenant.id}
          dal={dal}
          onClose={() => setIsRecordExpenseModalOpen(false)}
          onSuccess={(expense) => {
            setExpenses((prev) => [expense, ...prev]);
            if (activeShift) {
              setActiveShift((prev) =>
                prev
                  ? {
                      ...prev,
                      cashDisbursed: (prev.cashDisbursed || 0) + expense.amount,
                      expectedCash: prev.expectedCash - expense.amount,
                    }
                  : null
              );
            }
            setIsRecordExpenseModalOpen(false);
            setActionSuccess('تم تسجيل المصروف بنجاح وخصمه من رصيد الخزينة');
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* MODAL 7: Teacher Detailed Statement Modal                                 */}
      {/* ========================================================================= */}
      {isStatementModalOpen && (
        <TeacherStatementModal
          statement={statementData}
          isLoading={isStatementLoading}
          onClose={() => {
            setIsStatementModalOpen(false);
            setStatementData(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT MODALS
// =============================================================================

/**
 * Modal 1: Open Cashier Shift
 */
function OpenCashierShiftModal({
  branches,
  currentUser,
  onClose,
  onSuccess,
  dal,
  tenantId,
}: {
  branches: Branch[];
  currentUser: User;
  onClose: () => void;
  onSuccess: (shift: CashierShift) => void;
  dal: any;
  tenantId: string;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [openingCash, setOpeningCash] = useState<number>(500);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (openingCash < 0) {
      setError('لا يمكن أن تكون العهدة الافتتاحية سالبة');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const shift = await dal.openCashierShift({
        tenantId,
        branchId,
        cashierUserId: currentUser.id,
        openingCash,
        notes: notes.trim() || undefined,
      });
      onSuccess(shift);
    } catch (err: any) {
      setError(err?.message || 'تعذر فتح وردية الكاشير');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Coins className="w-4 h-4 text-brand-cyan-600" />
            فتح وردية كاشير جديدة
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-2.5 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">الفرع</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">مسؤول الخزينة</label>
            <input
              type="text"
              readOnly
              value={currentUser.fullName}
              className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs text-muted-foreground outline-none cursor-not-allowed"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">
              عهدة الدرج الافتتاحية (جنيه مصري)
            </label>
            <input
              type="number"
              min="0"
              step="1"
              required
              value={openingCash}
              onChange={(e) => setOpeningCash(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-black focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
            <span className="text-[10px] text-muted-foreground block mt-1">
              النقدية والفكة المستلمة في درج الكاشير قبل بدء المعاملات.
            </span>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">ملاحظات الاستلام</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: استلام فئات 20 و 10 جنيهات..."
              className="w-full bg-background border border-border rounded-xl p-3 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
            >
              {isSubmitting ? 'جاري الفتح...' : 'تأكيد فتح الوردية'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal 2: Close Cashier Shift & Drawer Reconciliation
 */
function CloseCashierShiftModal({
  shift,
  onClose,
  onSuccess,
  dal,
}: {
  shift: CashierShift;
  onClose: () => void;
  onSuccess: (shift: CashierShift) => void;
  dal: any;
}) {
  const [actualCash, setActualCash] = useState<number>(shift.expectedCash);
  const [denominations, setDenominations] = useState<{ [key: string]: number }>({
    bill200: 0,
    bill100: 0,
    bill50: 0,
    bill20: 0,
    bill10: 0,
    bill5: 0,
    coins: 0,
  });
  const [useDenominations, setUseDenominations] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sum denominations if used
  const calculatedDenomSum = useMemo(() => {
    return (
      (denominations.bill200 || 0) * 200 +
      (denominations.bill100 || 0) * 100 +
      (denominations.bill50 || 0) * 50 +
      (denominations.bill20 || 0) * 20 +
      (denominations.bill10 || 0) * 10 +
      (denominations.bill5 || 0) * 5 +
      (denominations.coins || 0) * 1
    );
  }, [denominations]);

  const effectiveActualCash = useDenominations ? calculatedDenomSum : actualCash;
  const difference = Math.round((effectiveActualCash - shift.expectedCash) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (difference < 0 && !closingNotes.trim()) {
      setError('يوجد عجز نقدي بالخزينة. يلزم كتابة سبب العجز أو الملاحظة التوضيحية قبل الإغلاق.');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const closed = await dal.closeCashierShift({
        shiftId: shift.id,
        actualCash: effectiveActualCash,
        notes: closingNotes.trim() || undefined,
        denominations: useDenominations ? denominations : undefined,
      });
      onSuccess(closed);
    } catch (err: any) {
      setError(err?.message || 'تعذر إغلاق الوردية');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Coins className="w-4 h-4 text-amber-600" />
            إغلاق الوردية وجرد النقدية بالدرج
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-2.5 rounded-xl text-xs">
              {error}
            </div>
          )}

          {/* System Calculated Summary */}
          <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-2 text-xs">
            <div className="flex justify-between text-muted-foreground">
              <span>عهدة البداية:</span>
              <span className="font-mono">{shift.openingCash.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-emerald-600">
              <span>+ المقبوضات النقدية:</span>
              <span className="font-mono">+{shift.cashCollected.toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-rose-600">
              <span>- المصروفات النقدية:</span>
              <span className="font-mono">-{(shift.cashDisbursed || 0).toFixed(2)} ج.م</span>
            </div>
            <div className="flex justify-between text-foreground font-black pt-1 border-t border-border text-sm">
              <span>= النقدية المتوقعة دفترياً:</span>
              <span className="font-mono text-brand-cyan-600">{shift.expectedCash.toFixed(2)} ج.م</span>
            </div>
          </div>

          {/* Mode Switch: Direct or Denominations */}
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-muted-foreground">جرد النقدية الفعلي بالدرج</label>
            <button
              type="button"
              onClick={() => setUseDenominations(!useDenominations)}
              className="text-[11px] text-brand-cyan-600 hover:underline font-bold"
            >
              {useDenominations ? '← إدخال المبلغ الإجمالي مباشرة' : 'تفقيط الفئات النقدية (200، 100...) →'}
            </button>
          </div>

          {!useDenominations ? (
            <div>
              <input
                type="number"
                min="0"
                step="0.5"
                required
                value={actualCash}
                onChange={(e) => setActualCash(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-base font-black focus:ring-1 focus:ring-brand-cyan-500 outline-none"
              />
            </div>
          ) : (
            <div className="space-y-2 border border-border p-3 rounded-xl bg-muted/20">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground block">فئة 200 ج.م</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations.bill200 || ''}
                    onChange={(e) => setDenominations({ ...denominations, bill200: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">فئة 100 ج.م</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations.bill100 || ''}
                    onChange={(e) => setDenominations({ ...denominations, bill100: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">فئة 50 ج.م</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations.bill50 || ''}
                    onChange={(e) => setDenominations({ ...denominations, bill50: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">فئة 20 ج.م</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations.bill20 || ''}
                    onChange={(e) => setDenominations({ ...denominations, bill20: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">فئة 10 ج.م</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations.bill10 || ''}
                    onChange={(e) => setDenominations({ ...denominations, bill10: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground block">فكة ومعدن</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={denominations.coins || ''}
                    onChange={(e) => setDenominations({ ...denominations, coins: Number(e.target.value) })}
                    className="w-full bg-background border border-border rounded-lg p-1.5 text-center font-bold"
                  />
                </div>
              </div>
              <div className="text-right text-xs pt-1 font-bold">
                المجموع الفعلي المحسوب: <span className="text-brand-cyan-600">{calculatedDenomSum.toFixed(2)} ج.م</span>
              </div>
            </div>
          )}

          {/* Live Reactive Variance Detection Banner */}
          <div
            className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
              difference === 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                : difference < 0
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400'
                : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {difference === 0 ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>مطابقة تامة — لا يوجد عجز أو زيادة بالدرج</span>
                </>
              ) : difference < 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>يوجد عجز نقدي بالخزينة بقيمة {Math.abs(difference).toFixed(2)} ج.م</span>
                </>
              ) : (
                <>
                  <Coins className="w-4 h-4 text-amber-600" />
                  <span>يوجد فائض نقدي غير مقيد بقيمة {difference.toFixed(2)} ج.م</span>
                </>
              )}
            </div>
            <span className="font-mono text-sm">{difference.toFixed(2)} ج.م</span>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">
              ملاحظات الإغلاق {difference < 0 && <span className="text-rose-500">* (مطلوبة لتبرير العجز)</span>}
            </label>
            <textarea
              rows={2}
              value={closingNotes}
              onChange={(e) => setClosingNotes(e.target.value)}
              placeholder="اكتب أي ملاحظات حول جرد الوردية..."
              className="w-full bg-background border border-border rounded-xl p-3 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
            >
              {isSubmitting ? 'جاري الإغلاق...' : 'تأكيد إغلاق الوردية والجرد'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal 3: Record Payment Modal
 */
function RecordPaymentModal({
  invoices,
  preselectedInvoice,
  studentMap,
  activeShift,
  currentUser,
  tenantId,
  dal,
  onClose,
  onSuccess,
}: {
  invoices: Invoice[];
  preselectedInvoice: Invoice | null;
  studentMap: Map<string, User>;
  activeShift: CashierShift | null;
  currentUser: User;
  tenantId: string;
  dal: any;
  onClose: () => void;
  onSuccess: (payment: Payment, updatedInvoice: Invoice) => void;
}) {
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    preselectedInvoice?.id || invoices[0]?.id || ''
  );
  const targetInvoice = useMemo(() => {
    return invoices.find((i) => i.id === selectedInvoiceId) || null;
  }, [invoices, selectedInvoiceId]);

  const remainingBalance = targetInvoice
    ? Math.max(0, targetInvoice.netAmount - targetInvoice.paidAmount)
    : 0;

  const [amountPaid, setAmountPaid] = useState<number>(remainingBalance);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-sync amount when target invoice changes
  useEffect(() => {
    if (targetInvoice) {
      setAmountPaid(Math.max(0, targetInvoice.netAmount - targetInvoice.paidAmount));
    }
  }, [targetInvoice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetInvoice) {
      setError('يرجى اختيار فاتورة صالحة للتحصيل');
      return;
    }
    if (amountPaid <= 0) {
      setError('يجب أن يكون المبلغ المسدد أكبر من الصفر');
      return;
    }
    if (amountPaid > remainingBalance) {
      setError(`المبلغ المسدد (${amountPaid} ج.م) يتجاوز الرصيد المتبقي على الفاتورة (${remainingBalance} ج.م)`);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const res = await dal.recordPayment({
        tenantId,
        invoiceId: targetInvoice.id,
        amountPaid,
        paymentMethod,
        cashierUserId: currentUser.id,
        shiftId: activeShift?.id,
        notes: notes.trim() || undefined,
      });

      onSuccess(res.payment, res.updatedInvoice);
    } catch (err: any) {
      setError(err?.message || 'تعذر تسجيل عملية التحصيل');
    } finally {
      setIsSubmitting(false);
    }
  };

  const student = targetInvoice ? studentMap.get(targetInvoice.studentId) : null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-cyan-600" />
            تحصيل نقدية وإصدار إيصال سداد
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-2.5 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">الفاتورة المستهدفة</label>
            <select
              value={selectedInvoiceId}
              onChange={(e) => setSelectedInvoiceId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            >
              {invoices.length === 0 ? (
                <option value="">لا توجد فواتير معلقة</option>
              ) : (
                invoices.map((inv) => {
                  const s = studentMap.get(inv.studentId);
                  const rem = inv.netAmount - inv.paidAmount;
                  return (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber} — {s?.fullName} ({rem.toFixed(2)} ج.م متبقي)
                    </option>
                  );
                })
              )}
            </select>
          </div>

          {targetInvoice && student && (
            <div className="bg-muted/30 p-3.5 rounded-xl border border-border space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الطالب:</span>
                <span className="font-bold text-foreground">{student.fullName} ({student.studentCode})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">صافي الفاتورة:</span>
                <span className="font-mono">{targetInvoice.netAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المسدد سابقاً:</span>
                <span className="font-mono text-emerald-600">{targetInvoice.paidAmount.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-rose-600 font-bold pt-1 border-t border-border">
                <span>الرصيد المتبقي المستحق:</span>
                <span className="font-mono text-sm">{remainingBalance.toFixed(2)} ج.م</span>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-muted-foreground">المبلغ المسدد الآن (ج.م)</label>
              {targetInvoice && (
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmountPaid(remainingBalance)}
                    className="text-[10px] text-brand-cyan-600 hover:underline font-bold"
                  >
                    سداد كامل المتبقي
                  </button>
                  <span className="text-muted-foreground text-[10px]">•</span>
                  <button
                    type="button"
                    onClick={() => setAmountPaid(Math.round(remainingBalance / 2))}
                    className="text-[10px] text-brand-cyan-600 hover:underline font-bold"
                  >
                    سداد النصف
                  </button>
                </div>
              )}
            </div>
            <input
              type="number"
              min="1"
              max={remainingBalance}
              step="1"
              required
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-base font-black text-brand-cyan-600 focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1.5">طريقة الدفع</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {[
                { id: 'cash', label: '💵 نقداً بالخزينة' },
                { id: 'vodafone_cash', label: '📱 فودافون كاش' },
                { id: 'instapay', label: '⚡ إنستاباي' },
                { id: 'card', label: '💳 بطاقة بنكية' },
                { id: 'fawry', label: '🧾 فوري' },
              ].map((m) => (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-center ${
                    paymentMethod === m.id
                      ? 'border-brand-cyan-600 bg-brand-cyan-500/10 text-brand-cyan-700 dark:text-brand-cyan-300'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">ملاحظات السداد (اختياري)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: رقم تحويل فودافون كاش أو إيداع..."
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !targetInvoice}
              className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold"
            >
              {isSubmitting ? 'جاري التحصيل...' : 'تأكيد السداد وطباعة الإيصال'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal 4: Issue Student Invoice Modal
 */
function CreateInvoiceModal({
  students,
  groups,
  tenantId,
  dal,
  onClose,
  onSuccess,
}: {
  students: User[];
  groups: Group[];
  tenantId: string;
  dal: any;
  onClose: () => void;
  onSuccess: (invoice: Invoice) => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [groupId, setGroupId] = useState(groups[0]?.id || '');
  const [billingMonth, setBillingMonth] = useState(10);
  const [billingYear, setBillingYear] = useState(2026);
  const [grossPrice, setGrossPrice] = useState(300);
  const [discountType, setDiscountType] = useState<DiscountType>('none');
  const [discountValue, setDiscountValue] = useState(0);
  const [dueDate, setDueDate] = useState('2026-10-31');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-fill price when group changes
  useEffect(() => {
    const selectedGroup = groups.find((g) => g.id === groupId);
    if (selectedGroup) {
      setGrossPrice(selectedGroup.monthlyFee || selectedGroup.sessionFee || 300);
    }
  }, [groupId, groups]);

  // Live discount calculation
  const discountCalc = useMemo(() => {
    return calculateDiscount({
      basePrice: grossPrice,
      discountType,
      discountValue,
    });
  }, [grossPrice, discountType, discountValue]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) {
      setError('يرجى تحديد الطالب');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      const invoice = await dal.createInvoice({
        tenantId,
        studentId,
        groupId: groupId || undefined,
        totalAmount: grossPrice,
        discountType,
        discountValue,
        billingMonth,
        billingYear,
        dueDate,
      });
      onSuccess(invoice);
    } catch (err: any) {
      setError(err?.message || 'تعذر إصدار الفاتورة');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <Plus className="w-4 h-4 text-brand-cyan-600" />
            إصدار فاتورة اشتراك جديدة
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-2.5 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">الطالب</label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.studentCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">المجموعة الدراسية</label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
              >
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.nameAr} ({g.monthlyFee} ج.م)
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">الشهر</label>
              <input
                type="number"
                min="1"
                max="12"
                value={billingMonth}
                onChange={(e) => setBillingMonth(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl p-2 text-xs text-center font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">السنة</label>
              <input
                type="number"
                min="2025"
                max="2030"
                value={billingYear}
                onChange={(e) => setBillingYear(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl p-2 text-xs text-center font-bold"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">تاريخ الاستحقاق</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full bg-background border border-border rounded-xl p-2 text-xs text-center"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">المبلغ الأساسي (ج.م)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={grossPrice}
                onChange={(e) => setGrossPrice(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl p-2 text-xs font-black"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">نوع الخصم</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as DiscountType)}
                className="w-full bg-background border border-border rounded-xl p-2 text-xs"
              >
                <option value="none">بدون خصم (None)</option>
                <option value="percentage">نسبة مئوية (%)</option>
                <option value="fixed">مبلغ ثابت (Fixed EGP)</option>
                <option value="free_100">منحة كاملة (100% Free)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">قيمة الخصم</label>
              <input
                type="number"
                min="0"
                disabled={discountType === 'none' || discountType === 'free_100'}
                value={discountValue}
                onChange={(e) => setDiscountValue(Number(e.target.value))}
                className="w-full bg-background border border-border rounded-xl p-2 text-xs font-bold disabled:bg-muted disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Live Discount Calculation Summary */}
          <div className="bg-brand-cyan-500/10 p-3 rounded-xl border border-brand-cyan-500/30 flex items-center justify-between text-xs">
            <div>
              <span className="text-muted-foreground block">إجمالي الخصم المحسوب:</span>
              <span className="font-bold text-foreground font-mono">
                {discountCalc.discountAmount.toFixed(2)} ج.م ({discountCalc.effectiveDiscountPercentage}%)
              </span>
            </div>
            <div className="text-left">
              <span className="text-brand-cyan-700 dark:text-brand-cyan-300 font-bold block">
                صافي الفاتورة المستحق:
              </span>
              <span className="font-black text-brand-cyan-700 dark:text-brand-cyan-300 text-base font-mono">
                {discountCalc.netPrice.toFixed(2)} ج.م
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-cyan-600 hover:bg-brand-cyan-700 text-white text-xs font-bold"
            >
              {isSubmitting ? 'جاري الإصدار...' : 'إصدار الفاتورة'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal 5: Printable Receipt Voucher
 */
function PrintableReceiptModal({
  payment,
  invoice,
  student,
  tenant,
  cashierUser,
  onClose,
}: {
  payment: Payment;
  invoice?: Invoice;
  student?: User;
  tenant: any;
  cashierUser: User;
  onClose: () => void;
}) {
  const handlePrint = () => {
    if (typeof window !== 'undefined') {
      window.print();
    }
  };

  const remainingBalance = invoice
    ? Math.max(0, invoice.netAmount - invoice.paidAmount)
    : 0;

  const priorPaid = invoice
    ? Math.max(0, invoice.paidAmount - payment.amountPaid)
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white text-neutral-900 border border-neutral-300 w-full max-w-2xl rounded-2xl shadow-2xl p-6 sm:p-8 space-y-6 animate-scale-up print:p-0 print:border-none print:shadow-none print:w-full print:max-w-none" dir="rtl">
        {/* Modal Controls (Hidden in Print) */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 print:hidden">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold text-sm text-neutral-800">معاينة إيصال السداد الرسمي للطباعة</h3>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
              <Printer className="w-4 h-4 ml-1.5" />
              طباعة الإيصال الآن
            </Button>
            <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 p-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Voucher Sheet */}
        <div className="p-4 sm:p-6 border border-neutral-300 rounded-xl space-y-6 bg-white">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4 border-neutral-200">
            <div>
              <BrandLogo theme="light" width={140} height={35} />
              <div className="mt-2 text-xs font-bold text-neutral-800">{tenant.nameAr}</div>
              <div className="text-[10px] text-neutral-500">المركز التعليمي المعتمد — نظام الخزينة الرقمية</div>
            </div>

            <div className="text-left font-mono">
              <div className="text-xs font-bold text-neutral-800">رقم الإيصال: {payment.receiptNumber}</div>
              <div className="text-[10px] text-neutral-500">الفاتورة: {invoice?.invoiceNumber || '—'}</div>
              <div className="text-[10px] text-neutral-500">
                التاريخ: {new Date(payment.paidAt).toLocaleDateString('ar-EG')} -{' '}
                {new Date(payment.paidAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-lg font-black text-neutral-900 tracking-wide">إيصال استلام نقدية رسمي</h2>
            <p className="text-[11px] text-neutral-500">Official Payment Receipt Voucher</p>
          </div>

          {/* Student & Academic Info */}
          <div className="grid grid-cols-2 gap-3 bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
            <div>
              <span className="text-neutral-500 block text-[10px]">اسم الطالب:</span>
              <span className="font-bold text-neutral-900">{student?.fullName || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">كود الطالب:</span>
              <span className="font-mono font-bold text-neutral-900">{student?.studentCode || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">الصف والمرحلة:</span>
              <span className="text-neutral-800">{student?.grade || '—'}</span>
            </div>
            <div>
              <span className="text-neutral-500 block text-[10px]">طريقة الدفع:</span>
              <span className="font-bold text-neutral-900">
                {payment.paymentMethod === 'cash' ? 'نقداً بالخزينة' :
                 payment.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' :
                 payment.paymentMethod === 'instapay' ? 'إنستاباي' :
                 payment.paymentMethod === 'card' ? 'بطاقة بنكية' : 'فوري'}
              </span>
            </div>
          </div>

          {/* Itemized Financial Table */}
          <table className="w-full text-xs text-right border-collapse border border-neutral-200">
            <thead className="bg-neutral-100 text-neutral-700 font-bold">
              <tr>
                <th className="py-2 px-3 border border-neutral-200">البيان</th>
                <th className="py-2 px-3 border border-neutral-200 text-left">المبلغ بالجنيه المصري</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200">
              <tr>
                <td className="py-2 px-3 border border-neutral-200">إجمالي قيمة الاشتراك المفوتر</td>
                <td className="py-2 px-3 border border-neutral-200 text-left font-mono">
                  {invoice?.totalAmount.toFixed(2) || payment.amountPaid.toFixed(2)} ج.م
                </td>
              </tr>
              {invoice && invoice.discountAmount > 0 && (
                <tr>
                  <td className="py-2 px-3 border border-neutral-200">الخصم المعتمد</td>
                  <td className="py-2 px-3 border border-neutral-200 text-left font-mono text-neutral-600">
                    -{invoice.discountAmount.toFixed(2)} ج.م
                  </td>
                </tr>
              )}
              {invoice && (
                <tr>
                  <td className="py-2 px-3 border border-neutral-200">صافي المستحق الأصلي</td>
                  <td className="py-2 px-3 border border-neutral-200 text-left font-mono">
                    {invoice.netAmount.toFixed(2)} ج.م
                  </td>
                </tr>
              )}
              {priorPaid > 0 && (
                <tr>
                  <td className="py-2 px-3 border border-neutral-200">المسدد سابقاً</td>
                  <td className="py-2 px-3 border border-neutral-200 text-left font-mono text-neutral-600">
                    {priorPaid.toFixed(2)} ج.م
                  </td>
                </tr>
              )}
              <tr className="bg-emerald-50 font-black text-emerald-900">
                <td className="py-2 px-3 border border-neutral-200">المبلغ المسدد الآن بموجب هذا الإيصال</td>
                <td className="py-2 px-3 border border-neutral-200 text-left font-mono text-sm">
                  {payment.amountPaid.toFixed(2)} ج.م
                </td>
              </tr>
              <tr>
                <td className="py-2 px-3 border border-neutral-200 font-bold">المتبقي على ذمة الطالب</td>
                <td className="py-2 px-3 border border-neutral-200 text-left font-mono font-bold text-neutral-800">
                  {remainingBalance.toFixed(2)} ج.م
                </td>
              </tr>
            </tbody>
          </table>

          {/* Tafqeet (Arabic Words) */}
          <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-xs">
            <span className="text-neutral-500 font-bold ml-1">المبلغ بالحروف:</span>
            <span className="font-bold text-neutral-900">{numberToArabicWords(payment.amountPaid)}</span>
          </div>

          {/* Signatures */}
          <div className="grid grid-cols-2 gap-8 pt-6 border-t border-neutral-200 text-center text-xs">
            <div>
              <span className="block text-neutral-500 mb-6">مسؤول الخزينة والاستلام</span>
              <span className="font-bold text-neutral-800 border-b border-neutral-400 pb-1">
                {cashierUser.fullName}
              </span>
            </div>
            <div>
              <span className="block text-neutral-500 mb-6">توقيع المستلم / ولي الأمر</span>
              <span className="text-neutral-400">...................................................</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-neutral-400 pt-2">
            هذا الإيصال سند مالي رسمي مستخرج إلكترونياً من منصة سنتر الماهر التعليمي. يرجى الاحتفاظ به.
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal 6: Record Expense Modal
 */
function RecordExpenseModal({
  branches,
  currentUser,
  activeShift,
  tenantId,
  dal,
  onClose,
  onSuccess,
}: {
  branches: Branch[];
  currentUser: User;
  activeShift: CashierShift | null;
  tenantId: string;
  dal: any;
  onClose: () => void;
  onSuccess: (expense: Expense) => void;
}) {
  const [branchId, setBranchId] = useState(branches[0]?.id || '');
  const [category, setCategory] = useState('أدوات ومستلزمات مكتبية');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number>(50);
  const [deductFromShift, setDeductFromShift] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('يجب أن يكون مبلغ المصروف أكبر من الصفر');
      return;
    }
    if (!description.trim()) {
      setError('يرجى كتابة بيان المصروف');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const expense = await dal.recordExpense({
        tenantId,
        branchId,
        category,
        description: description.trim(),
        amount,
        createdByUserId: currentUser.id,
        shiftId: deductFromShift && activeShift ? activeShift.id : undefined,
      });
      onSuccess(expense);
    } catch (err: any) {
      setError(err?.message || 'تعذر تسجيل المصروف');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-card border border-border w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up" dir="rtl">
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-rose-600" />
            تسجيل مصروفات تشغيلية ونثريات
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-2.5 rounded-xl text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">الفرع</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nameAr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">بند المصروف</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            >
              <option value="أدوات ومستلزمات مكتبية">أدوات ومستلزمات مكتبية وأوراق</option>
              <option value="صيانة وتشغيل">صيانة وتشغيل أجهزة وقاعات</option>
              <option value="ضيافة واستقبال">ضيافة واستقبال وبوفيه</option>
              <option value="نظافة ومطهرات">نظافة ومطهرات</option>
              <option value="مواصلات ونثريات">مواصلات ونثريات سريعة</option>
              <option value="أخرى">مصروفات أخرى</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">البيان والشرح</label>
            <textarea
              rows={2}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="مثال: شراء أقلام سبورة وأوراق طباعة امتحانات..."
              className="w-full bg-background border border-border rounded-xl p-3 text-xs focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-muted-foreground block mb-1">المبلغ (جنيه مصري)</label>
            <input
              type="number"
              min="1"
              step="1"
              required
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-sm font-black text-rose-600 focus:ring-1 focus:ring-brand-cyan-500 outline-none"
            />
          </div>

          {activeShift && (
            <label className="flex items-center gap-2 p-2.5 rounded-xl border border-border bg-muted/20 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={deductFromShift}
                onChange={(e) => setDeductFromShift(e.target.checked)}
                className="w-4 h-4 rounded text-brand-cyan-600"
              />
              <span className="font-bold text-foreground">
                خصم فوري من نقدية الوردية المفتوحة بالخزينة (الدرج)
              </span>
            </label>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-xs">
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
            >
              {isSubmitting ? 'جاري الحفظ...' : 'تسجيل المصروف'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Modal 7: Teacher Monthly Detailed Statement Modal
 */
function TeacherStatementModal({
  statement,
  isLoading,
  onClose,
}: {
  statement: TeacherMonthlyStatement | null;
  isLoading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up space-y-4 p-6" dir="rtl">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-cyan-600" />
            <h3 className="font-bold text-foreground text-sm sm:text-base">
              كشف الحساب والمستحقات التفصيلي للمعلم
            </h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        {isLoading || !statement ? (
          <div className="py-12 text-center text-muted-foreground">
            <RefreshCw className="w-7 h-7 animate-spin mx-auto text-brand-cyan-600 mb-2" />
            <p className="text-xs">جاري تجميع بيانات الحضور والحصص وحساب النسب الرياضية...</p>
          </div>
        ) : (
          <div className="space-y-6 text-xs">
            {/* Header Metadata */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border">
              <div>
                <span className="text-muted-foreground block text-[10px]">المعلم:</span>
                <span className="font-bold text-foreground">{statement.teacherName}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">المواد:</span>
                <span className="font-bold text-foreground">{statement.subjectNames.join('، ')}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">الشهر / السنة:</span>
                <span className="font-mono font-bold text-foreground">
                  {statement.payrollMonth} / {statement.payrollYear}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">صافي الراتب المستحق:</span>
                <span className="font-mono font-black text-brand-cyan-600 text-sm">
                  {statement.summary.netPayrollInvoiced.toFixed(2)} ج.م
                </span>
              </div>
            </div>

            {/* Part 1: Center Subscription Model Breakdown */}
            {statement.centerSubscription.groups.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-brand-cyan-600" />
                  مجموعات اشتراك السنتر (المعدل الثابت لكل طالب بالحصة)
                </h4>
                <table className="w-full text-right border-collapse border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted/50 text-muted-foreground font-bold">
                    <tr>
                      <th className="p-2 border border-border">المجموعة</th>
                      <th className="p-2 border border-border">الفئة للرأس</th>
                      <th className="p-2 border border-border">الحصص</th>
                      <th className="p-2 border border-border">إجمالي الحضور</th>
                      <th className="p-2 border border-border">متوسط الحضور</th>
                      <th className="p-2 border border-border">المستحق المحسوب</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.centerSubscription.groups.map((g) => (
                      <tr key={g.groupId} className="hover:bg-muted/20">
                        <td className="p-2 border border-border font-bold">{g.groupName}</td>
                        <td className="p-2 border border-border font-mono">{g.ratePerStudent.toFixed(2)} ج.م</td>
                        <td className="p-2 border border-border font-mono">{g.conductedSessionsCount}</td>
                        <td className="p-2 border border-border font-mono">{g.totalValidAttendance}</td>
                        <td className="p-2 border border-border font-mono">{g.averageAttendance.toFixed(2)}</td>
                        <td className="p-2 border border-border font-mono font-bold text-emerald-600">
                          {g.compensationAmount.toFixed(2)} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Part 2: Private Lessons Model Breakdown */}
            {statement.privateLessons.groups.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  مجموعات الدروس الخاصة (نسبة المعلم من صافي الإيراد)
                </h4>
                <table className="w-full text-right border-collapse border border-border rounded-lg overflow-hidden">
                  <thead className="bg-muted/50 text-muted-foreground font-bold">
                    <tr>
                      <th className="p-2 border border-border">المجموعة</th>
                      <th className="p-2 border border-border">الطلاب</th>
                      <th className="p-2 border border-border">الإجمالي</th>
                      <th className="p-2 border border-border">الخصومات</th>
                      <th className="p-2 border border-border">صافي الإيراد</th>
                      <th className="p-2 border border-border">نسبة المعلم</th>
                      <th className="p-2 border border-border">حصة المعلم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.privateLessons.groups.map((g) => (
                      <tr key={g.groupId} className="hover:bg-muted/20">
                        <td className="p-2 border border-border font-bold">{g.groupName}</td>
                        <td className="p-2 border border-border font-mono">{g.enrolledCount}</td>
                        <td className="p-2 border border-border font-mono">{g.totalGrossInvoiced.toFixed(2)}</td>
                        <td className="p-2 border border-border font-mono text-muted-foreground">
                          -{g.totalDiscountAmount.toFixed(2)}
                        </td>
                        <td className="p-2 border border-border font-mono font-bold">{g.totalNetRevenue.toFixed(2)}</td>
                        <td className="p-2 border border-border font-mono font-bold text-brand-cyan-600">
                          {g.teacherPercentage}%
                        </td>
                        <td className="p-2 border border-border font-mono font-bold text-emerald-600">
                          {g.totalTeacherShare.toFixed(2)} ج.م
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Part 3: Advances and Deductions */}
            <div className="bg-muted/20 p-3.5 rounded-xl border border-border space-y-2">
              <h4 className="font-bold text-foreground text-xs">التسويات والاستقطاعات:</h4>
              <div className="flex justify-between text-muted-foreground">
                <span>إجمالي المستحق من الحصص والمجموعات:</span>
                <span className="font-mono font-bold text-foreground">
                  {statement.summary.grossCompensation.toFixed(2)} ج.م
                </span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>- السلف النقدية المستردة من الراتب:</span>
                <span className="font-mono">-{statement.summary.totalAdvances.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>- الخصومات والجزاءات:</span>
                <span className="font-mono">-{statement.summary.totalDeductions.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-emerald-600">
                <span>+ المكافآت التشجيعية:</span>
                <span className="font-mono">+{statement.summary.totalBonuses.toFixed(2)} ج.م</span>
              </div>
              <div className="flex justify-between text-brand-cyan-600 font-black text-sm pt-2 border-t border-border">
                <span>= صافي الراتب النهائي المستحق للصرف:</span>
                <span className="font-mono">{statement.summary.netPayrollInvoiced.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose} className="text-xs font-bold">
            إغلاق
          </Button>
        </div>
      </div>
    </div>
  );
}
