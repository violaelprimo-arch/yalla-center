'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Globe,
  Save,
  Send,
  Eye,
  CheckCircle2,
  RefreshCw,
  MoveUp,
  MoveDown,
  ToggleLeft,
  ToggleRight,
  Sparkles,
  Smartphone,
  Tablet,
  Monitor,
  Calendar,
  Tag,
  MessageSquare,
  HelpCircle,
  Users,
  Award,
  Sliders,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Plus,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RTLIcon } from '@/components/ui/rtl-icon';
import { SaasPlatformService } from '@/lib/saas/service';
import { WebsiteConfig, WebsiteSection } from '@/lib/saas/types';

export default function OwnerWebsiteBuilderPage() {
  const [draft, setDraft] = useState<WebsiteConfig>(SaasPlatformService.getWebsiteDraft());
  const [published, setPublished] = useState<WebsiteConfig>(SaasPlatformService.getWebsitePublished());
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'sections' | 'announcements' | 'offers' | 'faqs' | 'testimonials' | 'poll'>('sections');
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>('hero');

  const reloadData = () => {
    setDraft(SaasPlatformService.getWebsiteDraft());
    setPublished(SaasPlatformService.getWebsitePublished());
  };

  useEffect(() => {
    reloadData();
  }, []);

  // Save Draft
  const handleSaveDraft = () => {
    const updated = SaasPlatformService.updateWebsiteDraft(draft);
    setDraft(updated);
    setStatusMessage('تم حفظ مسودة تعديلات الموقع بنجاح (لم يتم النشر للعامة بعد).');
  };

  // Publish to Live
  const handlePublishLive = () => {
    const pub = SaasPlatformService.publishWebsite('owner@yallacenter.com');
    setPublished(pub);
    setStatusMessage('🚀 تم نشر التعديلات مباشرة على الموقع التسويقي العام (Live).');
  };

  // Reorder Sections
  const handleMoveSection = (index: number, direction: 'up' | 'down') => {
    const sections = [...draft.sections];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sections.length) return;

    const temp = sections[index];
    sections[index] = sections[targetIndex];
    sections[targetIndex] = temp;

    // re-index order
    sections.forEach((sec, idx) => {
      sec.order = idx + 1;
    });

    setDraft({ ...draft, sections });
  };

  // Toggle Section Visibility
  const handleToggleSection = (sectionId: string) => {
    const sections = draft.sections.map((s) => (s.id === sectionId ? { ...s, enabled: !s.enabled } : s));
    setDraft({ ...draft, sections });
  };

  // Update Specific Section
  const handleUpdateSection = (sectionId: string, updates: Partial<WebsiteSection>) => {
    const sections = draft.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s));
    setDraft({ ...draft, sections });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200" dir="rtl">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20">
              <Globe className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                منشئ ومحرر الموقع التسويقي العام (CMS)
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                التحكم الديناميكي في محتوى الصفحة الرئيسية (/)، العروض، الأقسام، والمسودات دون كتابة كود.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPreviewOpen(true)}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            <span>معاينة الموقع</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSaveDraft}
            className="text-xs font-bold gap-1.5 h-9"
          >
            <Save className="w-3.5 h-3.5 text-amber-500" />
            <span>حفظ كمسودة</span>
          </Button>

          <Button
            type="button"
            variant="cyan"
            size="sm"
            onClick={handlePublishLive}
            className="text-xs font-bold gap-1.5 h-9 shadow-soft-sm bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Send className="w-3.5 h-3.5" />
            <span>نشر التعديلات للعامة</span>
          </Button>
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

      {/* Version Status Summary Bar */}
      <div className="card-elevated p-4 rounded-2xl border border-border bg-card flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-3">
          <Badge variant="cyan" className="font-mono text-xs">
            مسودة العمل: إصدار v{draft.version}
          </Badge>
          <span className="text-muted-foreground">
            آخر نشر رسمي:{' '}
            <strong className="text-foreground font-mono">
              {published.lastPublishedAt ? new Date(published.lastPublishedAt).toLocaleDateString('ar-EG') : 'غير محدد'}
            </strong>
          </span>
        </div>

        <Link
          href="/"
          target="_blank"
          className="text-brand-cyan-600 dark:text-brand-cyan-400 font-bold hover:underline inline-flex items-center gap-1"
        >
          <span>مشاهدة الموقع الحي</span>
          <RTLIcon icon={ExternalLink} className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Builder Category Tabs */}
      <div className="flex border-b border-border gap-2 overflow-x-auto text-xs font-bold pb-1">
        {[
          { id: 'sections', label: 'ترتيب وأقسام الموقع', icon: Sliders },
          { id: 'announcements', label: 'شريط الإعلانات العاجل', icon: Tag },
          { id: 'offers', label: 'العروض الترويجية والخصومات', icon: Calendar },
          { id: 'faqs', label: 'الأسئلة الشائعة (FAQ)', icon: HelpCircle },
          { id: 'testimonials', label: 'آراء وتقييمات العملاء', icon: Award },
          { id: 'poll', label: 'استطلاع الرأي التفاعلي', icon: MessageSquare },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
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
      {/* TAB 1: SECTIONS LIST & REORDER */}
      {/* ===================================================================== */}
      {activeTab === 'sections' && (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            اسحب أو رتّب الأقسام باستخدام الأسهم، يمكنك تفعيل أو إخفاء أي قسم فوراً:
          </div>

          <div className="space-y-3">
            {draft.sections.map((section, idx) => {
              const isExpanded = expandedSectionId === section.id;
              return (
                <div
                  key={section.id}
                  className={`card-elevated rounded-2xl border transition-all ${
                    section.enabled
                      ? 'border-border bg-card'
                      : 'border-border/50 bg-muted/20 opacity-60'
                  }`}
                >
                  {/* Section Bar Header */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex items-center gap-1 text-slate-400">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveSection(idx, 'up')}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                          title="تحريك لأعلى"
                        >
                          <MoveUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.sections.length - 1}
                          onClick={() => handleMoveSection(idx, 'down')}
                          className="p-1 rounded hover:bg-muted disabled:opacity-30"
                          title="تحريك لأسفل"
                        >
                          <MoveDown className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <Badge variant="outline" className="text-[10px] font-mono">
                        #{idx + 1}
                      </Badge>

                      <div className="min-w-0">
                        <div className="font-bold text-foreground text-xs truncate">
                          {section.titleAr}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          ID: {section.id}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleSection(section.id)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-xl transition-colors ${
                          section.enabled
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                            : 'bg-muted text-muted-foreground border border-border'
                        }`}
                      >
                        {section.enabled ? 'مفعّل في العرض' : 'مخفي مؤقتاً'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setExpandedSectionId(isExpanded ? null : section.id)}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground"
                      >
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Section Expanded Editor */}
                  {isExpanded && (
                    <div className="p-4 border-t border-border bg-background/50 space-y-3 animate-in fade-in duration-100 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className="space-y-1 block sm:col-span-2">
                          <span className="font-bold text-foreground">العنوان الرئيسي للقسم</span>
                          <input
                            type="text"
                            value={section.titleAr}
                            onChange={(e) => handleUpdateSection(section.id, { titleAr: e.target.value })}
                            className="w-full h-9 px-3 rounded-xl border border-border bg-background font-bold text-xs"
                          />
                        </label>

                        <label className="space-y-1 block sm:col-span-2">
                          <span className="font-bold text-foreground">الوصف التفصيلي (النص الثانوي)</span>
                          <textarea
                            rows={2}
                            value={section.subtitleAr || ''}
                            onChange={(e) => handleUpdateSection(section.id, { subtitleAr: e.target.value })}
                            className="w-full p-3 rounded-xl border border-border bg-background text-xs"
                          />
                        </label>

                        {section.badgeAr !== undefined && (
                          <label className="space-y-1 block">
                            <span className="font-bold text-foreground">شارة القسم (Badge)</span>
                            <input
                              type="text"
                              value={section.badgeAr || ''}
                              onChange={(e) => handleUpdateSection(section.id, { badgeAr: e.target.value })}
                              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                            />
                          </label>
                        )}

                        {section.ctaLabelAr !== undefined && (
                          <label className="space-y-1 block">
                            <span className="font-bold text-foreground">نص زر الإجراء (CTA Label)</span>
                            <input
                              type="text"
                              value={section.ctaLabelAr || ''}
                              onChange={(e) => handleUpdateSection(section.id, { ctaLabelAr: e.target.value })}
                              className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: ANNOUNCEMENT BAR */}
      {/* ===================================================================== */}
      {activeTab === 'announcements' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Tag className="w-4 h-4 text-brand-cyan-500" />
              <span>شريط التنبيهات والإعلانات العاجل (أعلى الموقع)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
              <input
                type="checkbox"
                checked={draft.announcementBar.enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    announcementBar: { ...draft.announcementBar, enabled: e.target.checked },
                  })
                }
              />
              <span>تفعيل وإظهار شريط الإعلانات في أعلى الموقع</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block sm:col-span-2">
                <span className="font-bold text-foreground">نص الإعلان أو التنبيه</span>
                <input
                  type="text"
                  value={draft.announcementBar.textAr}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      announcementBar: { ...draft.announcementBar, textAr: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">نص الشارة (Badge)</span>
                <input
                  type="text"
                  value={draft.announcementBar.badgeAr || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      announcementBar: { ...draft.announcementBar, badgeAr: e.target.value },
                    })
                  }
                  placeholder="مثال: جديد"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">الرابط الموجه (Link Destination)</span>
                <input
                  type="text"
                  value={draft.announcementBar.link || ''}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      announcementBar: { ...draft.announcementBar, link: e.target.value },
                    })
                  }
                  placeholder="#plans"
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-mono"
                  dir="ltr"
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: SPECIAL OFFERS */}
      {/* ===================================================================== */}
      {activeTab === 'offers' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>إدارة العروض الترويجية والخصومات الموسمية</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-foreground">
              <input
                type="checkbox"
                checked={draft.specialOffer.enabled}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    specialOffer: { ...draft.specialOffer, enabled: e.target.checked },
                  })
                }
              />
              <span>تفعيل بطاقة العرض الخاص على الموقع العام</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="space-y-1 block">
                <span className="font-bold text-foreground">عنوان العرض الرئيسي</span>
                <input
                  type="text"
                  value={draft.specialOffer.titleAr}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      specialOffer: { ...draft.specialOffer, titleAr: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">قيمة الخصم أو الميزة</span>
                <input
                  type="text"
                  value={draft.specialOffer.discountAr}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      specialOffer: { ...draft.specialOffer, discountAr: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold text-emerald-600 dark:text-emerald-400"
                />
              </label>

              <label className="space-y-1 block sm:col-span-2">
                <span className="font-bold text-foreground">تفاصيل وشروط العرض</span>
                <textarea
                  rows={2}
                  value={draft.specialOffer.descriptionAr}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      specialOffer: { ...draft.specialOffer, descriptionAr: e.target.value },
                    })
                  }
                  className="w-full p-3 rounded-xl border border-border bg-background text-xs"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">تاريخ بداية العرض</span>
                <input
                  type="date"
                  value={draft.specialOffer.startDate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      specialOffer: { ...draft.specialOffer, startDate: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                />
              </label>

              <label className="space-y-1 block">
                <span className="font-bold text-foreground">تاريخ نهاية العرض</span>
                <input
                  type="date"
                  value={draft.specialOffer.endDate}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      specialOffer: { ...draft.specialOffer, endDate: e.target.value },
                    })
                  }
                  className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                />
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: FAQS */}
      {/* ===================================================================== */}
      {activeTab === 'faqs' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-brand-cyan-500" />
              <span>الأسئلة الشائعة والأجوبة (FAQ)</span>
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newFaq = {
                  id: `faq-${Date.now()}`,
                  question: 'سؤال جديد يهم مدراء السناتر؟',
                  answer: 'إجابة نموذجية ومفيدة توضح تفاصيل النظام.',
                  order: draft.faqs.length + 1,
                };
                setDraft({ ...draft, faqs: [...draft.faqs, newFaq] });
              }}
              className="text-xs font-bold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة سؤال جديد</span>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-3 text-xs">
            {draft.faqs.map((faq, idx) => (
              <div key={faq.id} className="p-3 rounded-xl border border-border bg-background space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-muted-foreground font-mono">#{idx + 1}</span>
                  <input
                    type="text"
                    value={faq.question}
                    onChange={(e) => {
                      const faqs = draft.faqs.map((f) => (f.id === faq.id ? { ...f, question: e.target.value } : f));
                      setDraft({ ...draft, faqs });
                    }}
                    className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-card font-bold text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const faqs = draft.faqs.filter((f) => f.id !== faq.id);
                      setDraft({ ...draft, faqs });
                    }}
                    className="text-rose-500 hover:text-rose-600 text-xs px-2"
                  >
                    حذف
                  </button>
                </div>
                <textarea
                  rows={2}
                  value={faq.answer}
                  onChange={(e) => {
                    const faqs = draft.faqs.map((f) => (f.id === faq.id ? { ...f, answer: e.target.value } : f));
                    setDraft({ ...draft, faqs });
                  }}
                  className="w-full p-2.5 rounded-lg border border-border bg-card text-xs"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: TESTIMONIALS */}
      {/* ===================================================================== */}
      {activeTab === 'testimonials' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Award className="w-4 h-4 text-purple-500" />
              <span>آراء وتوصيات العملاء والمعلمين المعتمدين</span>
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newTestimonial = {
                  id: `test-${Date.now()}`,
                  name: 'أ. اسم العميل أو المعلم',
                  role: 'مدير سنتر تعليمي',
                  centerName: 'اسم السنتر',
                  quote: 'شهادة حقيقية عن سرعة التحضير ودقة الحسابات في المنصة.',
                  rating: 5,
                };
                setDraft({ ...draft, testimonials: [...draft.testimonials, newTestimonial] });
              }}
              className="text-xs font-bold gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة تقييم جديد</span>
            </Button>
          </CardHeader>
          <CardContent className="p-5 space-y-3 text-xs">
            {draft.testimonials.map((test, idx) => (
              <div key={test.id} className="p-3 rounded-xl border border-border bg-background space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="الاسم"
                    value={test.name}
                    onChange={(e) => {
                      const testimonials = draft.testimonials.map((t) => (t.id === test.id ? { ...t, name: e.target.value } : t));
                      setDraft({ ...draft, testimonials });
                    }}
                    className="h-8 px-2.5 rounded-lg border border-border bg-card font-bold text-xs"
                  />
                  <input
                    type="text"
                    placeholder="الدور أو المسمى"
                    value={test.role}
                    onChange={(e) => {
                      const testimonials = draft.testimonials.map((t) => (t.id === test.id ? { ...t, role: e.target.value } : t));
                      setDraft({ ...draft, testimonials });
                    }}
                    className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="اسم السنتر"
                      value={test.centerName}
                      onChange={(e) => {
                        const testimonials = draft.testimonials.map((t) => (t.id === test.id ? { ...t, centerName: e.target.value } : t));
                        setDraft({ ...draft, testimonials });
                      }}
                      className="h-8 px-2.5 rounded-lg border border-border bg-card text-xs flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const testimonials = draft.testimonials.filter((t) => t.id !== test.id);
                        setDraft({ ...draft, testimonials });
                      }}
                      className="text-rose-500 hover:text-rose-600 text-xs px-1"
                    >
                      حذف
                    </button>
                  </div>
                </div>
                <textarea
                  rows={2}
                  value={test.quote}
                  onChange={(e) => {
                    const testimonials = draft.testimonials.map((t) => (t.id === test.id ? { ...t, quote: e.target.value } : t));
                    setDraft({ ...draft, testimonials });
                  }}
                  className="w-full p-2.5 rounded-lg border border-border bg-card text-xs"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ===================================================================== */}
      {/* TAB 6: OPINION POLL */}
      {/* ===================================================================== */}
      {activeTab === 'poll' && (
        <Card className="card-elevated">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <span>استطلاع الرأي التفاعلي للزوار</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-5 space-y-4 text-xs">
            {draft.activePoll && (
              <>
                <label className="space-y-1 block">
                  <span className="font-bold text-foreground">سؤال الاستطلاع</span>
                  <input
                    type="text"
                    value={draft.activePoll.questionAr}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        activePoll: { ...draft.activePoll!, questionAr: e.target.value },
                      })
                    }
                    className="w-full h-9 px-3 rounded-xl border border-border bg-background text-xs font-bold"
                  />
                </label>

                <div className="space-y-2">
                  <span className="font-bold text-foreground block">الخيارات المتاحة والأصوات:</span>
                  {draft.activePoll.options.map((opt, idx) => (
                    <div key={opt.id} className="flex items-center gap-2">
                      <span className="w-5 font-mono text-muted-foreground">{idx + 1}.</span>
                      <input
                        type="text"
                        value={opt.textAr}
                        onChange={(e) => {
                          const options = draft.activePoll!.options.map((o) =>
                            o.id === opt.id ? { ...o, textAr: e.target.value } : o
                          );
                          setDraft({
                            ...draft,
                            activePoll: { ...draft.activePoll!, options },
                          });
                        }}
                        className="flex-1 h-8 px-2.5 rounded-lg border border-border bg-background text-xs"
                      />
                      <Badge variant="outline" className="font-mono text-xs w-24 text-center">
                        {opt.votes} صوت
                      </Badge>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* ========================================================================= */}
      {/* LIVE PREVIEW MODAL (DESKTOP, TABLET, MOBILE) */}
      {/* ========================================================================= */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col p-4 animate-in fade-in duration-150">
          {/* Preview Toolbar */}
          <div className="flex items-center justify-between pb-3 border-b border-border/80 text-white">
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm flex items-center gap-2">
                <Eye className="w-4 h-4 text-brand-cyan-400" />
                <span>معاينة الموقع التسويقي العام (مسودة العمل)</span>
              </span>
              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`p-1.5 rounded-lg ${previewDevice === 'desktop' ? 'bg-brand-cyan-500 text-white' : 'text-slate-400'}`}
                  title="كمبيوتر مكتبي"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('tablet')}
                  className={`p-1.5 rounded-lg ${previewDevice === 'tablet' ? 'bg-brand-cyan-500 text-white' : 'text-slate-400'}`}
                  title="جهاز لوحي (تابلت)"
                >
                  <Tablet className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`p-1.5 rounded-lg ${previewDevice === 'mobile' ? 'bg-brand-cyan-500 text-white' : 'text-slate-400'}`}
                  title="هاتف ذكي"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsPreviewOpen(false)}
              className="text-slate-300 hover:text-white text-sm px-3 py-1 rounded-xl bg-slate-800"
            >
              إغلاق المعاينة ✕
            </button>
          </div>

          {/* Device Frame */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <div
              className={`bg-background text-foreground rounded-2xl shadow-2xl border border-slate-700 overflow-y-auto transition-all ${
                previewDevice === 'desktop'
                  ? 'w-full max-w-5xl h-full'
                  : previewDevice === 'tablet'
                  ? 'w-[768px] h-[85vh]'
                  : 'w-[375px] h-[80vh]'
              }`}
              dir="rtl"
            >
              {/* Simulated Rendered Preview Header */}
              {draft.announcementBar.enabled && (
                <div className="bg-brand-cyan-600 text-white text-[11px] font-bold py-1.5 px-4 text-center flex items-center justify-center gap-2">
                  {draft.announcementBar.badgeAr && (
                    <span className="bg-white/20 px-2 py-0.5 rounded-full text-[9px]">
                      {draft.announcementBar.badgeAr}
                    </span>
                  )}
                  <span>{draft.announcementBar.textAr}</span>
                </div>
              )}

              <div className="p-6 space-y-8">
                {/* Simulated Hero */}
                <div className="text-center py-8 space-y-4 max-w-2xl mx-auto">
                  <Badge variant="cyan" className="text-xs">
                    {draft.sections.find((s) => s.id === 'hero')?.badgeAr || 'يلا سنتر SaaS'}
                  </Badge>
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                    {draft.sections.find((s) => s.id === 'hero')?.titleAr}
                  </h1>
                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {draft.sections.find((s) => s.id === 'hero')?.subtitleAr}
                  </p>
                  <div className="pt-2">
                    <span className="px-5 py-2.5 rounded-xl bg-brand-cyan-600 text-white font-bold text-xs inline-block shadow-soft-sm">
                      {draft.sections.find((s) => s.id === 'hero')?.ctaLabelAr || 'ابدأ التجربة'}
                    </span>
                  </div>
                </div>

                {/* Simulated Offer */}
                {draft.specialOffer.enabled && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center space-y-2 max-w-xl mx-auto">
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
                      عرض ترويجي خاص
                    </span>
                    <h3 className="font-bold text-sm text-foreground">{draft.specialOffer.titleAr}</h3>
                    <div className="font-black text-lg text-amber-600 dark:text-amber-400">
                      {draft.specialOffer.discountAr}
                    </div>
                    <p className="text-xs text-muted-foreground">{draft.specialOffer.descriptionAr}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
