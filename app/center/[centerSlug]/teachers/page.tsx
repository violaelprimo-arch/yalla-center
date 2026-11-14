'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  Edit3,
  FileSpreadsheet,
  Phone,
  Plus,
  Search,
  Trash2,
  Users,
  ExternalLink,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { TeacherEditor } from '@/components/teachers/teacher-editor';
import { SessionsGroupsView } from '@/components/sessions/sessions-groups-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import type { User } from '@/lib/dal/types';
import { demoTeacherKey, readDemoTeacherProfiles, teacherApi, writeDemoTeacherProfile } from '@/lib/teachers/client';
import {
  teacherInputFrom,
  teacherProfileUser,
  type ExtraSessionRequest,
  type TeacherInput,
  type TeacherProfile,
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
const control =
  'rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500';

export default function TeachersDirectoryPage() {
  const { tenant } = useTenant();
  return <TeachersDirectory key={tenant.id} />;
}

function TeachersDirectory() {
  const { tenant, currentRole, groupData, masterData } = useTenant();
  const { auth, data: { stages, subjects: centerSubjects } } = masterData;
  const { groups: centerGroups } = groupData;
  const dal = useMemo(getDataProvider, []);
  const demo = !auth.configured;
  const mayManageDemo = currentRole === 'PLATFORM_OWNER' || currentRole === 'CENTER_ADMIN';
  const [activeTab, setActiveTab] = useState<'directory' | 'accounting'>('directory');
  const [selectedTeacherForAccounting, setSelectedTeacherForAccounting] = useState<string>('');
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
    dal.getUsers(tenant.id, { role: 'TEACHER' })
      .then(users => { if (active) setBaseTeachers(users.filter(user => user.tenantId === tenant.id)); })
      .catch(() => {
        if (active) setError('تعذّر تحميل دليل المعلمين والمواد');
      });
    return () => {
      active = false;
    };
  }, [dal, tenant.id]);

  useEffect(() => {
    if (demo) {
      if (!mayManageDemo) return;
      const load = () => {
        try {
          setDirectory({ token: null, data: { profiles: readDemoTeacherProfiles(tenant.id), requests: [] } });
          setError('');
        } catch {
          setDirectory(undefined);
          setError('تعذّر تحميل بيانات المعلمين على هذا المتصفح');
        }
      };
      const sync = (event: StorageEvent) => { if (event.key === demoTeacherKey(tenant.id) || event.key === null) load(); };
      load();
      window.addEventListener('storage', sync);
      return () => window.removeEventListener('storage', sync);
    }
    const token = auth.idToken;
    if (!token) return;
    const request = new AbortController();
    setError('');
    teacherApi<DirectoryData>(tenant.slug, token, '', undefined, request.signal)
      .then(data => { if (!request.signal.aborted) setDirectory({ token, data }); })
      .catch((cause) => {
        if (!request.signal.aborted) setError(cause.message);
      });
    return () => request.abort();
  }, [demo, mayManageDemo, auth.idToken, tenant.id, tenant.slug, revision]);

  const authorized = Boolean(directory && (demo ? mayManageDemo : auth.idToken && directory.token === auth.idToken));
  const data = authorized ? directory?.data ?? emptyDirectory : emptyDirectory;
  const teachers = useMemo(() => {
    if (!authorized || !baseTeachers) return [];
    const byId = new Map(
      baseTeachers.map((user) => [user.id, { teacher: user, profile: undefined as TeacherProfile | undefined }])
    );
    for (const profile of data.profiles) {
      byId.set(profile.id, { profile, teacher: teacherProfileUser(profile, byId.get(profile.id)?.teacher) });
    }
    return [...byId.values()].filter(({ teacher }) => teacher.isActive);
  }, [baseTeachers, data.profiles, authorized]);

  const visibleTeachers = teachers.filter(({ teacher }) => {
    const search = query.trim().toLowerCase();
    const found =
      !search ||
      [teacher.fullName, teacher.phone].some((value) => value?.toLowerCase().includes(search));
    const teacherGroups = centerGroups.filter((g) => g.teacherId === teacher.id && g.isActive) ?? [];
    const hasModel =
      model === 'all' ||
      teacherGroups.some((g) => g.pricingModel === model);
    return found && hasModel;
  });

  async function persistTeacher(id: string, version: number, input: TeacherInput, password?: string, archive = false) {
    if (!authorized) throw new Error('يلزم حساب إدارة السنتر');
    const profile = demo
      ? { ...input, id, tenantId: tenant.id, active: !archive, version: version + 1, updatedAt: new Date().toISOString() }
      : (
          await teacherApi<{ profile: TeacherProfile }>(
            tenant.slug,
            auth.idToken!,
            '',
            archive
              ? { action: 'archive', id, version }
              : { action: 'save', id, version, input, password }
          )
        ).profile;
    if (demo) {
      setDirectory({ token: null, data: { profiles: writeDemoTeacherProfile(profile), requests: [] } });
    } else {
      setDirectory((previous) =>
        previous?.token === auth.idToken
          ? {
              ...previous,
              data: {
                ...previous.data,
                profiles: [...previous.data.profiles.filter((record) => record.id !== id), profile],
              },
            }
          : previous
      );
    }
  }

  async function archiveTeacher(teacher: User, profile?: TeacherProfile) {
    if (!window.confirm(`حذف ${teacher.fullName} من قائمة المعلمين وإيقاف دخوله؟ سجل الحصص والحسابات هيفضل متاح للإدارة.`))
      return;
    setArchiving(teacher.id);
    setNotice('');
    setError('');
    try {
      await persistTeacher(
        teacher.id,
        profile?.version ?? 0,
        teacherInputFrom(profile, teacher, centerGroups),
        undefined,
        true
      );
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
          <p className="mt-1 text-sm text-muted-foreground">
            {tenant.nameAr} · بيانات المعلمين والتعاقدات والصلاحيات والحسابات الموحدة
          </p>
          <div className="flex items-center gap-1.5 mt-3 bg-muted/40 p-1 rounded-xl border border-border w-fit print:hidden">
            <button
              type="button"
              onClick={() => setActiveTab('directory')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'directory'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Users size={14} />
              <span>دليل المعلمين</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accounting')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'accounting'
                  ? 'bg-card text-brand-cyan-600 shadow-sm border border-brand-cyan-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>الحسابات والمستحقات</span>
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/teacher/${tenant.slug}`}
            className="rounded-xl border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            بوابة دخول المعلمين
          </Link>
          {authorized && baseTeachers && (
            <Button
              disabled={!masterData.ready}
              onClick={() => {
                setNotice('');
                setEditor({ id: `teacher-${crypto.randomUUID()}` });
                setActiveTab('directory');
              }}
            >
              <Plus size={17} /> إضافة معلم جديد
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"
        >
          {error}
          {auth.idToken && (
            <button
              className="ms-3 underline"
              type="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              إعادة التحميل
            </button>
          )}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-700 dark:text-emerald-300"
        >
          {notice}
        </p>
      )}

      {!demo && !auth.idToken && (!auth.loading || auth.error) && (
        <StaffLogin signIn={auth.signIn} failedLogin={Boolean(auth.error)} />
      )}
      {!demo && auth.idToken && (
        <button
          type="button"
          onClick={() => void auth.signOut()}
          className="text-sm text-muted-foreground underline"
        >
          تسجيل خروج حساب الإدارة
        </button>
      )}
      {demo && !mayManageDemo && (
        <p className="text-sm text-muted-foreground">إدارة المعلمين متاحة لمدير السنتر ومالك المنصة.</p>
      )}
      {(auth.loading || (!baseTeachers && authorized) || (auth.idToken && !authorized && !error)) && (
        <p role="status" className="text-sm text-muted-foreground">
          جارٍ تحميل المعلمين…
        </p>
      )}

      {authorized && baseTeachers && (
        activeTab === 'accounting' ? (
          <div className="space-y-4">
            {/* Teacher Selector Toolbar for Accounting View */}
            <div className="card-elevated p-4 rounded-2xl border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 no-print">
              <div className="flex flex-wrap items-center gap-3">
                <label className="text-xs font-bold text-muted-foreground whitespace-nowrap">
                  عرض حسابات ومجموعات المعلم:
                </label>
                <select
                  value={selectedTeacherForAccounting || visibleTeachers[0]?.teacher.id || ''}
                  onChange={(e) => setSelectedTeacherForAccounting(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold bg-background border border-border rounded-xl focus:ring-2 focus:ring-brand-cyan-500"
                >
                  {visibleTeachers.map(({ teacher }) => {
                    const tGroupsCount = centerGroups.filter((g) => g.teacherId === teacher.id && g.isActive).length;
                    return (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.fullName} ({tGroupsCount} مجموعات)
                      </option>
                    );
                  })}
                </select>
              </div>
              <Link
                href={`/center/${tenant.slug}/sessions`}
                className="text-xs font-bold text-brand-cyan-600 dark:text-brand-cyan-400 hover:underline flex items-center gap-1 self-end sm:self-auto"
              >
                <span>إدارة وإضافة المجموعات في تبويب الحصص والمجموعات ←</span>
              </Link>
            </div>

            {/* Same Component as Sessions & Groups View, Filtered by Teacher */}
            <SessionsGroupsView
              key={selectedTeacherForAccounting || visibleTeachers[0]?.teacher.id}
              initialTeacherId={selectedTeacherForAccounting || visibleTeachers[0]?.teacher.id}
              lockTeacherFilter={true}
              allowGroupManagement={false}
              title="نظام حسابات الحصص والمجموعات للمعلم"
              subtitle="استعراض مجموعات المعلم، المواعيد الأسبوعية، وطريقة الحساب المعتمدة من الحصص والمجموعات."
            />
          </div>
        ) : (
          <>
            <section className="card-elevated rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="cyan" className="gap-1">
                  <Users size={14} /> {teachers.length} معلم نشط
                </Badge>
                {demo && <span className="text-xs text-muted-foreground">نسخة تجريبية · الحفظ على هذا المتصفح</span>}
                <div className="relative min-w-52 flex-1">
                  <Search size={16} className="absolute end-3 top-3 text-muted-foreground" />
                  <input
                    aria-label="بحث المعلمين"
                    placeholder="بحث بالاسم أو رقم الهاتف"
                    className={control + ' w-full pe-10'}
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </div>
                <select
                  aria-label="طريقة التعاقد"
                  className={control}
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                >
                  <option value="all">كل طرق الحساب</option>
                  <option value="average_monthly">نظام المتوسط</option>
                  <option value="private">نظام البرايفت (النسبة)</option>
                  <option value="per_session">نظام الدفع بالحصة</option>
                </select>
              </div>
            </section>

            <div className="card-elevated overflow-x-auto rounded-2xl border border-border">
              <table className="min-w-[780px] w-full text-start text-sm">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="p-4 text-start">المعلم</th>
                    <th className="p-4 text-start">المواد الدراسية</th>
                    <th className="p-4 text-start">مجموعات ونظام حساب المعلم</th>
                    <th className="p-4 text-start">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {!visibleTeachers.length && (
                    <tr>
                      <td colSpan={4} className="p-10 text-center text-muted-foreground">
                        لا يوجد معلمون مطابقون للبحث
                      </td>
                    </tr>
                  )}
                  {visibleTeachers.map(({ teacher, profile }) => {
                    const groups = centerGroups.filter((group) => group.teacherId === teacher.id && group.isActive);
                    const subjectIds = new Set([
                      ...(profile?.subjectIds ?? []),
                      ...groups.map((group) => group.subjectId),
                    ]);
                    const subjects = centerSubjects.filter((subject) => subjectIds.has(subject.id));

                    return (
                      <tr key={teacher.id} className="hover:bg-muted/20">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              className="size-11 rounded-xl border border-border object-cover"
                              alt=""
                              src={teacher.avatarUrl || '/brand/yalla-center-icon.png'}
                            />
                            <div>
                              <p className="font-bold">{teacher.fullName}</p>
                              {[teacher.phone, profile?.phone2].filter(Boolean).map((phone) => (
                                <p
                                  key={phone}
                                  className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"
                                >
                                  <Phone size={12} /> <span dir="ltr">{phone}</span>
                                </p>
                              ))}
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {subjects.map((subject) => (
                              <Badge key={subject.id} variant="outline">
                                {subject.nameAr}
                              </Badge>
                            ))}
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">{groups.length} مجموعات نشطة</p>
                        </td>
                        <td className="p-4">
                          {groups.length > 0 ? (
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap gap-1.5">
                                {groups.map((group) => {
                                  const isCenter =
                                    group.pricingModel === 'center';
                                  const isPrivate =
                                    group.pricingModel === 'private';
                                  return (
                                    <span
                                      key={group.id}
                                      className={`text-[10px] px-2 py-0.5 rounded-md font-bold flex items-center gap-1 ${
                                        isCenter
                                          ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                                          : isPrivate
                                          ? 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                                          : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                      }`}
                                      title={group.nameAr}
                                    >
                                      <span>{group.nameAr}</span>
                                      <span className="opacity-80">
                                        (
                                        {isCenter
                                          ? group.pricing?.model === 'center' ? `متوسط · ${group.pricing.teacherRate} ج.م` : 'متوسط'
                                          : isPrivate
                                          ? group.pricing?.model === 'private' ? `برايفت · ${group.pricing.teacherPercentage}%` : 'برايفت'
                                          : `بالحصة · ${group.sessionFee} ج.م`}
                                        )
                                      </span>
                                    </span>
                                  );
                                })}
                              </div>
                              <p className="text-[11px] text-muted-foreground font-semibold">
                                {groups.length} مجموعات مسندة للمعلم
                              </p>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">لا توجد مجموعات مسندة</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditor({ id: teacher.id, teacher, profile })}
                            >
                              <Edit3 size={14} /> تعديل
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTeacherForAccounting(teacher.id);
                                setActiveTab('accounting');
                              }}
                              className="border-brand-cyan-500/40 text-brand-cyan-600 hover:bg-brand-cyan-500/10 font-bold"
                            >
                              <FileSpreadsheet size={14} /> الحسابات والمجموعات
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 dark:text-red-400"
                              disabled={Boolean(archiving)}
                              onClick={() => void archiveTeacher(teacher, profile)}
                            >
                              <Trash2 size={14} /> {archiving === teacher.id ? 'جارٍ الحذف…' : 'حذف'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {data.requests.length > 0 && (
              <section className="card-elevated space-y-3 rounded-2xl border border-border p-4">
                <h2 className="font-bold">طلبات المحاضرات الإضافية</h2>
                <ul className="divide-y divide-border text-sm">
                  {data.requests.map((request) => (
                    <li key={request.teacherId + request.id} className="py-2">
                      <b>{request.teacherName}</b> · {request.groupName} ·{' '}
                      <span dir="ltr">
                        {request.date} {request.time}
                      </span>
                      {request.note && <p className="mt-1 text-muted-foreground">{request.note}</p>}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {editor && (
              <TeacherEditor
                key={editor.id}
                editing={Boolean(editor.teacher)}
                demo={demo}
                teacherId={editor.teacher?.id || editor.id}
                tenantId={tenant.id}
                tenantSlug={tenant.slug}
                initial={teacherInputFrom(editor.profile, editor.teacher, centerGroups)}
                originalAvatar={baseTeachers.find((user) => user.id === editor.id)?.avatarUrl}
                subjects={centerSubjects}
                stages={stages}
                onClose={() => setEditor(undefined)}
                onSave={async (input, password) => {
                  await persistTeacher(editor.id, editor.profile?.version ?? 0, input, password);
                  setEditor(undefined);
                  setError('');
                  setNotice(editor.teacher ? 'تم تحديث بيانات المعلم' : 'تمت إضافة المعلم');
                }}
              />
            )}
          </>
        )
      )}
    </div>
  );
}

function StaffLogin({
  signIn,
  failedLogin,
}: {
  signIn: (email: string, password: string) => Promise<void>;
  failedLogin: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFailed(false);
    try {
      await signIn(email, password);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className="card-elevated max-w-md space-y-3 rounded-2xl border border-border p-4">
      <h2 className="font-bold">دخول إدارة السنتر</h2>
      <label className="block text-sm">
        البريد الإلكتروني
        <input
          className={control + ' mt-1 block w-full'}
          dir="ltr"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        كلمة المرور
        <input
          className={control + ' mt-1 block w-full'}
          dir="ltr"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {(failed || failedLogin) && (
        <p role="alert" className="text-sm text-red-600">
          تعذّر تسجيل الدخول. راجع البريد وكلمة المرور.
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? 'جارٍ تسجيل الدخول…' : 'دخول'}
      </Button>
    </form>
  );
}
