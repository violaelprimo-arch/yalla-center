'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
  Eye,
  Check,
  X,
  ExternalLink,
  ShieldCheck,
  UserCheck,
  UserX,
  Layers,
  BookOpen,
  Calendar,
  Wallet,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { TeacherEditor } from '@/components/teachers/teacher-editor';
import { TeacherProfileModal } from '@/components/teachers/teacher-profile-modal';
import { TeacherAccountingView } from '@/components/teachers/teacher-accounting-view';
import { SessionsGroupsView } from '@/components/sessions/sessions-groups-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getDataProvider } from '@/lib/dal/factory';
import type { User, Group, Subject, TeacherMonthlyStatement } from '@/lib/dal/types';
import { demoTeacherKey, readDemoTeacherProfiles, teacherApi, writeDemoTeacherProfile } from '@/lib/teachers/client';
import {
  teacherInputFrom,
  teacherProfileUser,
  LEGACY_TEACHER_MODELS,
  type ExtraSessionRequest,
  type TeacherInput,
  type TeacherProfile,
} from '@/lib/teachers/profile';
import { getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';

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
  'rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan-500 transition-all';

export default function TeachersDirectoryPage() {
  const { tenant } = useTenant();
  return <TeachersDirectory key={tenant.id} />;
}

function TeachersDirectory() {
  const { tenant, currentRole, groupData, masterData } = useTenant();
  const { auth, data: { stages, subjects: centerSubjects } } = masterData;
  const { groups: centerGroups } = groupData;
  const dal = useMemo(getDataProvider, []);
  const demo = !auth.configured || !auth.idToken;
  const mayManageDemo = currentRole === 'PLATFORM_OWNER' || currentRole === 'CENTER_ADMIN';

  const [activeTab, setActiveTab] = useState<'directory' | 'accounting'>('directory');
  const [accountingSubTab, setAccountingSubTab] = useState<'groups' | 'statement'>('groups');
  const [selectedTeacherForAccounting, setSelectedTeacherForAccounting] = useState<string>('');
  const [baseTeachers, setBaseTeachers] = useState<User[]>();
  const [directory, setDirectory] = useState<{ token: string | null; data: DirectoryData }>();
  const [editor, setEditor] = useState<EditorState>();
  const [viewingProfile, setViewingProfile] = useState<{ teacher: User; profile?: TeacherProfile } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedModel, setSelectedModel] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'active' | 'inactive'>('active');

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [revision, setRevision] = useState(0);
  const [archiving, setArchiving] = useState<string>();

  // Unauthenticated visitor guard: redirect to main login page with safe return URL
  useEffect(() => {
    if (!auth.loading && !auth.idToken && !mayManageDemo && typeof window !== 'undefined') {
      const returnUrl = `/center/${encodeURIComponent(tenant.slug)}/teachers`;
      window.location.href = `/login?redirect=${encodeURIComponent(returnUrl)}`;
    }
  }, [auth.loading, auth.idToken, mayManageDemo, tenant.slug]);

  // Load teacher users from DAL
  useEffect(() => {
    let active = true;
    dal.getUsers(tenant.id, { role: 'TEACHER' })
      .then((users) => {
        if (active) setBaseTeachers(users.filter((user) => user.tenantId === tenant.id));
      })
      .catch(() => {
        if (active) setError('تعذّر تحميل دليل المعلمين والمواد');
      });
    return () => {
      active = false;
    };
  }, [dal, tenant.id]);

  // Load teacher profiles & agreements
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
      const sync = (event: StorageEvent) => {
        if (event.key === demoTeacherKey(tenant.id) || event.key === null) load();
      };
      load();
      window.addEventListener('storage', sync);
      return () => window.removeEventListener('storage', sync);
    }
    const token = auth.idToken;
    if (!token) return;
    const request = new AbortController();
    setError('');
    teacherApi<DirectoryData>(tenant.slug, token, '', undefined, request.signal)
      .then((data) => {
        if (!request.signal.aborted) setDirectory({ token, data });
      })
      .catch((cause) => {
        if (!request.signal.aborted) setError(cause.message);
      });
    return () => request.abort();
  }, [demo, mayManageDemo, auth.idToken, tenant.id, tenant.slug, revision]);

  const authorized = Boolean(directory && (demo ? mayManageDemo : auth.idToken && directory.token === auth.idToken));
  const data = authorized ? directory?.data ?? emptyDirectory : emptyDirectory;

  // Combine DAL users and Firestore profiles
  const allTeachers = useMemo(() => {
    if (!authorized || !baseTeachers) return [];
    const byId = new Map(
      baseTeachers.map((user) => [user.id, { teacher: user, profile: undefined as TeacherProfile | undefined }])
    );
    for (const profile of data.profiles) {
      const existing = byId.get(profile.id)?.teacher;
      byId.set(profile.id, { profile, teacher: teacherProfileUser(profile, existing) });
    }
    return [...byId.values()];
  }, [baseTeachers, data.profiles, authorized]);

  const [statement, setStatement] = useState<TeacherMonthlyStatement | null>(null);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [statementPeriod, setStatementPeriod] = useState(() => {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  });

  const loadStatement = useCallback(async (teacherId: string, month: number, year: number) => {
    if (!teacherId) return;
    setLoadingStatement(true);
    try {
      const activeTeacherObj = allTeachers.find((t) => t.teacher.id === teacherId);
      const res = await dal.calculateMonthlyTeacherPayroll({
        tenantId: tenant.id,
        teacherId,
        month,
        year,
        teacherProfile: activeTeacherObj?.profile,
      });
      setStatement(res);
      setStatementPeriod({ month, year });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingStatement(false);
    }
  }, [dal, tenant.id, allTeachers]);

  // Sync statement on activeTab === 'accounting'
  useEffect(() => {
    if (activeTab === 'accounting') {
      const targetId = selectedTeacherForAccounting || allTeachers[0]?.teacher.id;
      if (targetId && (!statement || statement.teacherId !== targetId)) {
        if (!selectedTeacherForAccounting) setSelectedTeacherForAccounting(targetId);
        loadStatement(targetId, statementPeriod.month, statementPeriod.year);
      }
    }
  }, [activeTab, selectedTeacherForAccounting, allTeachers, statement, loadStatement, statementPeriod.month, statementPeriod.year]);

  // KPI Statistics
  const totalTeachersCount = allTeachers.length;
  const activeTeachersCount = allTeachers.filter(({ teacher }) => teacher.isActive).length;
  const inactiveTeachersCount = allTeachers.filter(({ teacher }) => !teacher.isActive).length;
  const assignedTeachersCount = allTeachers.filter(({ teacher }) =>
    centerGroups.some((g) => g.teacherId === teacher.id && g.isActive)
  ).length;

  // Filtered teachers list
  const visibleTeachers = useMemo(() => {
    return allTeachers.filter(({ teacher, profile }) => {
      // 1. Search filter
      const query = searchQuery.trim().toLowerCase();
      const matchesQuery =
        !query ||
        [teacher.fullName, teacher.phone, profile?.phone2, teacher.email]
          .some((val) => val?.toLowerCase().includes(query));

      // 2. Status filter
      const matchesStatus =
        selectedStatus === 'all' ||
        (selectedStatus === 'active' && teacher.isActive) ||
        (selectedStatus === 'inactive' && !teacher.isActive);

      // 3. Stage filter
      const teacherContractStages = (profile?.contracts || []).map((c) => c.level);
      const matchesStage =
        selectedStage === 'all' ||
        teacherContractStages.includes(selectedStage) ||
        centerGroups.some((g) => g.teacherId === teacher.id && (g.stageId === selectedStage || g.gradeId === selectedStage));

      // 4. Subject filter
      const teacherSubjectIds = new Set([
        ...(profile?.subjectIds ?? []),
        ...centerGroups.filter((g) => g.teacherId === teacher.id).map((g) => g.subjectId),
      ]);
      const matchesSubject =
        selectedSubject === 'all' || teacherSubjectIds.has(selectedSubject);

      // 5. Accounting model filter
      const teacherContractModels = (profile?.contracts || []).map((c) => ('model' in c ? c.model : 'fixed_session'));
      const teacherGroupModels = centerGroups.filter((g) => g.teacherId === teacher.id).map((g) => g.pricingModel);
      const matchesModel =
        selectedModel === 'all' ||
        teacherContractModels.includes(selectedModel as any) ||
        (selectedModel === 'center' && (teacherGroupModels.includes('center') || teacherContractModels.includes('center'))) ||
        (selectedModel === 'per_attendee' && teacherContractModels.includes('per_attendee')) ||
        (selectedModel === 'fixed_session' && (teacherGroupModels.includes('per_session') || teacherContractModels.includes('fixed_session'))) ||
        (selectedModel === 'private' && (teacherGroupModels.includes('private') || teacherContractModels.includes('private')));

      return matchesQuery && matchesStatus && matchesStage && matchesSubject && matchesModel;
    });
  }, [allTeachers, searchQuery, selectedStatus, selectedStage, selectedSubject, selectedModel, centerGroups]);

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

  // Toggle teacher active / inactive
  async function toggleTeacherActive(teacher: User, profile?: TeacherProfile) {
    const nextActive = !teacher.isActive;
    const actionLabel = nextActive ? 'تفعيل' : 'تعطيل';
    if (!window.confirm(`هل أنت متأكد من ${actionLabel} حساب المعلم (${teacher.fullName})؟`)) return;
    setNotice('');
    setError('');
    try {
      await persistTeacher(
        teacher.id,
        profile?.version ?? 0,
        teacherInputFrom(profile, teacher, centerGroups),
        undefined,
        !nextActive
      );
      setNotice(`تم ${actionLabel} حساب المعلم بنجاح`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `تعذّر ${actionLabel} حساب المعلم`);
    }
  }

  // Soft delete / archive
  async function archiveTeacher(teacher: User, profile?: TeacherProfile) {
    if (
      !window.confirm(
        `حذف ${teacher.fullName} من قائمة المعلمين وإيقاف دخوله؟ سيتم حفظ كافة سجلات الحصص والدرجات والعمليات المالية السابقة دون أي مساس بها.`
      )
    )
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
      setNotice('تم تعطيل وحفظ سجل المعلم بنجاح مع الحفاظ على كافة البيانات التاريخية');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذّر حذف المعلم');
    } finally {
      setArchiving(undefined);
    }
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-black sm:text-3xl text-foreground">
            <Briefcase className="text-brand-cyan-600 dark:text-brand-cyan-400" size={30} />
            <span>شؤون المعلمين</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground font-medium">
            إدارة بيانات المعلمين والمراحل والمواد والاتفاقات المالية والصلاحيات
          </p>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-1.5 mt-3.5 bg-muted/40 p-1 rounded-xl border border-border w-fit print:hidden">
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
                  ? 'bg-card text-brand-cyan-600 dark:text-brand-cyan-400 shadow-sm border border-brand-cyan-500/30'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileSpreadsheet size={14} />
              <span>الحسابات والمستحقات</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/teacher/${tenant.slug}`}
            target="_blank"
            className="rounded-xl border border-border px-3.5 py-2 text-xs font-bold hover:bg-muted text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors"
          >
            <span>بوابة دخول المعلمين</span>
            <ExternalLink size={13} />
          </Link>

          {authorized && baseTeachers && (
            <Button
              disabled={!masterData.ready}
              aria-label="إضافة معلم جديد"
              onClick={() => {
                setNotice('');
                setEditor({ id: `teacher-${crypto.randomUUID()}` });
                setActiveTab('directory');
              }}
              className="rounded-xl bg-brand-cyan-600 hover:bg-brand-cyan-500 text-white font-bold text-xs flex items-center gap-2 shadow-soft-sm px-4 py-2"
            >
              <Plus size={16} />
              <span>إضافة معلم جديد</span>
            </Button>
          )}
        </div>
      </header>

      {/* Notifications and Alerts */}
      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs text-red-600 dark:text-red-400 flex items-center gap-2.5 animate-fadeIn"
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2.5 animate-fadeIn"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Unauthenticated State Message */}
      {!auth.idToken && !auth.loading && !mayManageDemo && (
        <div className="card-elevated p-8 rounded-2xl border border-border text-center space-y-3">
          <ShieldCheck className="w-8 h-8 text-brand-cyan-600 mx-auto animate-pulse" />
          <h2 className="text-base font-bold text-foreground">التحقق من صلاحيات إدارة السنتر...</h2>
          <p className="text-xs text-muted-foreground">جارٍ تحويلك إلى بوابة تسجيل الدخول الرسمية الموحدة.</p>
          <Link
            href={`/login?redirect=/center/${tenant.slug}/teachers`}
            className="text-xs text-brand-cyan-600 hover:underline inline-block mt-2 font-bold"
          >
            اضغط هنا إذا لم يتم تحويلك تلقائيًا ←
          </Link>
        </div>
      )}

      {/* Loading state */}
      {(auth.loading || (!baseTeachers && authorized) || (auth.idToken && !authorized && !error)) && (
        <div className="p-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <span className="w-3 h-3 rounded-full bg-brand-cyan-500 animate-ping" />
          <span>جارٍ تحميل بيانات المعلمين من السحابة…</span>
        </div>
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
                  onChange={(e) => {
                    setSelectedTeacherForAccounting(e.target.value);
                    if (accountingSubTab === 'statement') {
                      loadStatement(e.target.value, statementPeriod.month, statementPeriod.year);
                    }
                  }}
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

                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                  <button
                    type="button"
                    onClick={() => setAccountingSubTab('groups')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      accountingSubTab === 'groups'
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    مجموعات وحصص المعلم
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAccountingSubTab('statement');
                      const targetId = selectedTeacherForAccounting || visibleTeachers[0]?.teacher.id;
                      if (targetId) loadStatement(targetId, statementPeriod.month, statementPeriod.year);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      accountingSubTab === 'statement'
                        ? 'bg-card text-brand-cyan-600 dark:text-brand-cyan-400 shadow-sm border border-brand-cyan-500/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    كشف الحساب والمستحقات المجمعة
                  </button>
                </div>
              </div>

              <Link
                href={`/center/${tenant.slug}/sessions`}
                className="text-xs font-bold text-brand-cyan-600 dark:text-brand-cyan-400 hover:underline flex items-center gap-1 self-end sm:self-auto"
              >
                <span>إدارة وإضافة المجموعات في تبويب الحصص والمجموعات ←</span>
              </Link>
            </div>

            {accountingSubTab === 'statement' ? (
              statement ? (
                <TeacherAccountingView
                  tenantSlug={tenant.slug}
                  statement={statement}
                  teachers={allTeachers.map((t) => t.teacher)}
                  groups={centerGroups}
                  isLoading={loadingStatement}
                  onLoad={(teacherId, month, year) => {
                    setSelectedTeacherForAccounting(teacherId);
                    loadStatement(teacherId, month, year);
                  }}
                  onClose={() => setActiveTab('directory')}
                />
              ) : (
                <div className="card-elevated p-12 text-center text-muted-foreground rounded-2xl border border-border">
                  {loadingStatement ? (
                    <p className="text-sm font-bold">جارٍ تجميع وحساب كشف الحساب والمستحقات…</p>
                  ) : (
                    <p className="text-sm font-bold">اختر معلماً لعرض كشف الحساب والمستحقات الخاصة به.</p>
                  )}
                </div>
              )
            ) : (
              <SessionsGroupsView
                key={selectedTeacherForAccounting || visibleTeachers[0]?.teacher.id}
                initialTeacherId={selectedTeacherForAccounting || visibleTeachers[0]?.teacher.id}
                lockTeacherFilter={true}
                allowGroupManagement={false}
                title="نظام حسابات الحصص والمجموعات للمعلم"
                subtitle="استعراض مجموعات المعلم، المواعيد الأسبوعية، وطريقة الحساب المعتمدة من الحصص والمجموعات."
              />
            )}
          </div>
        ) : (
          <div className="space-y-5">
            {/* 4 KPI Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Teachers */}
              <div className="card-elevated p-4 rounded-2xl border border-border space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold">إجمالي المعلمين</span>
                  <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Users size={15} />
                  </div>
                </div>
                <p className="text-2xl font-black text-foreground font-mono">{totalTeachersCount}</p>
                <span className="text-[10px] text-muted-foreground block">معلم مسجل بالنظام</span>
              </div>

              {/* Active Teachers */}
              <div className="card-elevated p-4 rounded-2xl border border-border space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold">المعلمون النشطون</span>
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <UserCheck size={15} />
                  </div>
                </div>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {activeTeachersCount}
                </p>
                <span className="text-[10px] text-muted-foreground block">حسابات نشطة ومفعلة</span>
              </div>

              {/* Inactive Teachers */}
              <div className="card-elevated p-4 rounded-2xl border border-border space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold">غير النشطين</span>
                  <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    <UserX size={15} />
                  </div>
                </div>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">
                  {inactiveTeachersCount}
                </p>
                <span className="text-[10px] text-muted-foreground block">معطل أو مؤرشف</span>
              </div>

              {/* Assigned Teachers */}
              <div className="card-elevated p-4 rounded-2xl border border-border space-y-1">
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-bold">مرتبطون بحصص</span>
                  <div className="w-7 h-7 rounded-lg bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 flex items-center justify-center">
                    <Calendar size={15} />
                  </div>
                </div>
                <p className="text-2xl font-black text-brand-cyan-600 dark:text-brand-cyan-400 font-mono">
                  {assignedTeachersCount}
                </p>
                <span className="text-[10px] text-muted-foreground block">لديهم مجموعات نشطة</span>
              </div>
            </div>

            {/* Filter and Search Toolbar */}
            <div className="card-elevated rounded-2xl border border-border p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search Bar */}
                <div className="lg:col-span-2 relative">
                  <Search size={15} className="absolute end-3 top-3 text-muted-foreground pointer-events-none" />
                  <input
                    aria-label="بحث المعلمين"
                    placeholder="بحث بالاسم أو رقم الهاتف أو البريد…"
                    className={control + ' w-full pe-9'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Stage Filter */}
                <div>
                  <select
                    aria-label="المرحلة التعليمية"
                    className={control + ' w-full'}
                    value={selectedStage}
                    onChange={(e) => setSelectedStage(e.target.value)}
                  >
                    <option value="all">كل المراحل التعليمية</option>
                    {stages.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Subject Filter */}
                <div>
                  <select
                    aria-label="المادة الدراسية"
                    className={control + ' w-full'}
                    value={selectedSubject}
                    onChange={(e) => setSelectedSubject(e.target.value)}
                  >
                    <option value="all">كل المواد الدراسية</option>
                    {centerSubjects.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Accounting Model Filter */}
                <div>
                  <select
                    aria-label="نظام المحاسبة"
                    className={control + ' w-full'}
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                  >
                    <option value="all">كل أنظمة المحاسبة</option>
                    <option value="per_attendee">أجر لكل طالب حاضر</option>
                    <option value="fixed_session">أجر ثابت للحصة</option>
                    <option value="private">نسبة مئوية (برايفت)</option>
                    <option value="center">نظام متوسط الحضور</option>
                  </select>
                </div>
              </div>

              {/* Status Filter Badges */}
              <div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted-foreground text-[11px] font-bold">الحالة:</span>
                  {(['all', 'active', 'inactive'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setSelectedStatus(status)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                        selectedStatus === status
                          ? 'bg-brand-cyan-600 text-white shadow-soft-sm'
                          : 'bg-muted/40 text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {status === 'all' && 'الكل'}
                      {status === 'active' && 'النشطون فقط'}
                      {status === 'inactive' && 'غير النشطين'}
                    </button>
                  ))}
                </div>

                <span className="text-muted-foreground text-[11px]">
                  عرض <b>{visibleTeachers.length}</b> من أصل <b>{totalTeachersCount}</b> معلم
                </span>
              </div>
            </div>

            {/* Advanced 9-Column Teachers Directory Table */}
            <div className="card-elevated overflow-x-auto rounded-2xl border border-border shadow-soft-sm">
              <table className="min-w-[980px] w-full text-start text-xs">
                <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="p-3.5 text-start font-bold">صورة المعلم</th>
                    <th className="p-3.5 text-start font-bold">اسم المعلم</th>
                    <th className="p-3.5 text-start font-bold">الهاتف الأساسي</th>
                    <th className="p-3.5 text-start font-bold">المراحل التعليمية</th>
                    <th className="p-3.5 text-start font-bold">المواد الدراسية</th>
                    <th className="p-3.5 text-start font-bold">أنظمة المحاسبة</th>
                    <th className="p-3.5 text-start font-bold">المجموعات</th>
                    <th className="p-3.5 text-start font-bold">حالة الحساب</th>
                    <th className="p-3.5 text-start font-bold">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {visibleTeachers.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-10 text-center text-muted-foreground space-y-1">
                        <Users size={28} className="mx-auto text-muted-foreground/40" />
                        <p className="font-bold">لا يوجد معلمون مطابقون لمعايير البحث والتصفية</p>
                        <p className="text-[11px]">جرّب تغيير فلاتر البحث أو إضافة معلم جديد بالنقر على زر الإضافة أعلاه.</p>
                      </td>
                    </tr>
                  ) : (
                    visibleTeachers.map(({ teacher, profile }) => {
                      const avatarUrl = profile?.avatarData || teacher.avatarUrl;
                      const teacherGroups = centerGroups.filter(
                        (group) => group.teacherId === teacher.id && group.isActive
                      );

                      // Subjects
                      const subjectIds = new Set([
                        ...(profile?.subjectIds ?? []),
                        ...teacherGroups.map((g) => g.subjectId),
                      ]);
                      const teacherSubjects = centerSubjects.filter((s) => subjectIds.has(s.id));

                      // Stages
                      const stageLevels = new Set([
                        ...(profile?.contracts?.map((c) => c.level) || []),
                        ...teacherGroups.map((g) => g.stageId).filter(Boolean),
                      ]);
                      const teacherStages = stages.filter((st) => stageLevels.has(st.id));

                      // Accounting models
                      const models = [
                        ...new Set([
                          ...(profile?.contracts?.map((c) => ('model' in c ? c.model : 'fixed_session')) || []),
                          ...teacherGroups.map((g) => g.pricingModel).filter(Boolean),
                        ]),
                      ];

                      return (
                        <tr key={teacher.id} className="hover:bg-muted/15 transition-colors">
                          {/* 1. Photo */}
                          <td className="p-3.5">
                            <div className="relative w-10 h-10 rounded-xl overflow-hidden border border-border bg-muted flex items-center justify-center shrink-0">
                              {avatarUrl ? (
                                <img src={avatarUrl} alt={teacher.fullName} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-black text-xs text-muted-foreground">
                                  {teacher.fullName.slice(0, 2)}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Name */}
                          <td className="p-3.5">
                            <div>
                              <p className="font-black text-foreground text-xs">{teacher.fullName}</p>
                              {profile?.login?.mode === 'username' && (
                                <p className="text-[10px] text-muted-foreground font-mono">
                                  @{profile.login.username}
                                </p>
                              )}
                              {teacher.email && (
                                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[140px]">
                                  {teacher.email}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 3. Phone */}
                          <td className="p-3.5 font-mono">
                            <div>
                              <a
                                href={`tel:${teacher.phone}`}
                                className="text-foreground hover:text-brand-cyan-600 transition-colors font-bold"
                              >
                                {teacher.phone || '—'}
                              </a>
                              {profile?.phone2 && (
                                <p className="text-[10px] text-muted-foreground">
                                  <span>2: </span>
                                  <span>{profile.phone2}</span>
                                </p>
                              )}
                            </div>
                          </td>

                          {/* 4. Stages */}
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {teacherStages.length > 0 ? (
                                teacherStages.map((st) => (
                                  <span
                                    key={st.id}
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-muted/60 text-muted-foreground border border-border"
                                  >
                                    {st.nameAr}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>

                          {/* 5. Subjects */}
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {teacherSubjects.length > 0 ? (
                                teacherSubjects.map((sub) => (
                                  <span
                                    key={sub.id}
                                    className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-brand-cyan-500/10 text-brand-cyan-600 dark:text-brand-cyan-400 border border-brand-cyan-500/20"
                                  >
                                    {sub.nameAr}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>

                          {/* 6. Accounting Systems */}
                          <td className="p-3.5">
                            <div className="flex flex-wrap gap-1 max-w-[160px]">
                              {models.length > 0 ? (
                                models.map((m) => (
                                  <Badge key={m} variant="outline" className="text-[9px] font-bold">
                                    {m === 'per_attendee' && 'أجر لكل طالب'}
                                    {m === 'fixed_session' && 'أجر ثابت'}
                                    {m === 'private' && 'نسبة مئوية'}
                                    {m === 'center' && 'متوسط الحضور'}
                                    {m === 'per_session' && 'دفع بالحصة'}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-[11px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>

                          {/* 7. Assigned Groups */}
                          <td className="p-3.5">
                            <button
                              type="button"
                              aria-label={`الحسابات والمجموعات (${teacherGroups.length})`}
                              onClick={() => {
                                setSelectedTeacherForAccounting(teacher.id);
                                setAccountingSubTab('groups');
                                setActiveTab('accounting');
                              }}
                              className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted border border-border text-[11px] font-bold text-foreground transition-colors"
                            >
                              {teacherGroups.length} مجموعة
                            </button>
                          </td>

                          {/* 8. Account Status */}
                          <td className="p-3.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black border ${
                                teacher.isActive
                                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                  : 'bg-muted text-muted-foreground border-border'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  teacher.isActive ? 'bg-emerald-500' : 'bg-muted-foreground'
                                }`}
                              />
                              <span>{teacher.isActive ? 'نشط' : 'غير نشط'}</span>
                            </span>
                          </td>

                          {/* 9. Actions */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              {/* View Statement & Accounting */}
                              <button
                                type="button"
                                title="كشف الحساب والمستحقات"
                                onClick={() => {
                                  setSelectedTeacherForAccounting(teacher.id);
                                  setAccountingSubTab('statement');
                                  setActiveTab('accounting');
                                  loadStatement(teacher.id, statementPeriod.month, statementPeriod.year);
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-cyan-600 hover:bg-muted transition-colors"
                              >
                                <FileSpreadsheet size={15} />
                              </button>

                              {/* View Profile */}
                              <button
                                type="button"
                                title="عرض الملف الشخصي"
                                onClick={() => setViewingProfile({ teacher, profile })}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-brand-cyan-600 hover:bg-muted transition-colors"
                              >
                                <Eye size={15} />
                              </button>

                              {/* Edit */}
                              <button
                                type="button"
                                aria-label="تعديل"
                                title="تعديل بيانات المعلم"
                                onClick={() => {
                                  setNotice('');
                                  setEditor({ id: teacher.id, teacher, profile });
                                }}
                                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                              >
                                <Edit3 size={15} />
                              </button>

                              {/* Toggle Active/Inactive */}
                              <button
                                type="button"
                                title={teacher.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                onClick={() => toggleTeacherActive(teacher, profile)}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  teacher.isActive
                                    ? 'text-amber-500 hover:bg-amber-500/10'
                                    : 'text-emerald-500 hover:bg-emerald-500/10'
                                }`}
                              >
                                {teacher.isActive ? <UserX size={15} /> : <UserCheck size={15} />}
                              </button>

                              {/* Delete / Soft Delete */}
                              <button
                                type="button"
                                aria-label="حذف"
                                title="حذف المعلم (تعطيل آمن)"
                                disabled={archiving === teacher.id}
                                onClick={() => archiveTeacher(teacher, profile)}
                                className="p-1.5 rounded-lg text-red-500 hover:text-red-600 hover:bg-red-500/10 transition-colors"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* Two-Step Add / Edit Teacher Wizard Modal */}
      {editor && (
        <TeacherEditor
          key={editor.id}
          editing={Boolean(editor.teacher)}
          teacherId={editor.id}
          tenantId={tenant.id}
          tenantSlug={tenant.slug}
          originalAvatar={editor.teacher?.avatarUrl}
          demo={demo}
          subjects={centerSubjects}
          stages={stages}
          initial={teacherInputFrom(editor.profile, editor.teacher, centerGroups)}
          onClose={() => setEditor(undefined)}
          onSave={async (input, password) => {
            await persistTeacher(editor.id, editor.profile?.version ?? 0, input, password);
            setNotice(
              editor.teacher
                ? 'تم تحديث بيانات المعلم'
                : 'تمت إضافة المعلم'
            );
            setRevision((val) => val + 1);
          }}
        />
      )}

      {/* Teacher Profile Details Modal */}
      {viewingProfile && (
        <TeacherProfileModal
          teacher={viewingProfile.teacher}
          profile={viewingProfile.profile}
          stages={stages}
          subjects={centerSubjects}
          groups={centerGroups}
          onEdit={() => {
            const current = viewingProfile;
            setViewingProfile(null);
            setEditor({ id: current.teacher.id, teacher: current.teacher, profile: current.profile });
          }}
          onViewAccounting={() => {
            const current = viewingProfile;
            setViewingProfile(null);
            setSelectedTeacherForAccounting(current.teacher.id);
            setAccountingSubTab('statement');
            setActiveTab('accounting');
            loadStatement(current.teacher.id, statementPeriod.month, statementPeriod.year);
          }}
          onClose={() => setViewingProfile(null)}
        />
      )}
    </div>
  );
}
