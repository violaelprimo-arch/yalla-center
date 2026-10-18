# Yalla Center — Milestone 5: Materials Taxonomy & Google Drive Integration
## Comprehensive Architectural Investigation & Implementation Blueprint (FEAT-31 & FEAT-32)

- **Author**: Explorer M5-1 (Materials Taxonomy & Google Drive Integration Explorer)
- **Target Working Directory**: `d:\Software\YALLA CODEX\YALLA CENTER\.agents\teamwork\teamwork_preview_explorer_m5_1`
- **Project Root**: `d:\Software\YALLA CODEX\YALLA CENTER`
- **Target Recipient**: Orchestrator & Worker M5
- **Timestamp**: 2026-10-18T07:15:00Z
- **Status**: COMPLETE & VERIFIED

---

## 1. Executive Summary

Milestone 5 establishes the academic bedrock of the Yalla Center platform by implementing the **6-Tier Educational Materials Taxonomy (FEAT-31)** and the **Google Drive Materials Integration & Text Indexing Engine (FEAT-32)**. 

In Egyptian private tutoring centers and educational academies, teachers manage hundreds of study handouts, lecture summaries, question banks, and solved problem sets. These documents are predominantly authored in PDF or Google Docs and stored in Google Drive. For the platform's **In-Session AI Exam Generator (AC-8)** to function accurately and avoid hallucinations, every generated question must be strictly grounded in authorized teacher materials with a verified minimum depth of extracted text ($\ge 200$ words).

This report specifies the end-to-end data models, DAL interface contracts, UI explorer architecture, Arabic typography rules, Google Drive linking mechanics, and mock dataset required for Worker M5 to execute the implementation with zero ambiguity.

---

## 2. 6-Tier Educational Materials Taxonomy Architecture (FEAT-31)

### 2.1 The 6-Tier Hierarchy Definition

The hierarchy aligns with the Egyptian Ministry of Education structure, ensuring natural navigation for teachers, administrators, and students:

```
Tier 1: Stage (المرحلة التعليمية)
   │
   ├── Tier 2: Grade (الصف الدراسي)
   │      │
   │      ├── Tier 3: Subject (المادة الدراسية)
   │             │
   │             ├── Tier 4: Unit (الوحدة الدراسية)
   │                    │
   │                    ├── Tier 5: Lesson (الدرس التعليمي)
   │                           │
   │                           └── Tier 6: Documents & Files (المستندات والملفات الأكاديمية)
```

### 2.2 Canonical Taxonomy Mapping Table

| Tier | Code / ID | Arabic Name | Context & Sub-elements |
|---|---|---|---|
| **Tier 1: Stage** | `primary` | المرحلة الابتدائية | صفوف 1 إلى 6 |
| | `preparatory` | المرحلة الإعدادية | صفوف 1 إلى 3 |
| | `secondary` | المرحلة الثانوية | صفوف 1 إلى 3 (علمي وأدبي) |
| **Tier 2: Grade** | `1_prim` .. `6_prim` | الصف الأول .. السادس الابتدائي | المرحلة الابتدائية |
| | `1_prep` .. `3_prep` | الصف الأول .. الثالث الإعدادي | المرحلة الإعدادية |
| | `1_sec` .. `3_sec` | الصف الأول .. الثالث الثانوي | المرحلة الثانوية (الثانوية العامة) |
| **Tier 3: Subject** | UUID (`subjects.id`) | المادة الدراسية (مثل: الفيزياء، الكيمياء، الرياضيات، اللغة العربية، الأحياء) | مرتبطة بالمركز والصف والمرحلة |
| **Tier 4: Unit** | `unitName` (أو `units.id`) | الوحدة الدراسية (مثل: الوحدة الأولى: التيار الكهربي وقانون أوم) | تجمع دروس الوحدة |
| **Tier 5: Lesson** | `lessonName` (أو `lessons.id`) | الدرس التعليمي (مثل: الدرس الأول: المقاومة وقانون أوم، الدرس الثاني: قوانين كيرشوف) | موضوع دراسي محدد |
| **Tier 6: Document** | UUID (`materials.id`) | الملف الأكاديمي (مذكرة، ملخص، بنك أسئلة، ورقة قوانين) | ملف PDF / Drive مع فهرس نصي |

### 2.3 Document Classifications (أنواع المذكرات الأكاديمية)

Each document is tagged with an educational category to assist teachers and students:
1. `lecture_notes` (مذكرة شرح تفصيلية): Complete textbook / lecture booklet.
2. `summary` (ملخص ومراجعة سريعة): High-yield revision points.
3. `exercises` (تمارين وتطبيقات عملية): Homework, solved problem sheets.
4. `exam_bank` (بنك أسئلة واختبارات): Mock exam question pools.
5. `formula_sheet` (ورقة قوانين ومفاهيم): Math / physics formula sheet with KaTeX notations.

---

## 3. Google Drive Materials Integration & Text Indexing Pipeline (FEAT-32)

### 3.1 Google Drive Linking Architecture

Teachers frequently share Google Drive links. The system must support flexible linking via:
1. Standard Google Drive sharing URL: `https://drive.google.com/file/d/{FILE_ID}/view?usp=sharing`
2. Google Docs URL: `https://docs.google.com/document/d/{FILE_ID}/edit`
3. Google Sheets URL: `https://docs.google.com/spreadsheets/d/{FILE_ID}/edit`
4. Google Slides URL: `https://docs.google.com/presentation/d/{FILE_ID}/edit`
5. Google Drive open URL: `https://drive.google.com/open?id={FILE_ID}`
6. Raw Drive File ID: e.g. `1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms`

#### Regex Extraction Formula
```typescript
export function extractGoogleDriveFileId(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  
  // Direct file ID check (alphanumeric, underscores, hyphens, 25-60 chars)
  if (/^[a-zA-Z0-9_-]{25,60}$/.test(trimmed)) {
    return trimmed;
  }

  // File URL pattern: /file/d/{id}
  const fileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch) return fileMatch[1];

  // Document/Presentation/Spreadsheet URL pattern: /d/{id}
  const docMatch = trimmed.match(/\/(?:document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/);
  if (docMatch) return docMatch[1];

  // Query parameter pattern: id={id}
  const queryMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryMatch) return queryMatch[1];

  return null;
}
```

#### Drive Metadata Resolution
From the extracted File ID, the platform constructs canonical Google Drive endpoints:
- `webViewLink`: `https://drive.google.com/file/d/${fileId}/view`
- `webContentLink`: `https://drive.google.com/uc?export=download&id=${fileId}`
- `thumbnailLink`: `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`

### 3.2 Text Indexing Pipeline

Text indexing transforms unstructured PDF or Google Drive documents into clean, searchable, tokenized Arabic text used to ground the AI Exam Generator.

#### State Machine
The document `indexStatus` transitions through the following lifecycle:
```
           ┌──────────┐
           │ pending  │ ── (Index Action Triggered)
           └────┬─────┘
                │
                ▼
          ┌───────────┐
          │ indexing  │ ── (Extracting text & counting words)
          └─────┬─────┘
                │
       ┌────────┴────────┬───────────────┐
       ▼                 ▼               ▼
 ┌───────────┐     ┌──────────────┐ ┌─────────┐
 │  indexed  │     │ insufficient │ │ failed  │
 └───────────┘     └──────────────┘ └─────────┘
 (Words ≥ 200)      (0 < Words < 200) (Error / 0)
 (AC-8 Qualified)  (AC-8 Rejection)  (AC-8 Rejection)
```

#### Arabic Text Word Count Calculation
Arabic text requires proper tokenization handling diacritics (تشكيل), tatweel (ـ), punctuation, and mathematical notation:
```typescript
export function countArabicWords(text: string): number {
  if (!text || typeof text !== 'string') return 0;
  
  // 1. Remove diacritics (tashkeel: fatha, damma, kasra, sukun, tanween)
  const normalized = text.replace(/[\u064B-\u065F\u0670]/g, '');
  
  // 2. Remove tatweel (kashida)
  const clean = normalized.replace(/\u0640/g, '');
  
  // 3. Tokenize by whitespace, hyphens, and standard Arabic/English punctuation
  const tokens = clean
    .split(/[\s,،؛.:!?؟()[\]{}<>"'`\\/+=*^%~#$|]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && !/^\d+$/.test(t)); // filter out standalone numbers

  return tokens.length;
}
```

#### Grounding Preflight Gate Invariants (AC-8)
As verified in `tests/integration/ai-exam-gate.test.ts`:
1. `documents.length === 0` $\rightarrow$ `errorCode: 'UNINDEXED_SOURCE_DOCUMENTS'`.
2. Any document with `indexStatus !== 'indexed'` $\rightarrow$ `errorCode: 'UNINDEXED_SOURCE_DOCUMENTS'`.
3. Total word count across selected documents $< 200$ $\rightarrow$ `errorCode: 'INSUFFICIENT_SOURCE_DOCUMENTS'`.
4. Only documents meeting both criteria pass the preflight gate and allow draft generation.

---

## 4. Database Schema & Data Models

### 4.1 Existing Schema Review (`lib/supabase/schema.sql`)
The database contains the `materials` table (table #15):
```sql
CREATE TABLE materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage VARCHAR(64) NOT NULL,
  grade VARCHAR(64) NOT NULL,
  subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE RESTRICT,
  unit_name VARCHAR(128) NOT NULL,
  lesson_name VARCHAR(128) NOT NULL,
  title VARCHAR(255) NOT NULL,
  file_url TEXT NOT NULL,
  google_drive_file_id VARCHAR(128),
  file_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_type VARCHAR(32) NOT NULL DEFAULT 'application/pdf',
  text_content_indexed TEXT,
  word_count INT NOT NULL DEFAULT 0,
  index_status material_index_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Enriched TypeScript Types (`lib/dal/types.ts`)
To support full Google Drive metadata, document classifications, and UI preview needs, the `Material` type should be extended as follows (preserving backward compatibility):

```typescript
export type DocumentCategory = 
  | 'lecture_notes' 
  | 'summary' 
  | 'exercises' 
  | 'exam_bank' 
  | 'formula_sheet';

export interface Material {
  id: string;
  tenantId: string;
  teacherId: string;
  stage: string;
  grade: string;
  subjectId: string;
  unitName: string;
  lessonName: string;
  title: string;
  description?: string;
  category?: DocumentCategory;
  fileUrl: string;
  googleDriveFileId?: string;
  googleDriveWebViewLink?: string;
  googleDriveWebContentLink?: string;
  googleDriveThumbnailLink?: string;
  fileSizeBytes: number;
  fileType: string; // 'application/pdf' | 'application/vnd.google-apps.document' | etc.
  textContentIndexed?: string;
  wordCount: number;
  indexStatus: MaterialIndexStatus;
  lastIndexedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateMaterialInput {
  tenantId: string;
  teacherId: string;
  stage: string;
  grade: string;
  subjectId: string;
  unitName: string;
  lessonName: string;
  title: string;
  description?: string;
  category?: DocumentCategory;
  fileUrl: string;
  googleDriveFileId?: string;
  fileSizeBytes?: number;
  fileType?: string;
  textContentIndexed?: string;
  indexImmediately?: boolean;
}

export interface MaterialsSummaryStats {
  totalMaterials: number;
  indexedMaterials: number;
  pendingMaterials: number;
  insufficientMaterials: number;
  failedMaterials: number;
  totalIndexedWords: number;
  googleDriveLinkedCount: number;
}
```

### 4.3 Hierarchical Tree Data Structure for Navigation
To power both the tree view and folder explorer, the taxonomy tree is modeled as:

```typescript
export interface TaxonomyLessonNode {
  lessonName: string;
  materials: Material[];
}

export interface TaxonomyUnitNode {
  unitName: string;
  lessons: TaxonomyLessonNode[];
  totalMaterialsCount: number;
}

export interface TaxonomySubjectNode {
  subjectId: string;
  subjectNameAr: string;
  subjectCode?: string;
  units: TaxonomyUnitNode[];
  totalMaterialsCount: number;
}

export interface TaxonomyGradeNode {
  gradeCode: string;
  gradeNameAr: string;
  subjects: TaxonomySubjectNode[];
  totalMaterialsCount: number;
}

export interface TaxonomyStageNode {
  stageCode: string;
  stageNameAr: string;
  grades: TaxonomyGradeNode[];
  totalMaterialsCount: number;
}
```

### 4.4 Data Access Layer (`IDataProvider`) Contract Additions
In `lib/dal/index.ts`, enrich section 9 with the following operational methods:

```typescript
// 9. Materials & AI Exams
getMaterials(tenantId: string, filter?: { 
  stage?: string; 
  grade?: string; 
  subjectId?: string; 
  indexStatus?: MaterialIndexStatus;
  teacherId?: string;
  search?: string;
}): Promise<Material[]>;

getMaterialById(tenantId: string, materialId: string): Promise<Material | null>;

createMaterial(input: CreateMaterialInput): Promise<Material>;

updateMaterial(
  tenantId: string, 
  materialId: string, 
  updates: Partial<Material>
): Promise<Material>;

deleteMaterial(tenantId: string, materialId: string): Promise<{ success: boolean }>;

indexMaterialContent(
  tenantId: string, 
  materialId: string, 
  options?: { forceReindex?: boolean; customText?: string }
): Promise<Material>;

linkGoogleDriveDocument(
  tenantId: string, 
  params: {
    googleDriveUrlOrId: string;
    teacherId: string;
    stage: string;
    grade: string;
    subjectId: string;
    unitName: string;
    lessonName: string;
    title?: string;
    category?: DocumentCategory;
    autoIndex?: boolean;
  }
): Promise<Material>;

getMaterialsStats(tenantId: string): Promise<MaterialsSummaryStats>;

getMaterialsTaxonomyTree(tenantId: string): Promise<TaxonomyStageNode[]>;
```

---

## 5. UI Architecture for `/center/[centerSlug]/materials`

### 5.1 Component Breakdown

```
app/center/[centerSlug]/materials/page.tsx
│
├── components/materials/materials-header.tsx
│   ├── Breadcrumb navigation trail (المرحلة > الصف > المادة > الوحدة > الدرس)
│   ├── Fast Statistics Bar (Total, Indexed, Drive Linked, Words)
│   └── Action: "+ إضافة مذكرة / ربط Google Drive"
│
├── components/materials/materials-filter-bar.tsx
│   ├── Instant search input (title, lesson, unit, text)
│   ├── Stage dropdown (الكل, ابتدائية, إعدادية, ثانوية)
│   ├── Grade dropdown (cascading from stage)
│   ├── Subject dropdown (cascading from grade)
│   ├── Index Status filter pill group (الكل, مفهرس, غير مفهرس, غير كافٍ)
│   └── View mode switcher (شجرة مجلدات, شبكة بطاقات, جدول تفصيلي)
│
├── View 1: components/materials/materials-tree-view.tsx
│   └── Collapsible hierarchy tree with item counts and quick node selection
│
├── View 2: components/materials/materials-folder-grid.tsx
│   ├── Windows/Mac explorer folder cards for stages/grades/subjects/units/lessons
│   └── File cards when browsing a terminal lesson
│
├── View 3: components/materials/materials-table-view.tsx
│   └── Compact tabular view with status badges, word counts, and actions
│
├── components/materials/material-file-card.tsx
│   ├── Thumbnail / Drive icon / PDF icon
│   ├── Title, category badge, teacher author, file size
│   ├── Index status badge with word count
│   └── Action dropdown (Preview, View Text, Re-index, Generate Exam, Delete)
│
├── components/materials/material-upload-modal.tsx
│   ├── Tab 1: "ربط ملف Google Drive" (URL paste, ID extractor, title fetch)
│   ├── Tab 2: "رفع ملف محلي" (PDF, DOCX, TXT dropzone)
│   ├── 6-Tier taxonomy selectors (Stage, Grade, Subject, Unit with "+ جديد", Lesson with "+ جديد")
│   └── Auto-index checkbox
│
├── components/materials/material-preview-modal.tsx
│   ├── Google Drive web preview iframe / PDF link
│   └── Document metadata summary
│
├── components/materials/material-text-viewer-modal.tsx
│   ├── Extracted text viewer with Arabic font & LTR KaTeX formulas
│   └── Word count metrics & AI Grounding readiness indicator
│
└── components/materials/material-indexing-modal.tsx
    ├── Live indexing progress simulation
    └── Status notification
```

### 5.2 Egyptian Secondary Physics & Science Authentic Text Bank

To make the demo environment immediately impressive and pass all AC-8 tests, the mock repository contains authentic Egyptian secondary curriculum materials with KaTeX formulas:

1. **قوانين كيرشوف وقانون أوم للدائرة المغلقة (فيزياء 3 ثانوي)**:
   - Word count: 215 words.
   - Status: `indexed`.
   - KaTeX formulas: $\sum I_{\text{in}} = \sum I_{\text{out}}$, $\sum V_B = \sum I \cdot R$, $V = V_B - I \cdot r$.
2. **المجال المغناطيسي للتيار الكهربي وأجهزة القياس (فيزياء 3 ثانوي)**:
   - Word count: 420 words.
   - Status: `indexed`.
   - KaTeX formulas: $B = \frac{\mu I}{2\pi d}$, $B = \frac{\mu N I}{2r}$, $\tau = B I A N \sin\theta$.
3. **العناصر الانتقالية وسبائك الحديد (كيمياء 3 ثانوي)**:
   - Word count: 380 words.
   - Status: `indexed`.
   - Chemical formulas: $\text{Fe}_2\text{O}_3$, $\text{Fe}_3\text{O}_4$, $\text{FeO}$.
4. **اشتقاق الدوال المثلثية وتطبيقات المعدلات الزمنية (رياضيات 3 ثانوي)**:
   - Word count: 290 words.
   - Status: `indexed`.
   - KaTeX formulas: $\frac{d}{dx}(\sin x) = \cos x$, $\frac{d}{dx}(\tan x) = \sec^2 x$.
5. **ملاحظة موجزة عن قانون أوم (غير كافية)**:
   - Word count: 25 words.
   - Status: `insufficient` (triggers `INSUFFICIENT_SOURCE_DOCUMENTS`).
6. **مذكرة دوائر الرنين والمكثفات (غير مفهرسة)**:
   - Word count: 0 words.
   - Status: `pending` (triggers `UNINDEXED_SOURCE_DOCUMENTS`).

---

## 6. Implementation Roadmap for Worker M5

Worker M5 should follow this exact sequence to ensure clean builds, passing tests, and complete UI functionality:

### Phase 1: Foundation Services & Utilities (`lib/materials/`)
- Create `lib/materials/drive.ts`:
  - Implement `extractGoogleDriveFileId(urlOrId: string)`.
  - Implement `buildDriveLinks(fileId: string)`.
  - Implement `simulateDriveMetadataFetch(fileId: string)`.
- Create `lib/materials/indexer.ts`:
  - Implement `countArabicWords(text: string)`.
  - Implement `evaluateIndexingStatus(wordCount: number)`.
  - Implement `simulateTextExtraction(title: string, fileType: string)`.
- Create `lib/materials/taxonomy.ts`:
  - Define stages, grades, and Egyptian curriculum constants.
  - Implement `buildTaxonomyTree(materials: Material[], subjects: Subject[])`.

### Phase 2: DAL & Mock Data Expansion (`lib/dal/`)
- Update `lib/dal/types.ts`:
  - Extend `Material` interface with Drive links, category, and metadata.
  - Add `CreateMaterialInput`, `MaterialsSummaryStats`, and taxonomy node types.
- Update `lib/dal/index.ts`:
  - Add materials CRUD, Drive linking, and taxonomy methods to `IDataProvider`.
- Update `lib/dal/mock-data.ts`:
  - Expand `INITIAL_SEEDED_DATA.materials` with the multi-stage, multi-subject authentic dataset.
  - Implement `createMaterial`, `updateMaterial`, `deleteMaterial`, `indexMaterialContent`, `linkGoogleDriveDocument`, `getMaterialsStats`, and `getMaterialsTaxonomyTree` in `MockDataProvider`.

### Phase 3: Components Library (`components/materials/`)
- Create `components/materials/materials-header.tsx`: Header, breadcrumb trail, and stats badges.
- Create `components/materials/materials-filter-bar.tsx`: Search, cascading dropdowns, and view switcher.
- Create `components/materials/material-file-card.tsx`: Card with Drive thumbnail, status pill, and actions.
- Create `components/materials/materials-tree-view.tsx`: Interactive tree view.
- Create `components/materials/materials-folder-grid.tsx`: Explorer folder grid.
- Create `components/materials/material-upload-modal.tsx`: Modal for Drive linking & local uploads.
- Create `components/materials/material-text-viewer-modal.tsx`: Extracted text viewer with KaTeX equations.
- Create `components/materials/material-preview-modal.tsx`: Google Drive document preview.

### Phase 4: Page Integration (`app/center/[centerSlug]/materials/page.tsx`)
- Replace the placeholder page with the complete, fully responsive Arabic RTL Materials Explorer workspace connecting all filters, views, modals, and DAL queries.

### Phase 5: Verification & Test Execution
- Run `npx vitest run tests/integration/ai-exam-gate.test.ts` to ensure preflight gate contracts remain 100% green.
- Run complete test suite `npx vitest run`.
- Verify build passes: `npm run build` or `npx next build`.

---

## 7. Conclusion

This blueprint provides everything Worker M5 needs to deliver the 6-Tier Educational Materials Taxonomy and Google Drive Integration with zero guesswork, robust Arabic RTL compliance, strict adherence to AC-8 grounding gate invariants, and high-fidelity UI design.
