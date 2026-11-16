'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Inbox,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageSquare,
  Building2,
  Users,
  Clock,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Plus,
  Send,
  Eye,
  Check,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import { CustomerRequest, ComplaintRecord, RequestStatus } from '@/lib/saas/types';

export default function OwnerRequestsPage() {
  const [requests, setRequests] = useState<CustomerRequest[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<'requests' | 'complaints'>('requests');
  const [selectedRequest, setSelectedRequest] = useState<CustomerRequest | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [newInternalNote, setNewInternalNote] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Conversion wizard state
  const [isConverting, setIsConverting] = useState(false);

  const reloadData = () => {
    setRequests(SaasPlatformService.getRequests());
    setComplaints(SaasPlatformService.getComplaints());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const filteredRequests = useMemo(() => {
    return requests.filter((r) => {
      const matchQuery =
        !searchQuery ||
        r.centerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.phone.includes(searchQuery) ||
        r.email.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || r.status === statusFilter;
      return matchQuery && matchStatus;
    });
  }, [requests, searchQuery, statusFilter]);

  const handleUpdateStatus = (reqId: string, newStatus: RequestStatus, note?: string) => {
    const updated = SaasPlatformService.updateRequestStatus(reqId, newStatus, note);
    if (updated) {
      reloadData();
      if (selectedRequest?.id === reqId) setSelectedRequest({ ...updated });
      setStatusMessage(`تم تحديث حالة الطلب إلى «${getStatusLabel(newStatus)}» بنجاح.`);
    }
  };

  const handleAddNote = () => {
    if (!selectedRequest || !newInternalNote.trim()) return;
    handleUpdateStatus(selectedRequest.id, selectedRequest.status, newInternalNote.trim());
    setNewInternalNote('');
  };

  // Convert Request to a Real Center
  const handleConvertToCenter = async (req: CustomerRequest) => {
    setIsConverting(true);
    setStatusMessage(null);

    const generatedSlug = req.centerName
      .trim()
      .replace(/^(سنتر|مركز|أكاديمية)\s+/i, '')
      .toLowerCase()
      .replace(/\s+/g, '-');

    const res = await SaasPlatformService.provisionNewCenter({
      nameAr: req.centerName,
      slug: generatedSlug || `center-${Date.now().toString().slice(-4)}`,
      phone: req.phone,
      address: req.address || req.governorate || 'القاهرة، مصر',
      email: req.email,
      adminName: req.contactPerson,
      adminEmail: req.email,
      adminPhone: req.phone,
      planId: req.requestedPlanId || 'plan-pro',
      billingFrequency: 'monthly',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10),
      notes: `تم إنشاء السنتر تلقائياً بالتحويل من طلب الانضمام رقم ${req.id}`,
    });

    setIsConverting(false);

    if (res.ok && res.center) {
      // Mark request as converted
      handleUpdateStatus(req.id, 'converted', `تم تحويل الطلب لسنتر فعلي برابط /center/${res.center.slug}`);
      setIsDetailsOpen(false);
      setStatusMessage(`🎉 تهانينا! تم تحويل الطلب إلى سنتر نشط: «${res.center.nameAr}» برابط /center/${res.center.slug}`);
    } else {
      setStatusMessage(res.errorAr || 'تعذّر إتمام تحويل السنتر');
    }
  };

  function getStatusLabel(status: RequestStatus): string {
    switch (status) {
      case 'new':
        return 'جديد';
      case 'under_review':
        return 'قيد المراجعة';
      case 'contacted':
        return 'تم التواصل';
      case 'demo_scheduled':
        return 'حجز ديمو';
      case 'accepted':
        return 'مقبول';
      case 'rejected':
        return 'مرفوض';
      case 'converted':
        return 'تم التحويل لسنتر';
      default:
        return status;
    }
  }

  function getStatusBadge(status: RequestStatus) {
    switch (status) {
      case 'new':
        return <Badge variant="destructive" className="animate-pulse text-[10px]">جديد</Badge>;
      case 'under_review':
        return <Badge variant="cyan" className="text-[10px]">قيد المراجعة</Badge>;
      case 'contacted':
        return <Badge variant="outline" className="text-[10px]">تم التواصل</Badge>;
      case 'demo_scheduled':
        return <Badge variant="cyan" className="text-[10px]">ديمو مجدول</Badge>;
      case 'accepted':
        return <Badge variant="success" className="text-[10px]">مقبول</Badge>;
      case 'converted':
        return <Badge variant="success" className="text-[10px] bg-purple-600 text-white">سنتر مفعّل ✓</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="text-muted-foreground text-[10px]">مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              <Inbox className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                السناتر والحجوزات والطلبات الواردة
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                صندوق وارد طلبات الاشتراك، حجز العروض الحية (Demos)، والشكاوى الواردة من الموقع التسويقي.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={reloadData}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 text-brand-cyan-500" />
            <span>تحديث الطلبات</span>
          </Button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-brand-cyan-500/10 border border-brand-cyan-500/30 text-xs font-bold text-brand-cyan-700 dark:text-brand-cyan-300 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-brand-cyan-500" />
            <span>{statusMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-muted-foreground hover:text-foreground text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Inboxes Tabs */}
      <div className="flex border-b border-border gap-4 text-xs font-bold">
        <button
          type="button"
          onClick={() => setActiveTab('requests')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'requests'
              ? 'border-brand-cyan-500 text-brand-cyan-600 dark:text-brand-cyan-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>طلبات الاشتراك والديمو ({requests.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('complaints')}
          className={`py-3 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'complaints'
              ? 'border-brand-cyan-500 text-brand-cyan-600 dark:text-brand-cyan-400'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <AlertCircle className="w-4 h-4 text-amber-500" />
          <span>صندوق الشكاوى والملاحظات ({complaints.length})</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* TAB 1: REQUESTS INBOX */}
      {/* ===================================================================== */}
      {activeTab === 'requests' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="card-elevated p-4 rounded-2xl border border-border bg-card flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="ابحث بالسنتر، المسؤول، أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pr-9 pl-3 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-brand-cyan-500"
              >
                <option value="all">كافة الحالات</option>
                <option value="new">طلبات جديدة</option>
                <option value="under_review">قيد المراجعة</option>
                <option value="demo_scheduled">ديمو مجدول</option>
                <option value="contacted">تم التواصل</option>
                <option value="converted">تم التحويل لسنتر</option>
              </select>
            </div>
          </div>

          {/* Requests Table / Cards */}
          <div className="space-y-3">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="card-elevated p-4 rounded-2xl border border-border bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-brand-cyan-500/40 transition-all text-xs"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{req.centerName}</span>
                    {getStatusBadge(req.status)}
                    <span className="text-[10px] text-muted-foreground font-mono">
                      #{req.id}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-muted-foreground text-[11px]">
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      {req.contactPerson}
                    </span>
                    <span className="flex items-center gap-1 font-mono" dir="ltr">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      {req.phone}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {req.governorate || 'القاهرة'}
                    </span>
                    <Badge variant="cyan" className="text-[10px]">
                      {req.requestedPlanName || 'باقة المحترفين'}
                    </Badge>
                  </div>

                  {req.notes && (
                    <p className="text-[11px] text-muted-foreground line-clamp-1 italic">
                      «{req.notes}»
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedRequest(req);
                      setIsDetailsOpen(true);
                    }}
                    className="h-8 text-xs font-bold px-3 gap-1"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>عرض ومتابعة</span>
                  </Button>

                  {req.status !== 'converted' && (
                    <Button
                      type="button"
                      variant="cyan"
                      size="sm"
                      disabled={isConverting}
                      onClick={() => handleConvertToCenter(req)}
                      className="h-8 text-xs font-bold px-3 gap-1 shadow-soft-sm bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>تحويل لسنتر</span>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: COMPLAINTS INBOX */}
      {/* ===================================================================== */}
      {activeTab === 'complaints' && (
        <div className="space-y-3">
          {complaints.map((comp) => (
            <div key={comp.id} className="card-elevated p-4 rounded-2xl border border-border bg-card space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{comp.subject}</span>
                  <Badge variant={comp.status === 'resolved' ? 'success' : 'destructive'} className="text-[10px]">
                    {comp.status === 'resolved' ? 'تم الحل' : comp.status === 'investigating' ? 'قيد الفحص' : 'مفتوحة'}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {new Date(comp.createdAt).toLocaleDateString('ar-EG')}
                </span>
              </div>

              <p className="text-muted-foreground text-xs leading-relaxed">{comp.description}</p>

              <div className="pt-2 flex items-center justify-between text-[11px] text-muted-foreground border-t border-border">
                <span>
                  المرسل: <strong className="text-foreground">{comp.senderName}</strong> ({comp.phone})
                </span>

                {comp.status !== 'resolved' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      SaasPlatformService.updateComplaintStatus(comp.id, 'resolved', 'تم الحل والتواصل مع العميل.');
                      reloadData();
                      setStatusMessage('تم تحديث حالة الشكوى إلى محلولة.');
                    }}
                    className="h-7 text-[11px] font-bold text-emerald-600"
                  >
                    تأكيد حل الشكوى
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* REQUEST DETAILS MODAL */}
      {/* ========================================================================= */}
      {isDetailsOpen && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-elevated rounded-3xl border border-border bg-card w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-150 text-xs">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-base font-black text-foreground flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-blue-500" />
                  <span>تفاصيل طلب سنتر «{selectedRequest.centerName}»</span>
                </h2>
                <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  رقم المعاملة: {selectedRequest.id} • بتاريخ {new Date(selectedRequest.createdAt).toLocaleString('ar-EG')}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDetailsOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 custom-scrollbar">
              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-muted/30 border border-border">
                <div>
                  <span className="text-muted-foreground block text-[10px]">المسؤول للتواصل</span>
                  <strong className="text-foreground text-xs mt-0.5 block">{selectedRequest.contactPerson}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[10px]">الهاتف / الواتساب</span>
                  <strong className="text-foreground text-xs mt-0.5 block font-mono" dir="ltr">{selectedRequest.phone}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[10px]">البريد الإلكتروني</span>
                  <strong className="text-foreground text-xs mt-0.5 block font-mono">{selectedRequest.email}</strong>
                </div>

                <div>
                  <span className="text-muted-foreground block text-[10px]">الباقة المطلوبة</span>
                  <strong className="text-brand-cyan-600 dark:text-brand-cyan-400 text-xs mt-0.5 block">
                    {selectedRequest.requestedPlanName || 'باقة المحترفين'}
                  </strong>
                </div>

                <div className="col-span-2">
                  <span className="text-muted-foreground block text-[10px]">ملاحظات العميل</span>
                  <p className="text-foreground mt-0.5">{selectedRequest.notes || 'لا توجد ملاحظات إضافية'}</p>
                </div>
              </div>

              {/* Status Selector */}
              <div className="space-y-1.5">
                <span className="font-bold text-foreground block">تغيير حالة الطلب:</span>
                <div className="flex flex-wrap gap-2">
                  {(['new', 'under_review', 'contacted', 'demo_scheduled', 'accepted', 'rejected'] as RequestStatus[]).map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => handleUpdateStatus(selectedRequest.id, st)}
                      className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] ${
                        selectedRequest.status === st
                          ? 'bg-brand-cyan-500 text-white shadow-soft-sm'
                          : 'bg-muted border border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {getStatusLabel(st)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Internal Notes & History */}
              <div className="space-y-2 pt-2 border-t border-border">
                <span className="font-bold text-foreground block">سجل الملاحظات والتواصل الداخلي:</span>

                <div className="space-y-1.5 max-h-36 overflow-y-auto">
                  {selectedRequest.communicationHistory.map((hist, idx) => (
                    <div key={idx} className="p-2 rounded-xl bg-background border border-border text-[11px] flex justify-between">
                      <span>{hist.note}</span>
                      <span className="text-muted-foreground font-mono text-[10px]">
                        {new Date(hist.date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="أضف ملاحظة داخلية جديدة..."
                    value={newInternalNote}
                    onChange={(e) => setNewInternalNote(e.target.value)}
                    className="flex-1 h-8 px-2.5 rounded-xl border border-border bg-background text-xs"
                  />
                  <Button type="button" size="sm" variant="cyan" onClick={handleAddNote} className="h-8 text-xs font-bold px-3">
                    إضافة
                  </Button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDetailsOpen(false)}
                className="text-xs font-bold px-4"
              >
                إغلاق
              </Button>

              {selectedRequest.status !== 'converted' && (
                <Button
                  type="button"
                  variant="cyan"
                  size="sm"
                  onClick={() => handleConvertToCenter(selectedRequest)}
                  className="text-xs font-bold gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-soft-sm"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>تأكيد تحويل الطلب إلى سنتر نشط</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
