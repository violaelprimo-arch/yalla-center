'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, Briefcase, CheckCircle2, Edit3, FileText, Phone, Plus, Search, Trash2, Users, X,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { TeacherEditor } from '@/components/teachers/teacher-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import type { IDataProvider } from '@/lib/dal';
import type { Group, PricingModel, TeacherRate, User, UserRole } from '@/lib/dal/types';
import { StaffLogin } from '@/components/layout/staff-login';
import { readDemoTeacherProfiles, teacherApi, writeDemoTeacherProfile } from '@/lib/teachers/client';
import {
  describeTeacherLevel, teacherInputFrom, teacherProfileUser, TEACHER_MODELS,
  type ExtraSessionRequest, type TeacherInput, type TeacherProfile,
} from '@/lib/teachers/profile';

interface DirectoryData {
  profiles: TeacherProfile[];
  requests: ExtraSessionRequest[];
}

interface EditorState {
  id: string;
  teacher?: User;
  profile?: TeacherProfile;
}

const emptyDirectory: DirectoryData = { profiles: [], requests: [] };
const control = 'rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';

export default function TeachersDirectoryPage() {
  const { tenant } = useTenant();
  return <TeachersDirectory key={tenant.id} />;
}

function TeachersDirectory() {
  const { tenant, currentRole, masterData } = useTenant();
  const dal = useMemo(getDataProvider, []);
  const { auth, data: masterCatalog } = masterData;
  const demo = !auth.configured;
  const mayManageDemo = currentRole === 'PLATFORM_OWNER' || currentRole === 'CENTER_ADMIN';
  const [catalog, setCatalog] = useState<{
    users: User[];
    groups: Group[];
    rates: TeacherRate[];
  }>();
  const [directory, setDirectory] = useState<{ token: string | null; data: DirectoryData }>();
  const [editor, setEditor] = useState<EditorState>();
  const [legacyRate, setLegacyRate] = useState<{ teacher: User; rate: TeacherRate }>();
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [archiving, setArchiving] = useState<string>();

  useEffect(() => {
    let active = true;
    Promise.all([
      dal.getUsers(tenant.id, { role: 'TEACHER' }),
      dal.getGroups(tenant.id),
      dal.getTeacherRates(tenant.id),
    ]).then(([users, groups, rates]) => {
      if (active) {
        setCatalog({
          users: users.filter(user => user.tenantId === tenant.id),
          groups,
          rates,
        });
      }
    }).catch(() => { if (active) setError('تعذّر تحميل دليل المعلمين والمواد'); });
    return () => { active = false; };
  }, [dal, tenant.id, revision]);

  useEffect(() => {
    if (demo) {
      if (!mayManageDemo) return;
      try {
        setDirectory({ token: null, data: { profiles: readDemoTeacherProfiles(tenant.id), requests: [] } });
      } catch {
        setError('تعذّر تحميل بيانات المعلمين على هذا المتصفح');
      }
      return;
    }
    const token = auth.idToken;
    if (!token) return;
    const request = new AbortController();
    setError('');
    teacherApi<DirectoryData>(tenant.slug, token, '', undefined, request.signal)
      .then(data => setDirectory({ token, data }))
      .catch(cause => { if (!request.signal.aborted) setError(cause.message); });
    return () => request.abort();
  }, [demo, mayManageDemo, auth.idToken, tenant.id, tenant.slug, revision]);

  const authorized = demo ? mayManageDemo : Boolean(auth.idToken && directory?.token === auth.idToken);
  const data = authorized ? directory?.data ?? emptyDirectory : emptyDirectory;
  const teachers = useMemo(() => {
    if (!authorized || !catalog) return [];
    const byId = new Map(catalog.users.map(user => [user.id, { teacher: user, profile: undefined as TeacherProfile | undefined }]));
    for (const profile of data.profiles) {
      byId.set(profile.id, { profile, teacher: teacherProfileUser(profile, byId.get(profile.id)?.teacher) });
    }
    return [...byId.values()].filter(({ teacher }) => teacher.isActive);
  }, [catalog, data.profiles, authorized]);

  const visibleTeachers = teachers.filter(({ teacher, profile }) => {
    const search = query.trim().toLowerCase();
    const found = !search || [teacher.fullName, teacher.phone, profile?.phone2].some(value => value?.toLowerCase().includes(search));
    const rates = catalog?.rates.filter(rate => rate.teacherId === teacher.id && rate.isActive) ?? [];
    const hasModel = profile?.contracts.length
      ? profile.contracts.some(contract => contract.model === model)
      : rates.some(rate => rate.model === model);
    return found && (model === 'all' || hasModel);
  });

  async function persistTeacher(id: string, version: number, input: TeacherInput, password?: string, archive = false) {
    if (!authorized) throw new Error('يلزم حساب إدارة السنتر');
    const profile = demo
      ? { ...input, id, tenantId: tenant.id, active: !archive, version: version + 1, updatedAt: new Date().toISOString() }
      : (await teacherApi<{ profile: TeacherProfile }>(tenant.slug, auth.idToken!, '', archive
        ? { action: 'archive', id, version }
        : { action: 'save', id, version, input, password })).profile;
    if (demo) {
      setDirectory({ token: null, data: { profiles: writeDemoTeacherProfile(profile), requests: [] } });
    } else {
      setDirectory(previous => previous?.token === auth.idToken ? {
        ...previous,
        data: { ...previous.data, profiles: [...previous.data.profiles.filter(record => record.id !== id), profile] },
      } : previous);
    }
  }

  async function archiveTeacher(teacher: User, profile?: TeacherProfile) {
    if (!window.confirm(`حذف ${teacher.fullName} من قائمة المعلمين وإيقاف دخوله؟ سجل الحصص والحسابات هيفضل متاح للإدارة.`)) return;
    setArchiving(teacher.id);
    setNotice('');
    setError('');
    try {
      await persistTeacher(teacher.id, profile?.version ?? 0, teacherInputFrom(profile, teacher, catalog?.groups), undefined, true);
      setNotice('تم حذف المعلم من القائمة وإيقاف دخوله إلى البوابة');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حذف المعلم');
    } finally {
      setArchiving(undefined);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black sm:text-3xl">
            <Briefcase className="text-brand-cyan-600" size={29} /> شؤون المعلمين
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{tenant.nameAr} · بيانات المعلمين والتعاقدات والصلاحيات</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/teacher/${tenant.slug}`} className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted">بوابة دخول المعلمين</Link>
          {authorized && catalog && masterData.ready && <Button onClick={() => { setNotice(''); setEditor({ id: `teacher-${crypto.randomUUID()}` }); }}>
            <Plus size={17} /> إضافة معلم جديد
          </Button>}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
        {error}
        {auth.idToken && <button className="ms-3 underline" type="button" onClick={() => setRevision(value => value + 1)}>إعادة التحميل</button>}
      </p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {!demo && !auth.idToken && (!auth.loading || auth.error) && <StaffLogin signIn={auth.signIn} failedLogin={Boolean(auth.error)} />}
      {!demo && auth.idToken && <button type="button" onClick={() => void auth.signOut()} className="text-sm text-muted-foreground underline">
        تسجيل خروج حساب الإدارة
      </button>}
      {demo && !mayManageDemo && <p className="text-sm text-muted-foreground">إدارة المعلمين متاحة لمدير السنتر ومالك المنصة.</p>}
      {(auth.loading || (!catalog && authorized) || (auth.idToken && !authorized && !error)) && <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المعلمين…</p>}

      {authorized && catalog && <>
        <section className="card-elevated rounded-2xl border border-border p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="cyan" className="gap-1"><Users size={14} /> {teachers.length} معلم نشط</Badge>
            {demo && <span className="text-xs text-muted-foreground">نسخة تجريبية · الحفظ على هذا المتصفح</span>}
            <div className="relative min-w-52 flex-1">
              <Search size={16} className="absolute end-3 top-3 text-muted-foreground" />
              <input aria-label="بحث المعلمين" placeholder="بحث بالاسم أو رقم الهاتف" className={control + ' w-full pe-10'}
                value={query} onChange={event => setQuery(event.target.value)} />
            </div>
            <select aria-label="طريقة التعاقد" className={control} value={model} onChange={event => setModel(event.target.value)}>
              <option value="all">كل طرق الحساب</option>
              <option value="center">متوسط الحضور · عقود سابقة</option>
              {Object.entries(TEACHER_MODELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </div>
        </section>

        <div className="card-elevated overflow-x-auto rounded-2xl border border-border">
          <table className="min-w-[780px] w-full text-start text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="p-4 text-start">المعلم</th>
                <th className="p-4 text-start">المواد والمجموعات</th>
                <th className="p-4 text-start">العقود حسب المرحلة أو الصف</th>
                <th className="p-4 text-start">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!visibleTeachers.length && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">لا يوجد معلمون مطابقون للبحث</td></tr>}
              {visibleTeachers.map(({ teacher, profile }) => {
                const groups = catalog.groups.filter(group => group.teacherId === teacher.id && group.isActive);
                const subjectIds = new Set([...(profile?.subjectIds ?? []), ...groups.map(group => group.subjectId)]);
                const subjects = masterCatalog.subjects.filter(subject => subjectIds.has(subject.id));
                const rate = catalog.rates.find(item => item.teacherId === teacher.id && item.isActive);
                return <tr key={teacher.id} className="hover:bg-muted/20">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <img className="size-11 rounded-xl border border-border object-cover" alt=""
                        src={teacher.avatarUrl || '/brand/yalla-center-icon.png'} />
                      <div>
                        <p className="font-bold">{teacher.fullName}</p>
                        {[teacher.phone, profile?.phone2].filter(Boolean).map(phone => <p key={phone} className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone size={12} /> <span dir="ltr">{phone}</span>
                        </p>)}
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">{subjects.map(subject => <Badge key={subject.id} variant="outline">{subject.nameAr}</Badge>)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{groups.length} مجموعات نشطة</p>
                  </td>
                  <td className="p-4">
                    {profile?.contracts.length ? <ul className="space-y-1 text-xs">
                      {profile.contracts.map(contract => <li key={contract.level}>
                        <b>{describeTeacherLevel(contract.level)}</b><br />
                        {TEACHER_MODELS[contract.model]} · {contract.value}{contract.model === 'private' ? '%' : ' ج.م'}
                      </li>)}
                    </ul> : rate ? <span className="text-xs text-muted-foreground">{rate.model === 'private'
                      ? `برايفت · ${rate.teacherPercentage}% للمعلم`
                      : `متوسط الحضور · ${rate.fixedRatePerStudent} ج.م`}</span> : <span className="text-xs text-muted-foreground">لم يُحدد</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditor({ id: teacher.id, teacher, profile })}><Edit3 size={14} /> تعديل</Button>
                      <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" disabled={Boolean(archiving)}
                        onClick={() => void archiveTeacher(teacher, profile)}><Trash2 size={14} /> {archiving === teacher.id ? 'جارٍ الحذف…' : 'حذف'}</Button>
                      <Link href={`/center/${tenant.slug}/finance?tab=payroll&teacherId=${encodeURIComponent(teacher.id)}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-muted"><FileText size={14} /> كشف الحساب</Link>
                      {demo && rate && !profile?.contracts.length && <Button variant="ghost" size="sm" onClick={() => setLegacyRate({ teacher, rate })}>العقد السابق</Button>}
                    </div>
                  </td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>

        {data.requests.length > 0 && <section className="card-elevated space-y-3 rounded-2xl border border-border p-4">
          <h2 className="font-bold">طلبات المحاضرات الإضافية</h2>
          <ul className="divide-y divide-border text-sm">
            {data.requests.map(request => <li key={request.teacherId + request.id} className="py-2">
              <b>{request.teacherName}</b> · {request.groupName} · <span dir="ltr">{request.date} {request.time}</span>
              {request.note && <p className="mt-1 text-muted-foreground">{request.note}</p>}
            </li>)}
          </ul>
        </section>}

        {editor && <TeacherEditor key={editor.id} editing={Boolean(editor.teacher)} demo={demo}
          initial={teacherInputFrom(editor.profile, editor.teacher, catalog.groups)}
          originalAvatar={catalog.users.find(user => user.id === editor.id)?.avatarUrl} subjects={masterCatalog.subjects} stages={masterCatalog.stages} onClose={() => setEditor(undefined)}
          onSave={async (input, password) => {
            await persistTeacher(editor.id, editor.profile?.version ?? 0, input, password);
            setEditor(undefined);
            setError('');
            setNotice(editor.teacher ? 'تم تحديث بيانات المعلم' : 'تمت إضافة المعلم');
          }} />}
      </>}
      {legacyRate && authorized && demo && <TeacherRateModal teacher={legacyRate.teacher} currentRate={legacyRate.rate}
        currentRole={currentRole} onClose={() => setLegacyRate(undefined)} onSuccess={() => {
          setLegacyRate(undefined);
          setRevision(value => value + 1);
        }} dal={dal} />}
    </div>
  );
}

function TeacherRateModal({
  teacher,
  currentRate,
  currentRole,
  onClose,
  onSuccess,
  dal,
}: {
  teacher: User;
  currentRate: TeacherRate;
  currentRole: UserRole;
  onClose: () => void;
  onSuccess: () => void;
  dal: IDataProvider;
}) {
  const [model, setModel] = useState<PricingModel>(currentRate.model || 'center');
  const [fixedRate, setFixedRate] = useState<number>(currentRate.fixedRatePerStudent ?? 20);
  const [teacherPercentage, setTeacherPercentage] = useState<number>(currentRate.teacherPercentage ?? 70);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const centerPercentage = useMemo(() => {
    return Math.max(0, 100 - teacherPercentage);
  }, [teacherPercentage]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Invariant check: teacher + center === 100%
    if (model === 'private' && (teacherPercentage < 0 || teacherPercentage > 100)) {
      setErrorMessage('مجموع نسبة المعلم ونسبة السنتر يجب أن يساوي 100% بالضبط دون تسريب');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const rateId = currentRate.id;
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
                نظام السنتر (متوسط الحضور)
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
