'use client';

import { useMemo, useState } from 'react';
import {
  FolderTree, Search, Plus, FileText, ExternalLink, Sparkles, Eye, CheckCircle2,
  AlertCircle, Clock, ChevronRight, Folder, LayoutGrid, List, Link as LinkIcon, Pencil, Trash2, X,
} from 'lucide-react';
import Link from 'next/link';
import { useTenant } from '@/components/layout/tenant-provider';
import { MasterDataStatus } from '@/components/layout/master-data-status';
import { Button } from '@/components/ui/button';
import { MathView } from '@/components/ui/math-view';
import { MaterialEditor } from '@/components/materials/material-editor';
import type { Material } from '@/lib/dal/types';
import { useCenterMaterials } from '@/lib/materials/client';
import type { MaterialMutation } from '@/lib/materials/management';
import { DOCUMENT_CATEGORIES, getGradeNameArabic, getStageNameArabic } from '@/lib/materials/taxonomy';

export default function MaterialsPage() {
  const { tenant, masterData, currentUser } = useTenant();
  const centerSlug = tenant.slug;
  const { materials, loading, error, refresh, canEdit, save } = useCenterMaterials(tenant, masterData.auth, currentUser);
  const { stages, subjects } = masterData.data;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'tree'>('grid');
  const [editor, setEditor] = useState<{ material?: Material }>();
  const [selectedMaterialForText, setSelectedMaterialForText] = useState<Material | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Material>();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [notice, setNotice] = useState('');

  const availableGrades = selectedStage === 'all' ? stages.flatMap(stage => stage.grades)
    : stages.find(stage => stage.id === selectedStage)?.grades ?? [];
  const availableSubjects = subjects.filter(subject => (selectedStage === 'all' || subject.stage === selectedStage) &&
    (selectedGrade === 'all' || subject.grade === selectedGrade));

  // Filtered Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (selectedStage !== 'all' && m.stage !== selectedStage) return false;
      if (selectedGrade !== 'all' && m.grade !== selectedGrade) return false;
      if (selectedSubject !== 'all' && m.subjectId !== selectedSubject) return false;
      if (selectedStatus !== 'all' && m.indexStatus !== selectedStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesTitle = m.title.toLowerCase().includes(q);
        const matchesUnit = m.unitName.toLowerCase().includes(q);
        const matchesLesson = m.lessonName.toLowerCase().includes(q);
        const matchesDesc = m.description?.toLowerCase().includes(q);
        const matchesText = m.textContentIndexed?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesUnit && !matchesLesson && !matchesDesc && !matchesText) {
          return false;
        }
      }

      return true;
    });
  }, [materials, selectedStage, selectedGrade, selectedSubject, selectedStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = materials.length;
    const indexed = materials.filter((m) => m.indexStatus === 'indexed').length;
    const insufficient = materials.filter((m) => m.indexStatus === 'insufficient').length;
    const pending = materials.filter((m) => m.indexStatus === 'pending').length;
    const totalWords = materials.reduce((acc, m) => acc + (m.wordCount || 0), 0);
    const driveCount = materials.filter((m) => !!m.googleDriveFileId).length;

    return { total, indexed, insufficient, pending, totalWords, driveCount };
  }, [materials]);

  async function saveMaterial(mutation: MaterialMutation) {
    await save(mutation);
    setEditor(undefined);
    setNotice(mutation.action === 'create' ? 'تمت إضافة المذكرة' : 'تم تعديل المذكرة');
    setSelectedStage('all');
    setSelectedGrade('all');
    setSelectedSubject('all');
    setSelectedStatus('all');
    setSearchQuery('');
  }

  async function confirmDelete() {
    if (!deleteTarget || deleting) return;
    setDeleting(true);
    setDeleteError('');
    try {
      await save({ action: 'delete', id: deleteTarget.id, updatedAt: deleteTarget.updatedAt });
      setDeleteTarget(undefined);
      setNotice('تم حذف المذكرة من البنك');
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'تعذّر حذف المذكرة');
    } finally {
      setDeleting(false);
    }
  }

  function materialActions(material: Material) {
    if (!canEdit) return null;
    return <div className="flex flex-wrap items-center gap-1.5">
      <Button type="button" variant="outline" size="sm" aria-label={`تعديل ${material.title}`}
        onClick={() => { setNotice(''); setEditor({ material }); }}><Pencil size={13} /> تعديل</Button>
      <Button type="button" variant="outline" size="sm" className="text-rose-700 dark:text-rose-400" aria-label={`حذف ${material.title}`}
        onClick={() => { setNotice(''); setDeleteError(''); setDeleteTarget(material); }}><Trash2 size={13} /> حذف</Button>
    </div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>الرئيسية</span>
            <ChevronRight className="w-3 h-3 rotate-180" />
            <span className="text-cyan-500 font-bold">المستودع الأكاديمي والمذكرات</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground flex items-center gap-2.5">
            <FolderTree className="w-7 h-7 text-cyan-500" />
            <span>بنك المذكرات والربط السحابي (Google Drive)</span>
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            تصنيف هرمي سداسي للمناهج (المرحلة ← الصف ← المادة ← الوحدة ← الدرس ← المستندات) مع الفهرسة الذكية.
          </p>
        </div>

        {canEdit && <div className="flex items-center gap-3">
          <button
            disabled={!masterData.ready}
            onClick={() => { setNotice(''); setEditor({}); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مذكرة / ربط Google Drive</span>
          </button>
        </div>}
      </div>
      <MasterDataStatus />
      {error && <p role="alert" className="rounded-lg border border-rose-500/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
        {error} <button type="button" className="ms-2 underline" onClick={refresh}>إعادة المحاولة</button>
      </p>}
      {loading && <p role="status" className="text-sm text-muted-foreground">جارٍ تحميل المذكرات…</p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {/* Fast Statistics HUD Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs text-muted-foreground">إجمالي المذكرات</div>
          <div className="text-2xl font-black text-foreground mt-1">{stats.total}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>مفهرسة (مؤهلة لـ AI)</span>
          </div>
          <div className="text-2xl font-black text-emerald-500 mt-1">{stats.indexed}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs text-amber-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>نص غير كافٍ (&lt;200)</span>
          </div>
          <div className="text-2xl font-black text-amber-500 mt-1">{stats.insufficient}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs text-muted-foreground flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>قيد الفهرسة</span>
          </div>
          <div className="text-2xl font-black text-muted-foreground mt-1">{stats.pending}</div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs text-cyan-500">كلمات مفهرسة</div>
          <div className="text-2xl font-black text-cyan-500 mt-1">
            {stats.totalWords.toLocaleString('ar-EG')}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-card border border-border">
          <div className="text-xs text-blue-500 flex items-center gap-1">
            <LinkIcon className="w-3.5 h-3.5" />
            <span>مرتبطة بـ Drive</span>
          </div>
          <div className="text-2xl font-black text-blue-500 mt-1">{stats.driveCount}</div>
        </div>
      </div>

      {/* Cascading Filter & Search Toolbar */}
      <div className="p-4 bg-card border border-border rounded-2xl space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          {/* Instant Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-muted-foreground absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالعنوان، اسم الوحدة، الدرس، أو الكلمات المفتاحية..."
              className="w-full pr-10 pl-4 py-2 rounded-xl bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center gap-1 p-1 bg-muted/50 rounded-xl border border-border shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                viewMode === 'grid'
                  ? 'bg-card text-cyan-500 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="عرض البطاقات"
            >
              <LayoutGrid className="w-4 h-4" />
              <span>بطاقات</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                viewMode === 'table'
                  ? 'bg-card text-cyan-500 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="عرض الجدول"
            >
              <List className="w-4 h-4" />
              <span>جدول</span>
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-all ${
                viewMode === 'tree'
                  ? 'bg-card text-cyan-500 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              title="شجرة التصنيف"
            >
              <FolderTree className="w-4 h-4" />
              <span>شجرة</span>
            </button>
          </div>
        </div>

        {/* Cascading Dropdowns */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {/* Stage Filter */}
          <select
            value={selectedStage}
            onChange={(e) => {
              setSelectedStage(e.target.value);
              setSelectedGrade('all');
              setSelectedSubject('all');
            }}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع المراحل التعليمية</option>
            {stages.map(stage => <option key={stage.id} value={stage.id}>{stage.nameAr}</option>)}
          </select>

          {/* Grade Filter */}
          <select
            value={selectedGrade}
            onChange={event => { setSelectedGrade(event.target.value); setSelectedSubject('all'); }}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع الصفوف الدراسية</option>
            {availableGrades.map(grade => <option key={grade.id} value={grade.id}>{grade.nameAr}</option>)}
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع المواد الدراسية</option>
            {availableSubjects.map(subject => <option key={subject.id} value={subject.id}>{subject.nameAr}</option>)}
          </select>

          {/* Index Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع حالات الفهرسة</option>
            <option value="indexed">مفهرس (≥ 200 كلمة)</option>
            <option value="insufficient">غير كافٍ (&lt; 200 كلمة)</option>
            <option value="pending">قيد الفهرسة</option>
          </select>
        </div>
      </div>

      {!loading && !error && !filteredMaterials.length &&
        <p className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          {materials.length ? 'مفيش مذكرات مطابقة للبحث.' : 'مفيش مذكرات في البنك.'}
        </p>}

      {/* Main View: Grid Mode */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredMaterials.map((mat) => {
            const categoryMeta =
              DOCUMENT_CATEGORIES[mat.category || 'lecture_notes'] ||
              DOCUMENT_CATEGORIES.lecture_notes;

            return (
              <div
                key={mat.id}
                className="bg-card border border-border hover:border-cyan-500/50 rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Top Bar: Category badge & Index status pill */}
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${categoryMeta.badgeClass}`}
                    >
                      {categoryMeta.nameAr}
                    </span>

                    {mat.indexStatus === 'indexed' ? (
                      <span className="text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        {mat.wordCount} كلمة
                      </span>
                    ) : mat.indexStatus === 'insufficient' ? (
                      <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {mat.wordCount} كلمة (غير كافٍ)
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-muted-foreground bg-muted border border-border px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        قيد الفهرسة
                      </span>
                    )}
                  </div>

                  {/* Title & Hierarchy Trail */}
                  <div>
                  <h3 className="text-sm font-bold text-foreground line-clamp-2" title={mat.title}>{mat.title}</h3>
                    <div className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium mt-1 flex items-center gap-1">
                      <Folder className="w-3 h-3" />
                      <span>{mat.unitName}</span>
                      <span>›</span>
                      <span>{mat.lessonName}</span>
                    </div>
                  </div>

                  {/* Description */}
                  {mat.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                      {mat.description}
                    </p>
                  )}
                </div>

                {/* Actions Footer */}
                <div className="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {/* View Text / Equations Inspector */}
                    <button
                      onClick={() => setSelectedMaterialForText(mat)}
                      className="p-1.5 rounded-lg border border-border hover:bg-muted text-xs text-foreground flex items-center gap-1 transition-colors"
                      title="فحص النص والمعادلات"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>فحص النص</span>
                    </button>

                    {/* Google Drive Link */}
                    {mat.googleDriveWebViewLink && (
                      <a
                        href={mat.googleDriveWebViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-xs text-blue-500 flex items-center gap-1 transition-colors"
                        title="فتح في Google Drive"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Drive</span>
                      </a>
                    )}
                  </div>

                  {materialActions(mat)}
                  {/* Generate Exam Trigger */}
                  <Link
                    href={`/center/${centerSlug}/exams?sourceDocId=${mat.id}`}
                    className="flex items-center gap-1 text-xs font-bold text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>توليد امتحان AI</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main View: Table Mode */}
      {viewMode === 'table' && (
        <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-sm">
          <table className="w-full text-xs text-start">
            <thead className="bg-muted/50 border-b border-border text-muted-foreground">
              <tr>
                <th className="p-3 text-start">عنوان المذكرة</th>
                <th className="p-3 text-start">الوحدة والدرس</th>
                <th className="p-3 text-start">النوع</th>
                <th className="p-3 text-start">عدد الكلمات</th>
                <th className="p-3 text-start">حالة الفهرسة</th>
                <th className="p-3 text-start">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredMaterials.map((mat) => (
                <tr key={mat.id} className="hover:bg-muted/20 transition-colors">
                  <td className="p-3 font-bold text-foreground">{mat.title}</td>
                  <td className="p-3 text-muted-foreground">
                    {mat.unitName} — {mat.lessonName}
                  </td>
                  <td className="p-3">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted border border-border">
                      {DOCUMENT_CATEGORIES[mat.category || 'lecture_notes']?.nameAr || 'مذكرة'}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold">{mat.wordCount} كلمة</td>
                  <td className="p-3">
                    {mat.indexStatus === 'indexed' ? (
                      <span className="text-emerald-500 font-bold flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> مفهرس
                      </span>
                    ) : mat.indexStatus === 'insufficient' ? (
                      <span className="text-amber-500 font-bold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" /> غير كافٍ
                      </span>
                    ) : (
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> معلق
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setSelectedMaterialForText(mat)}
                        className="text-cyan-500 hover:underline flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" /> فحص
                      </button>
                      <Link
                        href={`/center/${centerSlug}/exams?sourceDocId=${mat.id}`}
                        className="text-blue-500 hover:underline flex items-center gap-1"
                      >
                        <Sparkles className="w-3 h-3" /> امتحان
                      </Link>
                      {materialActions(mat)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Main View: Tree View */}
      {viewMode === 'tree' && (
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-cyan-500" />
            <span>الهيكل التنظيمي للمقررات والمذكرات</span>
          </h3>

          <div className="space-y-3 font-mono text-xs">
            {Array.from(new Set(filteredMaterials.map(material => material.stage))).map(stage => {
              const stageMaterials = filteredMaterials.filter(material => material.stage === stage);
              return <section key={stage} className="space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                <h4 className="flex items-center gap-2 text-sm font-bold">
                  <Folder className="size-4 text-amber-500" /> {stages.find(item => item.id === stage)?.nameAr ?? getStageNameArabic(stage)}
                </h4>
                {Array.from(new Set(stageMaterials.map(material => material.grade))).map(grade => <div key={grade} className="space-y-1 border-s-2 border-border ps-3">
                  <p className="text-sm font-semibold">{availableGrades.find(item => item.id === grade)?.nameAr ?? getGradeNameArabic(grade)}</p>
                  <ul className="divide-y divide-border">
                    {stageMaterials.filter(material => material.grade === grade).map(material => <li key={material.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <button type="button" onClick={() => setSelectedMaterialForText(material)}
                        className="flex items-center gap-2 text-start text-sm text-cyan-700 hover:underline dark:text-cyan-300">
                        <FileText className="size-4 shrink-0" /> {material.title}
                      </button>
                      {materialActions(material)}
                    </li>)}
                  </ul>
                </div>)}
              </section>;
            })}
          </div>
        </div>
      )}

      {/* Modal: Text Inspector & KaTeX Formulas Viewer */}
      {selectedMaterialForText && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-border flex items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {selectedMaterialForText.title}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {selectedMaterialForText.unitName} — {selectedMaterialForText.lessonName}
                </p>
              </div>
              <button
                onClick={() => setSelectedMaterialForText(null)}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-4">
              {/* Word Count Indicator */}
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
                <div>
                  <span className="text-xs text-muted-foreground">عدد الكلمات المفهرسة: </span>
                  <span className="text-sm font-bold font-mono text-foreground">
                    {selectedMaterialForText.wordCount} كلمة
                  </span>
                </div>
                {selectedMaterialForText.wordCount >= 200 ? (
                  <span className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> مؤهلة لتوليد امتحانات AI (AC-8)
                  </span>
                ) : (
                  <span className="text-xs font-bold text-amber-500 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> أقل من الحد الأدنى (200 كلمة)
                  </span>
                )}
              </div>

              {/* Text Content */}
              <div className="p-4 rounded-2xl bg-background border border-border text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans">
                {selectedMaterialForText.textContentIndexed || '(لا يوجد نص مفهرس)'}
              </div>

              {/* Sample Equations if physics/math */}
              <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-2">
                <strong className="text-xs text-cyan-500 block">
                  معادلات وصيغ KaTeX المستخرجة بنظام LTR:
                </strong>
                <div className="flex flex-wrap gap-4 items-center justify-center py-2">
                  <MathView math="\sum I_{in} = \sum I_{out}" display={false} />
                  <MathView math="\sum V_B = \sum I \cdot R" display={false} />
                  <MathView math="B = \frac{\mu I}{2\pi d}" display={false} />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                المصدر: {selectedMaterialForText.googleDriveFileId ? 'Google Drive' : 'مستند محلي'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSelectedMaterialForText(null)}
                  className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted"
                >
                  إغلاق
                </button>
                <Link
                  href={`/center/${centerSlug}/exams?sourceDocId=${selectedMaterialForText.id}`}
                  className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>توليد امتحان الآن</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {editor && <MaterialEditor material={editor.material} stages={stages} subjects={subjects}
        onClose={() => setEditor(undefined)} onSave={saveMaterial} />}

      {deleteTarget && <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-material-title"
          className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-5 shadow-xl">
          <h2 id="delete-material-title" className="flex items-center gap-2 font-bold">
            <Trash2 size={17} className="text-rose-600" /> حذف المذكرة
          </h2>
          <p className="break-words text-sm text-muted-foreground">
            هل تريد حذف <strong className="text-foreground">{deleteTarget.title}</strong> من بنك المذكرات؟
            {deleteTarget.googleDriveFileId && ' الملف الأصلي يفضل محفوظ على Google Drive.'}
          </p>
          {deleteError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-400">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" disabled={deleting} onClick={() => setDeleteTarget(undefined)}>إلغاء</Button>
            <Button variant="destructive" disabled={deleting} onClick={confirmDelete}>{deleting ? 'جاري الحذف…' : 'تأكيد الحذف'}</Button>
          </div>
        </section>
      </div>}
    </div>
  );
}
