/**
 * Cloudflare Workers + Node-compatible Cloud Firestore REST v1 Client
 * Uses Web-standard fetch + Web Crypto (no native gRPC / firebase-admin C++ bindings).
 */

export type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

export interface FirestoreRestDocument {
  name?: string;
  fields?: Record<string, FirestoreValue>;
  createTime?: string;
  updateTime?: string;
}

export class FirestoreHttpError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = 'FirestoreHttpError';
    this.status = status;
    this.code = code;
  }
}

export function encodeFirestoreValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) {
    return { nullValue: null };
  }
  if (typeof value === 'boolean') {
    return { booleanValue: value };
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return { nullValue: null };
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === 'string') {
    return { stringValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map((item) => encodeFirestoreValue(item)) } };
  }
  if (typeof value === 'object') {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function decodeFirestoreValue(value: FirestoreValue | undefined): unknown {
  if (!value) return undefined;
  if ('nullValue' in value) return null;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return Number(value.doubleValue);
  if ('timestampValue' in value) return value.timestampValue;
  if ('stringValue' in value) return value.stringValue;
  if ('arrayValue' in value) {
    return (value.arrayValue.values ?? []).map((item) => decodeFirestoreValue(item));
  }
  if ('mapValue' in value) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value.mapValue.fields ?? {})) {
      out[k] = decodeFirestoreValue(v);
    }
    return out;
  }
  return undefined;
}

export function encodeFirestoreFields(obj: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      fields[key] = encodeFirestoreValue(val);
    }
  }
  return fields;
}

export function decodeFirestoreDocument<T = Record<string, unknown>>(
  doc: FirestoreRestDocument
): { data: T; updateTime?: string; name?: string } {
  const data: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(doc.fields ?? {})) {
    data[key] = decodeFirestoreValue(val);
  }
  return {
    data: data as T,
    updateTime: doc.updateTime,
    name: doc.name,
  };
}

export interface FirestoreWriteOperation {
  type: 'set' | 'delete';
  documentPath: string; // e.g. "lesson_grades/exam1_std1"
  data?: Record<string, unknown>;
  currentDocument?: { exists?: boolean; updateTime?: string };
}

export interface StructuredFilter {
  fieldPath: string;
  op: 'EQUAL' | 'GREATER_THAN' | 'GREATER_THAN_OR_EQUAL' | 'LESS_THAN' | 'LESS_THAN_OR_EQUAL';
  value: unknown;
}

export interface FirestoreRestClientOptions {
  projectId: string;
  accessToken: string;
  fetchImpl?: typeof fetch;
}

export class FirestoreRestClient {
  private readonly baseUrl: string;
  private readonly docPrefix: string;
  private readonly accessToken: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: FirestoreRestClientOptions) {
    this.docPrefix = `projects/${options.projectId}/databases/(default)/documents`;
    this.baseUrl = `https://firestore.googleapis.com/v1/${this.docPrefix}`;
    this.accessToken = options.accessToken;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await this.fetchImpl(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.accessToken}`,
        ...(init.headers ?? {}),
      },
    });

    if (!response.ok) {
      let message = `Firestore HTTP ${response.status}`;
      let code: string | undefined;
      try {
        const body = (await response.json()) as { error?: { message?: string; status?: string } };
        if (body?.error?.message) message = body.error.message;
        if (body?.error?.status) code = body.error.status;
      } catch {
        // non-json error response
      }
      throw new FirestoreHttpError(response.status, message, code);
    }

    return (await response.json()) as T;
  }

  async getDocument<T = Record<string, unknown>>(
    documentPath: string
  ): Promise<{ exists: false } | { exists: true; data: T; updateTime?: string }> {
    const cleanPath = documentPath.replace(/^\/+/, '');
    try {
      const doc = await this.request<FirestoreRestDocument>(`${this.baseUrl}/${cleanPath}`, {
        method: 'GET',
      });
      const decoded = decodeFirestoreDocument<T>(doc);
      return { exists: true, data: decoded.data, updateTime: decoded.updateTime };
    } catch (err) {
      if (err instanceof FirestoreHttpError && err.status === 404) {
        return { exists: false };
      }
      throw err;
    }
  }

  async queryCollection<T = Record<string, unknown>>(
    collectionId: string,
    filters: StructuredFilter[]
  ): Promise<Array<{ data: T; updateTime?: string; id: string }>> {
    const fieldFilters = filters.map((filter) => ({
      fieldFilter: {
        field: { fieldPath: filter.fieldPath },
        op: filter.op,
        value: encodeFirestoreValue(filter.value),
      },
    }));

    const where =
      fieldFilters.length === 1
        ? fieldFilters[0]
        : fieldFilters.length > 1
          ? { compositeFilter: { op: 'AND', filters: fieldFilters } }
          : undefined;

    const rows = await this.request<Array<{ document?: FirestoreRestDocument }>>(
      `${this.baseUrl}:runQuery`,
      {
        method: 'POST',
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId }],
            ...(where ? { where } : {}),
          },
        }),
      }
    );

    const out: Array<{ data: T; updateTime?: string; id: string }> = [];
    for (const row of rows) {
      if (!row.document) continue;
      const decoded = decodeFirestoreDocument<T>(row.document);
      const id = row.document.name?.split('/').pop() ?? '';
      out.push({ data: decoded.data, updateTime: decoded.updateTime, id });
    }
    return out;
  }

  async commit(writes: FirestoreWriteOperation[]): Promise<void> {
    if (writes.length === 0) return;

    const payloadWrites = writes.map((w) => {
      const name = `${this.docPrefix}/${w.documentPath.replace(/^\/+/, '')}`;
      if (w.type === 'delete') {
        return {
          delete: name,
          ...(w.currentDocument ? { currentDocument: w.currentDocument } : {}),
        };
      }
      return {
        update: {
          name,
          fields: encodeFirestoreFields(w.data ?? {}),
        },
        ...(w.currentDocument ? { currentDocument: w.currentDocument } : {}),
      };
    });

    await this.request(`${this.baseUrl}:commit`, {
      method: 'POST',
      body: JSON.stringify({ writes: payloadWrites }),
    });
  }
}
