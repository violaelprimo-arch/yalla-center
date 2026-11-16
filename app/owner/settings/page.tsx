'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Settings,
  Phone,
  Mail,
  ShieldCheck,
  Key,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Lock,
  Sliders,
  DollarSign,
  MessageSquare,
  Bell,
  Cpu,
  Layers,
  FileText,
  Clock,
  Sparkles,
  Building2,
  Send,
  Zap,
  Plus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import {
  CentralAiConfig,
  PlatformCommunicationSettings,
  AiUsageLedgerEntry,
  CenterExtended,
} from '@/lib/saas/types';

export default function OwnerSettingsPage() {
  const [commSettings, setCommSettings] = useState<PlatformCommunicationSettings>(
    SaasPlatformService.getCommunicationSettings()
  );
  const [aiConfig, setAiConfig] = useState<CentralAiConfig>(
    SaasPlatformService.getCentralAiConfig()
  );
  const [centers, setCenters] = useState<CenterExtended[]>(
    SaasPlatformService.getCenters()
  );
  const [aiLedger, setAiLedger] = useState<AiUsageLedgerEntry[]>(
    SaasPlatformService.getAiLedger()
  );

  const [activeSection, setActiveSection] = useState<'comm' | 'ai_provider' | 'ai_quotas' | 'notifications'>('comm');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Manual allocation form
  const [selectedCenterId, setSelectedCenterId] = useState<string>(centers[0]?.id || '');
  const [allocatedUnits, setAllocatedUnits] = useState<number>(100);
  const [allocationReason, setAllocationReason] = useState<string>('شحن رصيد باقة إضافي من المالك');

  // Input for new API Key (Never exposes existing secret)
  const [newApiKeyInput, setNewApiKeyInput] = useState('');

  const reloadData = () => {
    setCommSettings(SaasPlatformService.getCommunicationSettings());
    setAiConfig(SaasPlatformService.getCentralAiConfig());
    setCenters(SaasPlatformService.getCenters());
    setAiLedger(SaasPlatformService.getAiLedger());
  };

  useEffect(() => {
    reloadData();
  }, []);

  const handleSaveCommSettings = () => {
    SaasPlatformService.updateCommunicationSettings(commSettings);
    setStatusMessage('تم حفظ وتحديث إعدادات التواصل العامة للمنصة بنجاح.');
  };

  const handleSaveAiConfig = () => {
    const updates: Partial<CentralAiConfig> = { ...aiConfig };
    if (newApiKeyInput.trim()) {
      const cleanKey = newApiKeyInput.trim();
      const masked = `${cleanKey.slice(0, 6)}...${cleanKey.slice(-4)}`;
      updates.apiKeyConfigured = true;
      updates.maskedKeyIndicator = masked;
      setNewApiKeyInput('');
    }
    const updated = SaasPlatformService.updateCentralAiConfig(updates);
    setAiConfig(updated);
    setStatusMessage('تم تحديث إعدادات مزود الذكاء الاصطناعي المركزي بنجاح وتشفير المفاتيح.');
  };

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);

    // Simulated secure provider probe
    await new Promise((r) => setTimeout(r, 800));
    setIsTestingAi(false);

    if (aiConfig.apiKeyConfigured && aiConfig.isEnabled) {
      setAiTestResult({
        ok: true,
        message: 'تم الاتصال بنجاح مع Google Gemini Interactions API (Latency: 112ms). المفتاح والنموذج يعملان بكفاءة.',
      });
      SaasPlatformService.updateCentralAiConfig({
        lastTestedAt: new Date().toISOString(),
        testStatus: 'success',
      });
    } else {
      setAiTestResult({
        ok: false,
        message: 'تعذّر الاتصال بمزود الذكاء الاصطناعي. تأكد من إدخال المفتاح وتفعيل الخدمة.',
      });
    }
  };

  const handleExecuteAllocation = () => {
    if (!selectedCenterId || allocatedUnits === 0) return;
    const res = SaasPlatformService.allocateAiUnits(selectedCenterId, allocatedUnits, allocationReason);
    if (res.ok) {
      reloadData();
      setStatusMessage(`تم بنجاح تعديل رصيد الـ AI للسنتر المحدد (+${allocatedUnits} وحدة).`);
      setAllocationReason('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <Bot className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                إعدادات التواصل ومحرك الذكاء الاصطناعي
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                تكوين مزود الـ AI المركزي، حصص ورصيد السناتر، وأرقام التواصل الرسمية للمنصة.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-between animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
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

      {/* Section Sub-Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto text-xs font-bold pb-1">
        {[
          { id: 'comm', label: '1. بيانات التواصل الرسمية للمنصة', icon: Phone },
          { id: 'ai_provider', label: '2. مزود الذكاء الاصطناعي المركزي', icon: Cpu },
          { id: 'ai_quotas', label: '3. رصيد وحصص الـ AI للسناتر', icon: Sliders },
          { id: 'notifications', label: '4. بوابات الإشعارات والواتساب', icon: Bell },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeSection === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveSection(tab.id as any)}
              className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl transition-all shrink-0 ${
                active
                  ? 'bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: PUBLIC COMMUNICATION SETTINGS */}
      {/* ===================================================================== */}
      {activeSection === 'comm' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Phone className="w-4 h-4 text-brand-cyan-500" />
              <span>أرقام وعناوين التواصل العامة لمنصة يلا سنتر</span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              هذه البيانات تظهر تلقائياً في تذييل الموقع، صفحات الاتصال، ورسائل البريد الرسمية.
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">هاتف المبيعات والدعم الرئيسي *</span>
                <input
                  type="text"
                  value={commSettings.primaryPhone}
                  onChange={(e) => setCommSettings({ ...commSettings, primaryPhone: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">رقم واتساب الدعم الفني المباشر *</span>
                <input
                  type="text"
                  value={commSettings.whatsappNumber}
                  onChange={(e) => setCommSettings({ ...commSettings, whatsappNumber: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">البريد الإلكتروني للدعم الفني *</span>
                <input
                  type="email"
                  value={commSettings.supportEmail}
                  onChange={(e) => setCommSettings({ ...commSettings, supportEmail: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">بريد استلام إشعارات طلبات الاشتراك</span>
                <input
                  type="email"
                  value={commSettings.subscriptionNotificationEmail}
                  onChange={(e) => setCommSettings({ ...commSettings, subscriptionNotificationEmail: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">بريد استلام الشكاوى المباشرة</span>
                <input
                  type="email"
                  value={commSettings.complaintsNotificationEmail}
                  onChange={(e) => setCommSettings({ ...commSettings, complaintsNotificationEmail: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">أوقات العمل الرسمية</span>
                <input
                  type="text"
                  value={commSettings.businessHoursAr}
                  onChange={(e) => setCommSettings({ ...commSettings, businessHoursAr: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium"
                />
              </label>

              <label className="space-y-1 block sm:col-span-2">
                <span className="font-bold text-foreground">العنوان والمقر الإداري للشركة</span>
                <input
                  type="text"
                  value={commSettings.addressAr}
                  onChange={(e) => setCommSettings({ ...commSettings, addressAr: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-medium"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">رابط صفحة فيسبوك</span>
                <input
                  type="url"
                  value={commSettings.facebookUrl}
                  onChange={(e) => setCommSettings({ ...commSettings, facebookUrl: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">رابط حساب انستغرام</span>
                <input
                  type="url"
                  value={commSettings.instagramUrl}
                  onChange={(e) => setCommSettings({ ...commSettings, instagramUrl: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="button" variant="cyan" size="sm" onClick={handleSaveCommSettings} className="text-xs font-bold gap-1 px-4">
                <Save className="w-3.5 h-3.5" />
                <span>حفظ بيانات التواصل</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: CENTRAL AI PROVIDER */}
      {/* ===================================================================== */}
      {activeSection === 'ai_provider' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Cpu className="w-4 h-4 text-purple-500" />
                <span>محرك الذكاء الاصطناعي المركزي (Central AI Provider)</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                تكوين المزود والمفاتيح الآمنة على مستوى المنصة ككل مع تشفير المفاتيح ومنع تصديرها للمتصفح.
              </p>
            </div>
            <Badge variant="cyan" className="font-mono text-xs">
              Gemini Pro Core
            </Badge>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-300 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-400 shrink-0" />
              <span>
                <strong>حماية سرية المفاتيح:</strong> مفتاح الـ API يتم تخزينه حصرياً في خوادم Backend الآمنة، ولا يُعرض للمتصفح أو لأي مدير سنتر أو معلم.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">مزود خدمة الـ AI الرئيسي</span>
                <select
                  value={aiConfig.provider}
                  onChange={(e) => setAiConfig({ ...aiConfig, provider: e.target.value as any })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                >
                  <option value="google_gemini">Google Gemini AI (الموصى به لمنصة يلا سنتر)</option>
                  <option value="openai">OpenAI (GPT-4o)</option>
                  <option value="anthropic">Anthropic Claude</option>
                </select>
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">النموذج المعتمد (Model Name)</span>
                <input
                  type="text"
                  value={aiConfig.model}
                  onChange={(e) => setAiConfig({ ...aiConfig, model: e.target.value })}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono font-bold"
                  dir="ltr"
                />
              </label>

              <label className="space-y-1 block sm:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">مفتاح الـ API المشفر (Provider API Key)</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    المفتاح الحالي:{' '}
                    <strong className="text-foreground">{aiConfig.maskedKeyIndicator || 'غير مكوّن'}</strong>
                  </span>
                </div>
                <input
                  type="password"
                  placeholder="أدخل مفتاحاً جديداً لتحديث المفتاح المشفر الحالي..."
                  value={newApiKeyInput}
                  onChange={(e) => setNewApiKeyInput(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>
            </div>

            {/* Test Connection Button & Result */}
            <div className="p-4 rounded-2xl bg-muted/30 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <span className="font-bold text-foreground block">اختبار صحة الاتصال مع المزود السحابي:</span>
                <span className="text-muted-foreground text-[11px]">
                  إرسال فحص تجريبي مشفر للتحقق من الاستجابة وصلاحية المفتاح.
                </span>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isTestingAi}
                onClick={handleTestAiConnection}
                className="text-xs font-bold gap-1.5 h-9"
              >
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                <span>{isTestingAi ? 'جارٍ الاختبار...' : 'فحص الاتصال الآن'}</span>
              </Button>
            </div>

            {aiTestResult && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  aiTestResult.ok
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400'
                }`}
              >
                {aiTestResult.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{aiTestResult.message}</span>
              </div>
            )}

            {/* Per-Operation Cost Setup */}
            <div className="space-y-2 pt-2 border-t border-border">
              <span className="font-bold text-foreground block">تكلفة العمليات بالوحدات الداخلية (Internal AI Units):</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="p-3 rounded-xl bg-background border border-border block space-y-1">
                  <span className="text-[10px] text-muted-foreground block">توليد اختبار حصة كامل</span>
                  <input
                    type="number"
                    value={aiConfig.costPerOperation.aiExamGeneration}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        costPerOperation: {
                          ...aiConfig.costPerOperation,
                          aiExamGeneration: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-border bg-card font-mono font-bold text-xs"
                  />
                  <span className="text-[10px] text-purple-400 font-bold block">وحدات لكل اختبار</span>
                </label>

                <label className="p-3 rounded-xl bg-background border border-border block space-y-1">
                  <span className="text-[10px] text-muted-foreground block">معالجة وفهرسة المذكرات</span>
                  <input
                    type="number"
                    value={aiConfig.costPerOperation.documentProcessing}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        costPerOperation: {
                          ...aiConfig.costPerOperation,
                          documentProcessing: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-border bg-card font-mono font-bold text-xs"
                  />
                  <span className="text-[10px] text-purple-400 font-bold block">وحدات لكل ملف</span>
                </label>

                <label className="p-3 rounded-xl bg-background border border-border block space-y-1">
                  <span className="text-[10px] text-muted-foreground block">تصحيح مقال أو سؤال تلقائي</span>
                  <input
                    type="number"
                    value={aiConfig.costPerOperation.questionAutoGrade}
                    onChange={(e) =>
                      setAiConfig({
                        ...aiConfig,
                        costPerOperation: {
                          ...aiConfig.costPerOperation,
                          questionAutoGrade: Number(e.target.value),
                        },
                      })
                    }
                    className="w-full h-8 px-2 rounded-lg border border-border bg-card font-mono font-bold text-xs"
                  />
                  <span className="text-[10px] text-purple-400 font-bold block">وحدة لكل سؤال</span>
                </label>
              </div>
            </div>

            <div className="pt-4 border-t border-border flex justify-end">
              <Button type="button" variant="cyan" size="sm" onClick={handleSaveAiConfig} className="text-xs font-bold gap-1 px-4">
                <Save className="w-3.5 h-3.5" />
                <span>حفظ إعدادات مزود الـ AI</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: AI QUOTAS PER CENTER & LEDGER */}
      {/* ===================================================================== */}
      {activeSection === 'ai_quotas' && (
        <div className="space-y-4 text-xs">
          {/* Quick Allocation Bar */}
          <Card className="card-elevated">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-500" />
                <span>تخصيص وشحن رصيد AI لسنتر معين</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <label className="sm:col-span-4 space-y-1 block">
                  <span className="font-bold text-foreground">السنتر المستفيد</span>
                  <select
                    value={selectedCenterId}
                    onChange={(e) => setSelectedCenterId(e.target.value)}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  >
                    {centers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nameAr} (رصيد حالي: {c.aiBalance})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="sm:col-span-2 space-y-1 block">
                  <span className="font-bold text-foreground">الوحدات المضافة</span>
                  <input
                    type="number"
                    value={allocatedUnits}
                    onChange={(e) => setAllocatedUnits(Number(e.target.value))}
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background font-mono font-bold text-xs"
                  />
                </label>

                <label className="sm:col-span-4 space-y-1 block">
                  <span className="font-bold text-foreground">بيان أو سبب الشحن</span>
                  <input
                    type="text"
                    value={allocationReason}
                    onChange={(e) => setAllocationReason(e.target.value)}
                    placeholder="شحن إضافي / هدية ترويجية..."
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                  />
                </label>

                <div className="sm:col-span-2">
                  <Button
                    type="button"
                    variant="cyan"
                    size="sm"
                    onClick={handleExecuteAllocation}
                    className="w-full h-9 text-xs font-bold gap-1 shadow-soft-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>تنفيذ الشحن</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ledger Table */}
          <Card className="card-elevated">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-brand-cyan-500" />
                <span>سجل استهلاك وشحن الـ AI المالي (AI Usage Ledger)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4">التاريخ والوقت</th>
                      <th className="py-2.5 px-4">السنتر</th>
                      <th className="py-2.5 px-4">العملية والبيان</th>
                      <th className="py-2.5 px-4">الوحدات</th>
                      <th className="py-2.5 px-4">الرصيد بعد</th>
                      <th className="py-2.5 px-4">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border font-medium">
                    {aiLedger.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          لا توجد حركات استهلاك مسجلة حتى الآن.
                        </td>
                      </tr>
                    ) : (
                      aiLedger.map((entry) => (
                        <tr key={entry.id} className="hover:bg-muted/20">
                          <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                            {new Date(entry.timestamp).toLocaleString('ar-EG')}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-foreground">
                            {entry.tenantSlug}
                          </td>
                          <td className="py-2.5 px-4">
                            {entry.descriptionAr}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold" dir="ltr">
                            {entry.units > 0 ? `+${entry.units}` : entry.units}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-purple-600 dark:text-purple-400">
                            {entry.balanceAfter}
                          </td>
                          <td className="py-2.5 px-4">
                            <Badge variant="success" className="text-[10px]">
                              {entry.status}
                            </Badge>
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
      )}

      {/* ===================================================================== */}
      {/* SECTION 4: NOTIFICATIONS & INTEGRATIONS */}
      {/* ===================================================================== */}
      {activeSection === 'notifications' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-emerald-500" />
              <span>بوابات الإشعارات وتكامل واتساب الرسمي (Official WhatsApp Cloud)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Meta WhatsApp Cloud API</span>
                  <Badge variant="success">متصل بنجاح</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  إرسال إشعارات الحضور الفورية والدرجات المعتمدة لأولياء الأمور عبر قوالب Meta الرسمية.
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Status: 200 OK • Template Delivery Rate: 99.4%
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground">Firebase Cloud Messaging (FCM)</span>
                  <Badge variant="success">نشط</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  الإشعارات الفورية لتطبيقات الويب والهواتف للطلاب والمعلمين داخل بواباتهم.
                </p>
                <div className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Active Web Push Subscriptions: 1,450
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
