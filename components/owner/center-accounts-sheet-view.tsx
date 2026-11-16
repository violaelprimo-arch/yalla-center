'use client';

import React, { useState, useMemo } from 'react';
import {
  FileSpreadsheet,
  Search,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Plus,
  CreditCard,
  RefreshCw,
  Download,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SaasPlatformService } from '@/lib/saas/service';
import { CenterAccountSummaryRow, CenterExtended } from '@/lib/saas/types';
import { downloadFinancialExcelFile } from '@/lib/saas/excel-export';
import { CenterFinancialModal } from './center-financial-modal';

const ALL_COLUMNS = [
  { id: 'seq', label: 'م', defaultVisible: true },
  { id: 'centerNameAr', label: 'اسم السنتر', defaultVisible: true },
  { id: 'adminName', label: 'مسؤول السنتر', defaultVisible: true },
  { id: 'adminPhone', label: 'رقم الهاتف', defaultVisible: true },
  { id: 'planNameAr', label: 'الباقة', defaultVisible: true },
  { id: 'billingFrequency', label: 'نوع الاشتراك', defaultVisible: true },
  { id: 'subscriptionStartDate', label: 'بداية الاشتراك', defaultVisible: false },
  { id: 'subscriptionEndDate', label: 'نهاية الاشتراك', defaultVisible: false },
  { id: 'totalInvoiced', label: 'إجمالي الفواتير (ج.م)', defaultVisible: true },
  { id: 'totalDiscounts', label: 'الخصومات (ج.م)', defaultVisible: true },
  { id: 'netDue', label: 'صافي المستحق (ج.م)', defaultVisible: true },
  { id: 'totalPaid', label: 'إجمالي المدفوع (ج.م)', defaultVisible: true },
  { id: 'remainingBalance', label: 'المتبقي (ج.م)', defaultVisible: true },
  { id: 'creditBalance', label: 'الرصيد الدائن (ج.م)', defaultVisible: false },
  { id: 'lastPaymentDate', label: 'آخر دفعة', defaultVisible: true },
  { id: 'nextDueDate', label: 'موعد الاستحقاق', defaultVisible: true },
  { id: 'paymentStatus', label: 'حالة الدفع', defaultVisible: true },
  { id: 'subscriptionStatus', label: 'حالة الاشتراك', defaultVisible: true },
  { id: 'actions', label: 'الإجراءات', defaultVisible: true },
];

export function CenterAccountsSheetView({
  onRefresh,
}: {
  onRefresh?: () => void;
}) {
  const [rows, setRows] = useState<CenterAccountSummaryRow[]>(() =>
    SaasPlatformService.getCenterAccountsSheet()
  );

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [subStatusFilter, setSubStatusFilter] = useState('all');
  const [payStatusFilter, setPayStatusFilter] = useState('all');
  const [startDateFilter, setStartDateFilter] = useState('');
  const [endDateFilter, setEndDateFilter] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [balanceOnly, setBalanceOnly] = useState(false);
  const [expiringSoonOnly, setExpiringSoonOnly] = useState(false);

  // Sorting
  const [sortColumn, setSortColumn] = useState<string>('seq');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Column Visibility
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((col) => {
      init[col.id] = col.defaultVisible;
    });
    return init;
  });
  const [isColumnPickerOpen, setIsColumnPickerOpen] = useState(false);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Center Financial Drawer
  const [selectedCenter, setSelectedCenter] = useState<CenterExtended | null>(null);

  const reloadData = () => {
    setRows(SaasPlatformService.getCenterAccountsSheet());
    onRefresh?.();
  };

  // Handle Sort
  const handleSort = (colId: string) => {
    if (sortColumn === colId) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(colId);
      setSortDirection('asc');
    }
  };

  // Filter & Sort Logic
  const filteredAndSortedRows = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const msIn30Days = 30 * 86400000;

    const filtered = rows.filter((row) => {
      // Search
      const matchSearch =
        !searchQuery ||
        row.centerNameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.adminName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.adminPhone.includes(searchQuery);

      if (!matchSearch) return false;

      // Plan
      if (planFilter !== 'all' && row.planTier !== planFilter) return false;

      // Subscription Status
      if (subStatusFilter !== 'all' && row.subscriptionStatus !== subStatusFilter) return false;

      // Payment Status
      if (payStatusFilter !== 'all' && row.paymentStatus !== payStatusFilter) return false;

      // Date Range
      if (startDateFilter && row.subscriptionStartDate < startDateFilter) return false;
      if (endDateFilter && row.subscriptionEndDate > endDateFilter) return false;

      // Quick Toggles
      if (overdueOnly && row.paymentStatus !== 'overdue' && row.nextDueDate >= today) return false;
      if (balanceOnly && row.remainingBalance <= 0) return false;
      if (expiringSoonOnly) {
        const diff = new Date(row.subscriptionEndDate).getTime() - Date.now();
        if (diff < 0 || diff > msIn30Days) return false;
      }

      return true;
    });

    // Sort
    return filtered.sort((a, b) => {
      const aVal = (a as any)[sortColumn];
      const bVal = (b as any)[sortColumn];
      if (aVal === bVal) return 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const strA = String(aVal || '');
      const strB = String(bVal || '');
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
  }, [
    rows,
    searchQuery,
    planFilter,
    subStatusFilter,
    payStatusFilter,
    startDateFilter,
    endDateFilter,
    overdueOnly,
    balanceOnly,
    expiringSoonOnly,
    sortColumn,
    sortDirection,
  ]);

  // Totals calculations
  const totals = useMemo(() => {
    let totalInvoiced = 0;
    let totalDiscounts = 0;
    let netDue = 0;
    let totalPaid = 0;
    let remainingBalance = 0;
    let creditBalance = 0;

    filteredAndSortedRows.forEach((r) => {
      totalInvoiced += r.totalInvoiced;
      totalDiscounts += r.totalDiscounts;
      netDue += r.netDue;
      totalPaid += r.totalPaid;
      remainingBalance += r.remainingBalance;
      creditBalance += r.creditBalance;
    });

    return {
      totalInvoiced: Math.round(totalInvoiced * 100) / 100,
      totalDiscounts: Math.round(totalDiscounts * 100) / 100,
      netDue: Math.round(netDue * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      remainingBalance: Math.round(remainingBalance * 100) / 100,
      creditBalance: Math.round(creditBalance * 100) / 100,
    };
  }, [filteredAndSortedRows]);

  // Paginated Rows
  const totalPages = Math.ceil(filteredAndSortedRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  // Open Center Modal
  const openCenterLedger = (tenantId: string) => {
    const centers = SaasPlatformService.getCenters();
    const c = centers.find((item) => item.id === tenantId || item.slug === tenantId);
    if (c) setSelectedCenter(c);
  };

  const getSortIcon = (colId: string) => {
    if (sortColumn !== colId) return <ArrowUpDown className="w-3 h-3 text-muted-foreground/60" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-brand-cyan-500" />
    ) : (
      <ArrowDown className="w-3 h-3 text-brand-cyan-500" />
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Top Controls Toolbar */}
      <Card className="card-elevated border-border">
        <CardContent className="p-4 space-y-3">
          {/* Row 1: Search, Export & Column Picker */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ابحث باسم السنتر، المسؤول، أو رقم الهاتف..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              {/* Column picker toggle */}
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsColumnPickerOpen(!isColumnPickerOpen)}
                  className="text-xs font-bold gap-1.5 h-9"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>الأعمدة ({Object.values(visibleColumns).filter(Boolean).length})</span>
                </Button>

                {isColumnPickerOpen && (
                  <div className="absolute left-0 mt-2 z-30 w-64 p-3 rounded-2xl bg-card border border-border shadow-2xl text-xs space-y-2">
                    <div className="flex items-center justify-between pb-2 border-b border-border font-bold">
                      <span>اختيار الأعمدة الظاهرة</span>
                      <button
                        type="button"
                        onClick={() => setIsColumnPickerOpen(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1.5 custom-scrollbar">
                      {ALL_COLUMNS.map((col) => (
                        <label key={col.id} className="flex items-center gap-2 cursor-pointer hover:bg-muted/30 p-1 rounded">
                          <input
                            type="checkbox"
                            checked={!!visibleColumns[col.id]}
                            onChange={(e) =>
                              setVisibleColumns({
                                ...visibleColumns,
                                [col.id]: e.target.checked,
                              })
                            }
                            className="rounded border-border"
                          />
                          <span>{col.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Direct Excel Download of Current View */}
              <Button
                type="button"
                variant="cyan"
                size="sm"
                onClick={() =>
                  downloadFinancialExcelFile({
                    mode: 'filtered',
                    filteredRows: filteredAndSortedRows,
                    filenamePrefix: 'Yalla_Center_Accounts_Sheet',
                  })
                }
                className="text-xs font-bold gap-1.5 h-9 shadow-soft-sm bg-emerald-600 hover:bg-emerald-700 text-white"
                title="تصدير شيت Excel كامل يتضمن 6 شيتات منسقة ومطابقة للأرقام"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>تصدير Excel للبيانات ({filteredAndSortedRows.length})</span>
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={reloadData}
                className="h-9 px-2.5 text-xs text-muted-foreground"
                title="إعادة تحميل البيانات"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Row 2: Select Filters & Quick Toggles */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs">
            {/* Plan Filter */}
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 px-2.5 rounded-xl border border-border bg-background text-[11px] font-bold"
            >
              <option value="all">كافة الباقات</option>
              <option value="starter">باقة البداية (Starter)</option>
              <option value="pro">باقة المحترفين (Pro)</option>
              <option value="enterprise">باقة المؤسسات (Enterprise)</option>
            </select>

            {/* Subscription Status Filter */}
            <select
              value={subStatusFilter}
              onChange={(e) => {
                setSubStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 px-2.5 rounded-xl border border-border bg-background text-[11px] font-bold"
            >
              <option value="all">كافة حالات الاشتراك</option>
              <option value="active">نشط</option>
              <option value="trial">تجريبي</option>
              <option value="suspended">موقوف</option>
            </select>

            {/* Payment Status Filter */}
            <select
              value={payStatusFilter}
              onChange={(e) => {
                setPayStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-8 px-2.5 rounded-xl border border-border bg-background text-[11px] font-bold"
            >
              <option value="all">كافة حالات الدفع</option>
              <option value="paid">مدفوع بالكامل</option>
              <option value="partial">سداد جزئي</option>
              <option value="overdue">متأخر</option>
              <option value="unpaid">غير مدفوع</option>
            </select>

            {/* Quick Filter Toggles */}
            <button
              type="button"
              onClick={() => {
                setOverdueOnly(!overdueOnly);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                overdueOnly
                  ? 'bg-rose-500/20 border-rose-500/40 text-rose-600 dark:text-rose-400'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              المتأخرات فقط ⚠️
            </button>

            <button
              type="button"
              onClick={() => {
                setBalanceOnly(!balanceOnly);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                balanceOnly
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-600 dark:text-amber-400'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              سناتر عليها مبالغ متبقية
            </button>

            <button
              type="button"
              onClick={() => {
                setExpiringSoonOnly(!expiringSoonOnly);
                setCurrentPage(1);
              }}
              className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold transition-all ${
                expiringSoonOnly
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400'
                  : 'border-border text-muted-foreground hover:bg-muted/40'
              }`}
            >
              تنتهي خلال 30 يوماً
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Interactive 19-Column Excel Table */}
      <Card className="card-elevated border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] relative">
          <table className="w-full text-xs text-right border-collapse select-text">
            {/* Sticky Header */}
            <thead className="bg-[#0B132B] text-white font-bold sticky top-0 z-20 shadow-sm border-b border-[#1C2541]">
              <tr>
                {visibleColumns.seq && (
                  <th onClick={() => handleSort('seq')} className="py-3 px-3 cursor-pointer hover:bg-white/10 w-12 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <span>م</span>
                      {getSortIcon('seq')}
                    </div>
                  </th>
                )}
                {visibleColumns.centerNameAr && (
                  <th onClick={() => handleSort('centerNameAr')} className="py-3 px-3 cursor-pointer hover:bg-white/10 min-w-[170px]">
                    <div className="flex items-center gap-1">
                      <span>اسم السنتر</span>
                      {getSortIcon('centerNameAr')}
                    </div>
                  </th>
                )}
                {visibleColumns.adminName && (
                  <th onClick={() => handleSort('adminName')} className="py-3 px-3 cursor-pointer hover:bg-white/10 min-w-[130px]">
                    <div className="flex items-center gap-1">
                      <span>مسؤول السنتر</span>
                      {getSortIcon('adminName')}
                    </div>
                  </th>
                )}
                {visibleColumns.adminPhone && (
                  <th onClick={() => handleSort('adminPhone')} className="py-3 px-3 cursor-pointer hover:bg-white/10 min-w-[110px]">
                    <div className="flex items-center gap-1">
                      <span>رقم الهاتف</span>
                      {getSortIcon('adminPhone')}
                    </div>
                  </th>
                )}
                {visibleColumns.planNameAr && (
                  <th onClick={() => handleSort('planNameAr')} className="py-3 px-3 cursor-pointer hover:bg-white/10 min-w-[120px]">
                    <div className="flex items-center gap-1">
                      <span>الباقة</span>
                      {getSortIcon('planNameAr')}
                    </div>
                  </th>
                )}
                {visibleColumns.billingFrequency && (
                  <th onClick={() => handleSort('billingFrequency')} className="py-3 px-3 cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-1">
                      <span>النوع</span>
                      {getSortIcon('billingFrequency')}
                    </div>
                  </th>
                )}
                {visibleColumns.subscriptionStartDate && (
                  <th onClick={() => handleSort('subscriptionStartDate')} className="py-3 px-3 cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-1">
                      <span>البداية</span>
                      {getSortIcon('subscriptionStartDate')}
                    </div>
                  </th>
                )}
                {visibleColumns.subscriptionEndDate && (
                  <th onClick={() => handleSort('subscriptionEndDate')} className="py-3 px-3 cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-1">
                      <span>النهاية</span>
                      {getSortIcon('subscriptionEndDate')}
                    </div>
                  </th>
                )}
                {visibleColumns.totalInvoiced && (
                  <th onClick={() => handleSort('totalInvoiced')} className="py-3 px-3 cursor-pointer hover:bg-white/10 text-left min-w-[120px]" dir="ltr">
                    <div className="flex items-center justify-end gap-1">
                      {getSortIcon('totalInvoiced')}
                      <span>إجمالي الفواتير</span>
                    </div>
                  </th>
                )}
                {visibleColumns.totalDiscounts && (
                  <th onClick={() => handleSort('totalDiscounts')} className="py-3 px-3 cursor-pointer hover:bg-white/10 text-left min-w-[110px]" dir="ltr">
                    <div className="flex items-center justify-end gap-1">
                      {getSortIcon('totalDiscounts')}
                      <span>الخصومات</span>
                    </div>
                  </th>
                )}
                {visibleColumns.netDue && (
                  <th onClick={() => handleSort('netDue')} className="py-3 px-3 cursor-pointer hover:bg-white/10 text-left min-w-[120px]" dir="ltr">
                    <div className="flex items-center justify-end gap-1">
                      {getSortIcon('netDue')}
                      <span>صافي المستحق</span>
                    </div>
                  </th>
                )}
                {visibleColumns.totalPaid && (
                  <th onClick={() => handleSort('totalPaid')} className="py-3 px-3 cursor-pointer hover:bg-white/10 text-left min-w-[120px]" dir="ltr">
                    <div className="flex items-center justify-end gap-1">
                      {getSortIcon('totalPaid')}
                      <span>المدفوع</span>
                    </div>
                  </th>
                )}
                {visibleColumns.remainingBalance && (
                  <th onClick={() => handleSort('remainingBalance')} className="py-3 px-3 cursor-pointer hover:bg-white/10 text-left min-w-[120px]" dir="ltr">
                    <div className="flex items-center justify-end gap-1">
                      {getSortIcon('remainingBalance')}
                      <span>المتبقي</span>
                    </div>
                  </th>
                )}
                {visibleColumns.creditBalance && (
                  <th onClick={() => handleSort('creditBalance')} className="py-3 px-3 cursor-pointer hover:bg-white/10 text-left" dir="ltr">
                    <div className="flex items-center justify-end gap-1">
                      {getSortIcon('creditBalance')}
                      <span>الرصيد الدائن</span>
                    </div>
                  </th>
                )}
                {visibleColumns.lastPaymentDate && (
                  <th onClick={() => handleSort('lastPaymentDate')} className="py-3 px-3 cursor-pointer hover:bg-white/10 min-w-[100px]">
                    <div className="flex items-center gap-1">
                      <span>آخر دفعة</span>
                      {getSortIcon('lastPaymentDate')}
                    </div>
                  </th>
                )}
                {visibleColumns.nextDueDate && (
                  <th onClick={() => handleSort('nextDueDate')} className="py-3 px-3 cursor-pointer hover:bg-white/10 min-w-[100px]">
                    <div className="flex items-center gap-1">
                      <span>الاستحقاق</span>
                      {getSortIcon('nextDueDate')}
                    </div>
                  </th>
                )}
                {visibleColumns.paymentStatus && (
                  <th onClick={() => handleSort('paymentStatus')} className="py-3 px-3 cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-1">
                      <span>حالة الدفع</span>
                      {getSortIcon('paymentStatus')}
                    </div>
                  </th>
                )}
                {visibleColumns.subscriptionStatus && (
                  <th onClick={() => handleSort('subscriptionStatus')} className="py-3 px-3 cursor-pointer hover:bg-white/10">
                    <div className="flex items-center gap-1">
                      <span>حالة الاشتراك</span>
                      {getSortIcon('subscriptionStatus')}
                    </div>
                  </th>
                )}
                {visibleColumns.actions && (
                  <th className="py-3 px-3 text-center min-w-[120px] sticky left-0 bg-[#0B132B] z-10">
                    الإجراءات
                  </th>
                )}
              </tr>
            </thead>

            {/* Table Rows Body */}
            <tbody className="divide-y divide-border font-medium">
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={19} className="py-12 text-center text-muted-foreground text-xs">
                    لا توجد سناتر مطابقة لمعايير البحث والفلترة.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row) => {
                  const isOverdue = row.paymentStatus === 'overdue';
                  return (
                    <tr
                      key={row.tenantId}
                      className={`hover:bg-muted/30 transition-colors ${
                        isOverdue ? 'bg-rose-500/5' : ''
                      }`}
                    >
                      {visibleColumns.seq && (
                        <td className="py-2.5 px-3 font-mono text-center text-muted-foreground">
                          {row.seq}
                        </td>
                      )}
                      {visibleColumns.centerNameAr && (
                        <td className="py-2.5 px-3">
                          <button
                            type="button"
                            onClick={() => openCenterLedger(row.tenantId)}
                            className="font-bold text-foreground hover:text-brand-cyan-500 text-right block"
                          >
                            {row.centerNameAr}
                          </button>
                          <span className="font-mono text-[10px] text-muted-foreground">/{row.slug}</span>
                        </td>
                      )}
                      {visibleColumns.adminName && (
                        <td className="py-2.5 px-3 text-muted-foreground">{row.adminName}</td>
                      )}
                      {visibleColumns.adminPhone && (
                        <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]" dir="ltr">
                          {row.adminPhone}
                        </td>
                      )}
                      {visibleColumns.planNameAr && (
                        <td className="py-2.5 px-3 text-muted-foreground">{row.planNameAr}</td>
                      )}
                      {visibleColumns.billingFrequency && (
                        <td className="py-2.5 px-3">
                          <Badge variant="outline" className="text-[10px]">
                            {row.billingFrequency === 'annual' ? 'سنوي' : 'شهري'}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.subscriptionStartDate && (
                        <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                          {row.subscriptionStartDate}
                        </td>
                      )}
                      {visibleColumns.subscriptionEndDate && (
                        <td className="py-2.5 px-3 font-mono text-muted-foreground text-[11px]">
                          {row.subscriptionEndDate}
                        </td>
                      )}
                      {visibleColumns.totalInvoiced && (
                        <td className="py-2.5 px-3 font-mono font-bold text-left text-foreground" dir="ltr">
                          {row.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleColumns.totalDiscounts && (
                        <td className="py-2.5 px-3 font-mono font-bold text-left text-rose-600 dark:text-rose-400" dir="ltr">
                          {row.totalDiscounts > 0 ? row.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                      )}
                      {visibleColumns.netDue && (
                        <td className="py-2.5 px-3 font-mono font-black text-left text-foreground" dir="ltr">
                          {row.netDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleColumns.totalPaid && (
                        <td className="py-2.5 px-3 font-mono font-bold text-left text-emerald-600 dark:text-emerald-400" dir="ltr">
                          {row.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                      )}
                      {visibleColumns.remainingBalance && (
                        <td className="py-2.5 px-3 font-mono font-black text-left" dir="ltr">
                          <span className={row.remainingBalance > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600'}>
                            {row.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </span>
                        </td>
                      )}
                      {visibleColumns.creditBalance && (
                        <td className="py-2.5 px-3 font-mono font-bold text-left text-indigo-600 dark:text-indigo-400" dir="ltr">
                          {row.creditBalance > 0 ? row.creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2 }) : '0.00'}
                        </td>
                      )}
                      {visibleColumns.lastPaymentDate && (
                        <td className="py-2.5 px-3 font-mono text-[11px] text-muted-foreground">
                          {row.lastPaymentDate || '—'}
                        </td>
                      )}
                      {visibleColumns.nextDueDate && (
                        <td className="py-2.5 px-3 font-mono text-[11px] text-brand-cyan-600 dark:text-brand-cyan-400">
                          {row.nextDueDate}
                        </td>
                      )}
                      {visibleColumns.paymentStatus && (
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              row.paymentStatus === 'paid'
                                ? 'success'
                                : row.paymentStatus === 'overdue'
                                ? 'destructive'
                                : 'cyan'
                            }
                            className="text-[10px]"
                          >
                            {row.paymentStatus === 'paid'
                              ? 'مدفوع'
                              : row.paymentStatus === 'partial'
                              ? 'جزئي'
                              : row.paymentStatus === 'overdue'
                              ? 'متأخر'
                              : 'غير مدفوع'}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.subscriptionStatus && (
                        <td className="py-2.5 px-3">
                          <Badge
                            variant={
                              row.subscriptionStatus === 'active'
                                ? 'outline'
                                : row.subscriptionStatus === 'trial'
                                ? 'cyan'
                                : 'destructive'
                            }
                            className="text-[10px]"
                          >
                            {row.subscriptionStatus === 'active' ? 'نشط' : row.subscriptionStatus === 'trial' ? 'تجريبي' : 'موقوف'}
                          </Badge>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="py-2.5 px-3 text-center sticky left-0 bg-card z-10 shadow-sm">
                          <Button
                            type="button"
                            variant="cyan"
                            size="sm"
                            onClick={() => openCenterLedger(row.tenantId)}
                            className="h-7 text-[11px] font-bold px-2.5 gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>عرض الحساب</span>
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Calculated Totals Summary Footer */}
            <tfoot className="bg-muted/80 font-black border-t-2 border-border text-foreground sticky bottom-0 z-20">
              <tr>
                {visibleColumns.seq && <td className="py-3 px-3 text-center">الإجمالي</td>}
                {visibleColumns.centerNameAr && (
                  <td className="py-3 px-3 font-bold text-xs">
                    {filteredAndSortedRows.length} سناتر
                  </td>
                )}
                {visibleColumns.adminName && <td className="py-3 px-3">—</td>}
                {visibleColumns.adminPhone && <td className="py-3 px-3">—</td>}
                {visibleColumns.planNameAr && <td className="py-3 px-3">—</td>}
                {visibleColumns.billingFrequency && <td className="py-3 px-3">—</td>}
                {visibleColumns.subscriptionStartDate && <td className="py-3 px-3">—</td>}
                {visibleColumns.subscriptionEndDate && <td className="py-3 px-3">—</td>}
                {visibleColumns.totalInvoiced && (
                  <td className="py-3 px-3 font-mono text-left text-sm" dir="ltr">
                    {totals.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.totalDiscounts && (
                  <td className="py-3 px-3 font-mono text-left text-sm text-rose-600 dark:text-rose-400" dir="ltr">
                    {totals.totalDiscounts.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.netDue && (
                  <td className="py-3 px-3 font-mono text-left text-sm font-black" dir="ltr">
                    {totals.netDue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.totalPaid && (
                  <td className="py-3 px-3 font-mono text-left text-sm text-emerald-600 dark:text-emerald-400 font-black" dir="ltr">
                    {totals.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.remainingBalance && (
                  <td className="py-3 px-3 font-mono text-left text-sm text-rose-600 dark:text-rose-400 font-black" dir="ltr">
                    {totals.remainingBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.creditBalance && (
                  <td className="py-3 px-3 font-mono text-left text-sm text-indigo-600 dark:text-indigo-400 font-black" dir="ltr">
                    {totals.creditBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                )}
                {visibleColumns.lastPaymentDate && <td className="py-3 px-3">—</td>}
                {visibleColumns.nextDueDate && <td className="py-3 px-3">—</td>}
                {visibleColumns.paymentStatus && <td className="py-3 px-3">—</td>}
                {visibleColumns.subscriptionStatus && <td className="py-3 px-3">—</td>}
                {visibleColumns.actions && <td className="py-3 px-3 sticky left-0 bg-muted/80 z-10">—</td>}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-3 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>عرض:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="h-8 px-2 rounded-xl border border-border bg-background text-xs font-bold"
            >
              <option value={10}>10 سناتر</option>
              <option value={25}>25 سنتر</option>
              <option value={50}>50 سنتر</option>
              <option value={100}>100 سنتر</option>
            </select>
            <span>من إجمالي {filteredAndSortedRows.length} سنتر</span>
          </div>

          <div className="flex items-center gap-1.5 font-bold">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="h-8 px-2 text-xs"
            >
              <ChevronRight className="w-3.5 h-3.5" />
              <span>السابق</span>
            </Button>
            <span className="px-3 py-1 rounded-lg bg-muted text-foreground font-mono">
              صفحة {currentPage} من {totalPages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="h-8 px-2 text-xs"
            >
              <span>التالي</span>
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Center Financial Ledger Modal */}
      {selectedCenter && (
        <CenterFinancialModal
          center={selectedCenter}
          isOpen={true}
          onClose={() => setSelectedCenter(null)}
          onDataChanged={reloadData}
        />
      )}
    </div>
  );
}
