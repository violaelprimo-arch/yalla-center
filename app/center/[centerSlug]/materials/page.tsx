'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  FolderTree,
  Search,
  Filter,
  Plus,
  FileText,
  ExternalLink,
  BookOpen,
  Sparkles,
  RefreshCw,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  ChevronRight,
  Folder,
  LayoutGrid,
  List,
  Upload,
  Link as LinkIcon,
  X,
  FileSpreadsheet,
  FileCode,
} from 'lucide-react';
import { useTenant } from '@/components/layout/tenant-provider';
import { Badge } from '@/components/ui/badge';
import { MathView } from '@/components/ui/math-view';
import { Material, Subject, DocumentCategory, MaterialIndexStatus } from '@/lib/dal/types';
import { EGYPTIAN_STAGES, DOCUMENT_CATEGORIES, buildTaxonomyTree } from '@/lib/materials/taxonomy';
import { extractGoogleDriveFileId } from '@/lib/materials/drive';
import Link from 'next/link';

export default function MaterialsPage({ params }: { params: { centerSlug: string } }) {
  const { tenant } = useTenant();
  const centerSlug = params?.centerSlug || tenant?.slug || 'al-maher';

  // Data State
  const [materials, setMaterials] = useState<Material[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table' | 'tree'>('grid');

  // Modals State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedMaterialForText, setSelectedMaterialForText] = useState<Material | null>(null);

  // Add/Link Form State
  const [driveUrl, setDriveUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStage, setFormStage] = useState('secondary');
  const [formGrade, setFormGrade] = useState('3_sec');
  const [formSubjectId, setFormSubjectId] = useState('');
  const [formUnitName, setFormUnitName] = useState('');
  const [formLessonName, setFormLessonName] = useState('');
  const [formCategory, setFormCategory] = useState<DocumentCategory>('lecture_notes');
  const [autoIndex, setAutoIndex] = useState(true);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  // Fetch Materials and Subjects
  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/center/${centerSlug}/materials`);
      if (res.ok) {
        const data = await res.json();
        setMaterials(data.materials || []);
      }

      // Fetch subjects
      const subjRes = await fetch(`/api/center/${centerSlug}/attendance/scan?check=true`).catch(() => null);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerSlug]);

  // Set default subject ID when materials or subjects change
  useEffect(() => {
    if (materials.length > 0 && !formSubjectId) {
      setFormSubjectId(materials[0].subjectId || 'sub-phys-3sec');
    }
  }, [materials, formSubjectId]);

  // Available grades cascading from selected stage
  const availableGrades = useMemo(() => {
    if (selectedStage === 'all') {
      return EGYPTIAN_STAGES.flatMap((s) => s.grades);
    }
    const stage = EGYPTIAN_STAGES.find((s) => s.code === selectedStage);
    return stage ? stage.grades : [];
  }, [selectedStage]);

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

  // Handle Add / Link Submit
  const handleAddMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formTitle.trim()) {
      setFormError('يرجى إدخال عنوان المذكرة');
      return;
    }
    if (!formUnitName.trim() || !formLessonName.trim()) {
      setFormError('يرجى تحديد الوحدة والدرس التعليمي بدقة');
      return;
    }

    setFormSubmitting(true);
    try {
      const res = await fetch(`/api/center/${centerSlug}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleDriveUrlOrId: driveUrl.trim() || undefined,
          title: formTitle.trim(),
          description: formDescription.trim(),
          stage: formStage,
          grade: formGrade,
          subjectId: formSubjectId || 'sub-phys-3sec',
          unitName: formUnitName.trim(),
          lessonName: formLessonName.trim(),
          category: formCategory,
          autoIndex,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'فشلت عملية الإضافة');
      }

      const resData = await res.json();
      setMaterials((prev) => [resData.material, ...prev]);
      setShowAddModal(false);
      // Reset form
      setDriveUrl('');
      setFormTitle('');
      setFormDescription('');
      setFormUnitName('');
      setFormLessonName('');
    } catch (err: any) {
      setFormError(err.message || 'حدث خطأ أثناء حفظ المذكرة');
    } finally {
      setFormSubmitting(false);
    }
  };

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

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة مذكرة / ربط Google Drive</span>
          </button>
        </div>
      </div>

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
            }}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع المراحل التعليمية</option>
            {EGYPTIAN_STAGES.map((s) => (
              <option key={s.code} value={s.code}>
                {s.nameAr}
              </option>
            ))}
          </select>

          {/* Grade Filter */}
          <select
            value={selectedGrade}
            onChange={(e) => setSelectedGrade(e.target.value)}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع الصفوف الدراسية</option>
            {availableGrades.map((g) => (
              <option key={g.code} value={g.code}>
                {g.nameAr}
              </option>
            ))}
          </select>

          {/* Subject Filter */}
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="p-2 rounded-xl border border-border bg-background text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="all">جميع المواد الدراسية</option>
            <option value="sub-phys-3sec">الفيزياء الكهربية والحديثة</option>
            <option value="sub-math-3sec">الرياضيات التطبيقية</option>
            <option value="sub-chem-3sec">الكيمياء العامة</option>
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
                    <h3 className="text-sm font-bold text-foreground line-clamp-1">{mat.title}</h3>
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
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
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
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
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
                    <div className="flex items-center gap-2">
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
            {EGYPTIAN_STAGES.map((stg) => {
              const stageMats = materials.filter((m) => m.stage === stg.code);
              return (
                <div key={stg.code} className="p-3 rounded-xl bg-muted/30 border border-border space-y-2">
                  <div className="font-bold text-foreground text-sm flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Folder className="w-4 h-4 text-amber-500" />
                      {stg.nameAr}
                    </span>
                    <span className="text-xs text-muted-foreground font-normal">
                      {stageMats.length} مذكرة
                    </span>
                  </div>

                  <div className="mr-6 space-y-2 pt-1 border-r-2 border-border pr-3">
                    {stg.grades.map((grd) => {
                      const gradeMats = stageMats.filter((m) => m.grade === grd.code);
                      if (gradeMats.length === 0) return null;
                      return (
                        <div key={grd.code} className="space-y-1">
                          <div className="text-foreground font-semibold flex items-center justify-between">
                            <span>📂 {grd.nameAr}</span>
                            <span className="text-[11px] text-muted-foreground">
                              {gradeMats.length} ملف
                            </span>
                          </div>
                          <div className="mr-4 space-y-1 text-muted-foreground">
                            {gradeMats.map((m) => (
                              <div
                                key={m.id}
                                className="flex items-center justify-between p-1.5 rounded-lg hover:bg-muted/50 cursor-pointer"
                                onClick={() => setSelectedMaterialForText(m)}
                              >
                                <span className="flex items-center gap-1.5 text-foreground">
                                  <FileText className="w-3.5 h-3.5 text-cyan-500" />
                                  {m.title}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {m.wordCount} كلمة
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
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

      {/* Modal: Add Material / Link Google Drive */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-cyan-500" />
                <span>إضافة مذكرة جديدة أو ربط Google Drive</span>
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddMaterialSubmit} className="p-6 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs">
                  {formError}
                </div>
              )}

              {/* Google Drive URL */}
              <div>
                <label className="font-bold text-foreground block mb-1">
                  رابط ملف Google Drive (اختياري للربط السحابي):
                </label>
                <input
                  type="text"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/1BxiMVs.../view أو معرف الملف"
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  يدعم مشاركة Google Docs أو PDF أو معرف الملف المباشر.
                </p>
              </div>

              {/* Title */}
              <div>
                <label className="font-bold text-foreground block mb-1">عنوان المذكرة *:</label>
                <input
                  type="text"
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="مثال: مذكرة شرح قوانين كيرشوف والدوائر الكهربية"
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="font-bold text-foreground block mb-1">نبذة عن المحتوى:</label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="شرح موجز لأهم النقاط والمفاهيم..."
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="font-bold text-foreground block mb-1">تصنيف المذكرة:</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value as DocumentCategory)}
                  className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="lecture_notes">مذكرة شرح تفصيلية</option>
                  <option value="summary">ملخص ومراجعة سريعة</option>
                  <option value="exercises">تمارين وتطبيقات عملية</option>
                  <option value="exam_bank">بنك أسئلة واختبارات</option>
                  <option value="formula_sheet">ورقة قوانين ومفاهيم</option>
                </select>
              </div>

              {/* 6-Tier Hierarchy Selectors */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="font-bold text-foreground block mb-1">المرحلة *:</label>
                  <select
                    value={formStage}
                    onChange={(e) => setFormStage(e.target.value)}
                    className="w-full p-2 rounded-xl border border-border bg-background text-foreground"
                  >
                    {EGYPTIAN_STAGES.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">الصف الدراسي *:</label>
                  <select
                    value={formGrade}
                    onChange={(e) => setFormGrade(e.target.value)}
                    className="w-full p-2 rounded-xl border border-border bg-background text-foreground"
                  >
                    <option value="3_sec">الصف الثالث الثانوي</option>
                    <option value="2_sec">الصف الثاني الثانوي</option>
                    <option value="1_sec">الصف الأول الثانوي</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">الوحدة الدراسية *:</label>
                  <input
                    type="text"
                    required
                    value={formUnitName}
                    onChange={(e) => setFormUnitName(e.target.value)}
                    placeholder="مثال: الوحدة الأولى: التيار الكهربي"
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">الدرس التعليمي *:</label>
                  <input
                    type="text"
                    required
                    value={formLessonName}
                    onChange={(e) => setFormLessonName(e.target.value)}
                    placeholder="مثال: قوانين كيرشوف"
                    className="w-full p-2.5 rounded-xl border border-border bg-background text-foreground"
                  />
                </div>
              </div>

              {/* Auto-Index Checkbox */}
              <label className="flex items-center gap-2 pt-2 cursor-pointer font-bold">
                <input
                  type="checkbox"
                  checked={autoIndex}
                  onChange={(e) => setAutoIndex(e.target.checked)}
                  className="rounded border-border text-cyan-500 focus:ring-cyan-500"
                />
                <span>استخراج وفهرسة النص تلقائياً تمهيداً لتوليد امتحانات AI</span>
              </label>

              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl border border-border text-foreground hover:bg-muted font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md hover:from-cyan-400 hover:to-blue-500"
                >
                  {formSubmitting ? 'جاري الحفظ...' : 'حفظ وإضافة المذكرة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
