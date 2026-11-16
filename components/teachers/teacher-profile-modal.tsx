'use client';

import React from 'react';
import {
  X,
  Phone,
  MessageCircle,
  Briefcase,
  Layers,
  BookOpen,
  DollarSign,
  Calendar,
  Users,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  UserRound,
  ExternalLink,
  Edit3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Group, Subject, EducationalStage, User } from '@/lib/dal/types';
import {
  TEACHER_PERMISSIONS,
  TEACHER_TABS,
  LEGACY_TEACHER_MODELS,
  type TeacherProfile,
  type TeacherPermission,
  type TeacherTab,
} from '@/lib/teachers/profile';
import { getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';

interface Props {
  teacher: User;
  profile?: TeacherProfile;
  stages: EducationalStage[];
  subjects: Subject[];
  groups: Group[];
  onEdit: () => void;
  onClose: () => void;
}

export function TeacherProfileModal({
  teacher,
  profile,
  stages,
  subjects,
  groups,
  onEdit,
  onClose,
}: Props) {
  const avatar = profile?.avatarData || teacher.avatarUrl;
  const teacherGroups = groups.filter((g) => g.teacherId === teacher.id && g.isActive);

  // Collect subject IDs
  const subjectIds = new Set([
    ...(profile?.subjectIds ?? []),
    ...teacherGroups.map((g) => g.subjectId),
  ]);
  const teacherSubjects = subjects.filter((s) => subjectIds.has(s.id));

  // WhatsApp link generator
  const getWhatsAppLink = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    const num = clean.startsWith('0') ? '20' + clean.slice(1) : clean;
    return `https://wa.me/${num}`;
  };

  return (
    <dialog
      open
      dir="rtl"
      onCancel={onClose}
      className="m-auto max-h-[92dvh] w-[min(94vw,740px)] overflow-hidden rounded-3xl border border-border bg-card text-foreground shadow-2xl backdrop:bg-black/60 transition-all p-0"
    >
      <div className="flex max-h-[92dvh] flex-col">
        {/* Header Banner */}
        <div className="p-6 border-b border-border bg-gradient-to-l from-brand-cyan-500/10 via-muted/30 to-background flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-border bg-muted flex items-center justify-center shrink-0 shadow-md">
              {avatar ? (
                <img src={avatar} alt={teacher.fullName} className="w-full h-full object-cover" />
              ) : (
                <UserRound size={32} className="text-muted-foreground" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg font-black text-foreground">{teacher.fullName}</h2>
                <Badge variant={teacher.isActive ? 'cyan' : 'outline'} className="text-[10px]">
                  {teacher.isActive ? 'حساب نشط' : 'غير نشط'}
                </Badge>
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                {teacher.phone && (
                  <span className="flex items-center gap-1 font-mono">
                    <Phone size={12} className="text-brand-cyan-600" />
                    <span>{teacher.phone}</span>
                  </span>
                )}
                {profile?.phone2 && (
                  <span className="flex items-center gap-1 font-mono text-[11px]">
                    <span>هاتف 2:</span> {profile.phone2}
                  </span>
                )}
                {teacher.email && (
                  <span className="font-mono text-[11px] bg-muted/60 px-2 py-0.5 rounded-md">
                    {teacher.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-xl text-muted-foreground hover:text-foreground"
          >
            <X size={18} />
          </Button>
        </div>

        {/* Content Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Quick Contact & Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap pb-2 border-b border-border/70">
            {teacher.phone && (
              <>
                <a
                  href={`tel:${teacher.phone}`}
                  className="px-3 py-1.5 rounded-xl border border-border bg-card hover:bg-muted text-xs font-bold text-foreground flex items-center gap-1.5 transition-colors"
                >
                  <Phone size={13} className="text-emerald-500" />
                  <span>اتصال هاتفي</span>
                </a>
                <a
                  href={getWhatsAppLink(teacher.phone)}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 transition-colors"
                >
                  <MessageCircle size={13} />
                  <span>مراسلة واتساب</span>
                </a>
              </>
            )}
            <Button
              type="button"
              onClick={onEdit}
              className="px-3 py-1.5 rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white text-xs font-bold flex items-center gap-1.5 ms-auto"
            >
              <Edit3 size={13} />
              <span>تعديل بيانات المعلم</span>
            </Button>
          </div>

          {/* Section: Educational Stages & Stage Financial Agreements */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers size={14} className="text-brand-cyan-600" />
              <span>المراحل التعليمية والاتفاقات المالية</span>
            </h3>

            {profile?.contracts && profile.contracts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {profile.contracts.map((contract) => {
                  const stage = stages.find((s) => s.id === contract.level);
                  const stageName = stage ? stage.nameAr : getStageNameArabic(contract.level);
                  const modelKey = 'model' in contract ? contract.model : 'fixed_session';
                  const modelTitle =
                    LEGACY_TEACHER_MODELS[modelKey as keyof typeof LEGACY_TEACHER_MODELS] || modelKey;
                  const value = 'value' in contract ? contract.value : 0;

                  return (
                    <div
                      key={contract.level}
                      className="p-3.5 rounded-2xl border border-border bg-muted/20 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{stageName}</span>
                        <Badge variant="cyan" className="text-[10px]">
                          {modelKey === 'per_attendee' && 'أجر لكل طالب'}
                          {modelKey === 'fixed_session' && 'أجر ثابت للحصة'}
                          {modelKey === 'private' && 'نسبة مئوية'}
                          {modelKey === 'center' && 'متوسط الحضور'}
                        </Badge>
                      </div>
                      <p className="text-xs font-semibold text-brand-cyan-600 dark:text-brand-cyan-400">
                        {modelTitle}
                      </p>
                      <div className="text-[11px] text-muted-foreground flex items-center justify-between pt-1 border-t border-border/50">
                        <span>القيمة المتفق عليها:</span>
                        <b className="font-mono text-foreground font-black">
                          {value} {modelKey === 'private' ? '%' : 'ج.م'}
                        </b>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-muted/30 border border-border text-xs text-muted-foreground">
                لم يتم إعداد اتفاقات مالية محددة للمراحل بعد؛ يعتمد نظام الحساب على إعدادات المجموعات.
              </div>
            )}
          </div>

          {/* Section: Subjects */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} className="text-brand-cyan-600" />
              <span>المواد الدراسية ({teacherSubjects.length})</span>
            </h3>

            {teacherSubjects.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {teacherSubjects.map((sub) => (
                  <span
                    key={sub.id}
                    className="px-2.5 py-1 rounded-xl text-xs font-bold bg-muted/50 border border-border text-foreground flex items-center gap-1.5"
                  >
                    <span>{sub.nameAr}</span>
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({getGradeNameArabic(sub.grade)})
                    </span>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">لا توجد مواد مسندة للمعلم بعد.</p>
            )}
          </div>

          {/* Section: Assigned Groups */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
                <Users size={14} className="text-brand-cyan-600" />
                <span>المجموعات الدراسية المسندة ({teacherGroups.length})</span>
              </h3>
            </div>

            {teacherGroups.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {teacherGroups.map((group) => (
                  <div
                    key={group.id}
                    className="p-3 rounded-xl border border-border bg-card text-xs space-y-1 shadow-soft-sm"
                  >
                    <p className="font-bold text-foreground truncate">{group.nameAr}</p>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        <span>{group.scheduleDay || 'موعد أسبوعي'}</span>
                      </span>
                      <Badge variant="outline" className="text-[9px]">
                        {group.pricingModel === 'per_session'
                          ? 'دفع بالحصة'
                          : group.pricingModel === 'private'
                          ? 'برايفت'
                          : 'نظام السنتر'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">لا توجد مجموعات نشطة مسندة للمعلم في جدول الحصص.</p>
            )}
          </div>

          {/* Section: Permissions & Portal Tabs */}
          <div className="space-y-3">
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={14} className="text-brand-cyan-600" />
              <span>الصلاحيات والتبويبات المتاحة في البوابة</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {(Object.keys(TEACHER_PERMISSIONS) as TeacherPermission[]).map((perm) => {
                const granted = profile?.permissions?.includes(perm) ?? false;
                return (
                  <div
                    key={perm}
                    className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                      granted
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-bold'
                        : 'bg-muted/20 border-border text-muted-foreground opacity-60'
                    }`}
                  >
                    {granted ? (
                      <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                    ) : (
                      <XCircle size={14} className="shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{TEACHER_PERMISSIONS[perm]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl text-xs font-bold">
            إغلاق
          </Button>
        </div>
      </div>
    </dialog>
  );
}
