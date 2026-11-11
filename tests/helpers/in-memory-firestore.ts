import type { FirestoreWriteOperation, StructuredFilter } from '@/lib/firebase/firestore-rest';
import type { ILessonScoreStore } from '@/lib/firebase/server';

export class InMemoryTransactionalFirestoreStore implements ILessonScoreStore {
  docs = new Map<string, { data: Record<string, unknown>; updateTime: string }>();
  private clock = 1;

  seed(path: string, data: Record<string, unknown>) {
    this.clock += 1;
    this.docs.set(path, { data: structuredClone(data), updateTime: `2026-11-11T12:00:${String(this.clock).padStart(2, '0')}Z` });
  }

  async getDocument<T = Record<string, unknown>>(
    documentPath: string
  ): Promise<{ exists: false } | { exists: true; data: T; updateTime?: string }> {
    const clean = documentPath.replace(/^\/+/, '');
    const row = this.docs.get(clean);
    if (!row) return { exists: false };
    return { exists: true, data: structuredClone(row.data) as T, updateTime: row.updateTime };
  }

  async queryCollection<T = Record<string, unknown>>(
    collectionId: string,
    filters: StructuredFilter[]
  ): Promise<Array<{ data: T; updateTime?: string; id: string }>> {
    const prefix = `${collectionId}/`;
    const out: Array<{ data: T; updateTime?: string; id: string }> = [];
    for (const [path, row] of this.docs.entries()) {
      if (!path.startsWith(prefix)) continue;
      const matches = filters.every((f) => {
        const val = row.data[f.fieldPath];
        if (f.op === 'EQUAL') return val === f.value;
        return false;
      });
      if (matches) {
        out.push({
          id: path.slice(prefix.length),
          data: structuredClone(row.data) as T,
          updateTime: row.updateTime,
        });
      }
    }
    return out;
  }

  async commit(writes: FirestoreWriteOperation[]): Promise<void> {
    // Check preconditions first (atomic semantics)
    for (const w of writes) {
      const clean = w.documentPath.replace(/^\/+/, '');
      const current = this.docs.get(clean);
      if (w.currentDocument?.exists === false && current) {
        throw new Error(`409 ALREADY_EXISTS at ${clean}`);
      }
      if (w.currentDocument?.exists === true && !current) {
        throw new Error(`409 NOT_FOUND at ${clean}`);
      }
      if (w.currentDocument?.updateTime && current?.updateTime !== w.currentDocument.updateTime) {
        throw new Error(`409 UPDATE_TIME_MISMATCH at ${clean}`);
      }
    }

    for (const w of writes) {
      const clean = w.documentPath.replace(/^\/+/, '');
      if (w.type === 'delete') {
        this.docs.delete(clean);
      } else if (w.data) {
        this.clock += 1;
        this.docs.set(clean, {
          data: structuredClone(w.data),
          updateTime: `2026-11-11T12:00:${String(this.clock).padStart(2, '0')}Z`,
        });
      }
    }
  }
}

