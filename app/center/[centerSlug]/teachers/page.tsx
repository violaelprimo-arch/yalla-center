'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Briefcase, Edit3, FileText, Phone, Plus, Search, Trash2, Users,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { TeacherEditor } from '@/components/teachers/teacher-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import type { User } from '@/lib/dal/types';
import { StaffLogin } from '@/components/layout/staff-login';
import { demoTeacherKey, readDemoTeacherProfiles, teacherApi, writeDemoTeacherProfile } from '@/lib/teachers/client';
import {
  describeTeacherLevel, teacherInputFrom, teacherProfileUser, LEGACY_TEACHER_MODELS,
  type ExtraSessionRequest, type TeacherContract, type TeacherInput, type TeacherProfile,
} from '@/lib/teachers/profile';
import { GROUP_PRICING_LABELS, moneyAmount } from '@/lib/timetable/group-schedule';

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

function describeContract(contract: TeacherContract) {
  if ('value' in contract) return contract.model === 'private'
    ? `تعاقد سابق · ${contract.value}% للمعلم` : `تعاقد سابق · ${LEGACY_TEACHER_MODELS[contract.model]} · ${contract.value} ج.م`;
  switch (contract.model) {
    case 'center': return `${GROUP_PRICING_LABELS.center} · ${contract.teacherRate} ج.م للمعلم لكل طالب شهريًا`;
    case 'private': return `${GROUP_PRICING_LABELS.private} · ${contract.teacherPercentage}% للمعلم و${moneyAmount(100 - contract.teacherPercentage)}% للسنتر`;
    case 'per_session': return `${GROUP_PRICING_LABELS.per_session} · ${contract.teacherFee} ج.م للمعلم و${contract.centerFee} ج.م للسنتر لكل طالب في الحصة`;
  }
}

export default function TeachersDirectoryPage() {
  const { tenant } = useTenant();
  return <TeachersDirectory key={tenant.id} />;
}

function TeachersDirectory() {
  const { tenant, currentRole, masterData, groupData } = useTenant();
  const dal = useMemo(getDataProvider, []);
  const { auth, data: masterCatalog } = masterData;
  const demo = !auth.configured;
  const mayManageDemo = currentRole === 'PLATFORM_OWNER' || currentRole === 'CENTER_ADMIN';
  const [baseTeachers, setBaseTeachers] = useState<User[]>();
  const [directory, setDirectory] = useState<{ token: string | null; data: DirectoryData }>();
  const [editor, setEditor] = useState<EditorState>();
  const [query, setQuery] = useState('');
  const [model, setModel] = useState('all');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [archiving, setArchiving] = useState<string>();

  useEffect(() => {
    let active = true;
    dal.getUsers(tenant.id, { role: 'TEACHER' }).then(users => {
      if (active) setBaseTeachers(users.filter(user => user.tenantId === tenant.id));
    }).catch(() => { if (active) setError('تعذّر تحميل دليل المعلمين والمواد'); });
    return () => { active = false; };
  }, [dal, tenant.id]);

  useEffect(() => {
    if (demo) {
      if (!mayManageDemo) return;
      const read = () => {
        try {
          setDirectory({ token: null, data: { profiles: readDemoTeacherProfiles(tenant.id), requests: [] } });
          setError('');
        } catch {
          setDirectory(undefined);
          setError('تعذّر تحميل بيانات المعلمين على هذا المتصفح');
        }
      };
      const sync = (event: StorageEvent) => { if (event.key === demoTeacherKey(tenant.id) || event.key === null) read(); };
      read();
      window.addEventListener('storage', sync);
      return () => window.removeEventListener('storage', sync);
    }
    const token = auth.idToken;
    if (!token) return;
    const request = new AbortController();
    setError('');
    teacherApi<DirectoryData>(tenant.slug, token, '', undefined, request.signal)
      .then(data => { if (!request.signal.aborted) setDirectory({ token, data }); })
      .catch(cause => { if (!request.signal.aborted) setError(cause.message); });
    return () => request.abort();
  }, [demo, mayManageDemo, auth.idToken, tenant.id, tenant.slug, revision]);

  const authorized = Boolean(directory && (demo ? mayManageDemo : auth.idToken && directory.token === auth.idToken));
  const data = authorized ? directory?.data ?? emptyDirectory : emptyDirectory;
  const teachers = useMemo(() => {
    if (!authorized || !baseTeachers) return [];
    const byId = new Map(baseTeachers.map(user => [user.id, { teacher: user, profile: undefined as TeacherProfile | undefined }]));
    for (const profile of data.profiles) {
      byId.set(profile.id, { profile, teacher: teacherProfileUser(profile, byId.get(profile.id)?.teacher) });
    }
    return [...byId.values()].filter(({ teacher }) => teacher.isActive);
  }, [baseTeachers, data.profiles, authorized]);

  const visibleTeachers = teachers.filter(({ teacher, profile }) => {
    const search = query.trim().toLowerCase();
    const found = !search || [teacher.fullName, teacher.phone, profile?.phone2].some(value => value?.toLowerCase().includes(search));
    const hasModel = profile?.contracts.some(contract => contract.model === model) ||
      groupData.groups.some(group => group.teacherId === teacher.id && group.isActive && group.pricingModel === model);
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
      await persistTeacher(teacher.id, profile?.version ?? 0, teacherInputFrom(profile, teacher, groupData.groups), undefined, true);
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
          {authorized && baseTeachers && masterData.ready && <Button onClick={() => { setNotice(''); setEditor({ id: `teacher-${crypto.randomUUID()}` }); }}>
            <Plus size={17} /> إضافة معلم جديد
          </Button>}
        </div>
      </header>

      {error && <p role="alert" className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
        {error}
        {(demo || auth.idToken) && <button className="ms-3 underline" type="button" onClick={() => setRevision(value => value + 1)}>إعادة التحميل</button>}
      </p>}
      {notice && <p role="status" className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {!demo && !auth.idToken && (!auth.loading || auth.error) && <StaffLogin signIn={auth.signIn} failedLogin={Boolean(auth.error)} />}
      {!demo && auth.idToken && <button type="button" onClick={() => void auth.signOut()} className="text-sm text-muted-foreground underline">
        تسجيل خروج حساب الإدارة
      </button>}
      {demo && !mayManageDemo && <p className="text-sm text-muted-foreground">إدارة المعلمين متاحة لمدير السنتر ومالك المنصة.</p>}
      {(auth.loading || (!baseTeachers && authorized) || (auth.idToken && !authorized && !error)) && <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المعلمين…</p>}

      {authorized && baseTeachers && <>
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
              {Object.entries(GROUP_PRICING_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
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
              {!visibleTeachers.length && <tr><td colSpan={4} className="p-10 text-center text-muted-foreground">{teachers.length ? 'لا يوجد معلمون مطابقون للبحث' : 'لا يوجد معلمون مسجلون'}</td></tr>}
              {visibleTeachers.map(({ teacher, profile }) => {
                const groups = groupData.groups.filter(group => group.teacherId === teacher.id && group.isActive);
                const subjectIds = new Set([...(profile?.subjectIds ?? []), ...groups.map(group => group.subjectId)]);
                const subjects = masterCatalog.subjects.filter(subject => subjectIds.has(subject.id));
                const groupModels = [...new Set(groups.map(group => GROUP_PRICING_LABELS[group.pricingModel]))];
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
                        <b>{describeTeacherLevel(contract.level, masterCatalog.stages)}</b><br />
                        {describeContract(contract)}
                      </li>)}
                    </ul> : <span className="text-xs text-muted-foreground">{groupModels.join('، ') || 'لم يُحدد'}</span>}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1.5">
                      <Button variant="outline" size="sm" onClick={() => setEditor({ id: teacher.id, teacher, profile })}><Edit3 size={14} /> تعديل</Button>
                      <Button variant="ghost" size="sm" className="text-red-600 dark:text-red-400" disabled={Boolean(archiving)}
                        onClick={() => void archiveTeacher(teacher, profile)}><Trash2 size={14} /> {archiving === teacher.id ? 'جارٍ الحذف…' : 'حذف'}</Button>
                      <Link href={`/center/${tenant.slug}/finance?tab=payroll&teacherId=${encodeURIComponent(teacher.id)}`}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2 text-xs hover:bg-muted"><FileText size={14} /> كشف الحساب</Link>
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
          initial={teacherInputFrom(editor.profile, editor.teacher, groupData.groups)}
          originalAvatar={baseTeachers.find(user => user.id === editor.id)?.avatarUrl} subjects={masterCatalog.subjects} stages={masterCatalog.stages} onClose={() => setEditor(undefined)}
          onSave={async (input, password) => {
            await persistTeacher(editor.id, editor.profile?.version ?? 0, input, password);
            setEditor(undefined);
            setError('');
            setNotice(editor.teacher ? 'تم تحديث بيانات المعلم' : 'تمت إضافة المعلم');
          }} />}
      </>}
    </div>
  );
}
