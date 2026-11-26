import { requireRepoModule } from './module-loader';

export interface TestRsaKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  publicJwk: JsonWebKey & { kid: string; alg: string; use: string };
  kid: string;
}

export interface FirebaseIdTokenClaims {
  sub?: string;
  uid?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  aud?: string;
  iss?: string;
  iat?: number;
  auth_time?: number;
  exp?: number;
  [key: string]: unknown;
}

export interface FirestoreFailureConfig {
  target: 'read' | 'query' | 'commit' | 'all';
  status?: number;
  code?: string;
  message?: string;
  once?: boolean;
}

export interface StoredFirestoreDoc {
  fields: Record<string, unknown>;
  data: Record<string, unknown>;
  createTime: string;
  updateTime: string;
}

export interface FirestoreFetchHarness {
  store: Map<string, StoredFirestoreDoc>;
  counts: {
    reads: number;
    writes: number;
    deletes: number;
  };
  identityToolkitCalls: Array<{ url: string; method: string; body: unknown }>;
  outboundExternalCalls: Array<{ url: string; method: string; body: unknown }>;
  getDoc: <T = Record<string, unknown>>(path: string) => T | null;
  setDoc: (path: string, data: Record<string, unknown>) => void;
  listCollection: <T = Record<string, unknown>>(collectionId: string) => Array<{ id: string; data: T }>;
  resetCounts: () => void;
  simulateFailure: (config: FirestoreFailureConfig | null) => void;
  registerPublicJwk: (jwk: JsonWebKey & { kid: string }) => void;
  restore: () => Promise<void>;
}

const DEFAULT_PROJECT_ID = 'yalla-center';
const REGISTERED_JWKS: Array<JsonWebKey & { kid: string }> = [];

function toBase64Url(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createTestKeyPair(kid = 'test-key-1'): Promise<TestRsaKeyPair> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify']
  );

  const exported = (await crypto.subtle.exportKey('jwk', keyPair.publicKey)) as JsonWebKey;
  const publicJwk: JsonWebKey & { kid: string; alg: string; use: string } = {
    ...exported,
    kid,
    alg: 'RS256',
    use: 'sig',
  };

  const existingIdx = REGISTERED_JWKS.findIndex((k) => k.kid === kid);
  if (existingIdx >= 0) {
    REGISTERED_JWKS[existingIdx] = publicJwk;
  } else {
    REGISTERED_JWKS.push(publicJwk);
  }

  return {
    privateKey: keyPair.privateKey,
    publicKey: keyPair.publicKey,
    publicJwk,
    kid,
  };
}

let cachedDefaultKeyPair: TestRsaKeyPair | null = null;

async function getDefaultKeyPair(): Promise<TestRsaKeyPair> {
  if (!cachedDefaultKeyPair) {
    cachedDefaultKeyPair = await createTestKeyPair('test-key-1');
  }
  return cachedDefaultKeyPair;
}

export async function signFirebaseIdToken(
  claims: FirebaseIdTokenClaims,
  keyPair?: TestRsaKeyPair
): Promise<string> {
  const kp = keyPair ?? (await getDefaultKeyPair());
  const nowSec = Math.floor(Date.now() / 1000);
  const sub = claims.sub ?? claims.uid ?? 'user-test-1';

  const payload: Record<string, unknown> = {
    aud: claims.aud ?? DEFAULT_PROJECT_ID,
    iss: claims.iss ?? `https://securetoken.google.com/${DEFAULT_PROJECT_ID}`,
    sub,
    user_id: sub,
    email: claims.email ?? `${sub}@almaher.edu.eg`,
    email_verified: claims.email_verified ?? true,
    iat: claims.iat ?? nowSec - 10,
    auth_time: claims.auth_time ?? nowSec - 10,
    exp: claims.exp ?? nowSec + 3600,
    ...claims,
  };

  const headerB64 = toBase64Url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: kp.kid })
  );
  const payloadB64 = toBase64Url(JSON.stringify(payload));
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    kp.privateKey,
    new TextEncoder().encode(`${headerB64}.${payloadB64}`)
  );
  return `${headerB64}.${payloadB64}.${toBase64Url(new Uint8Array(signature))}`;
}

export function encodeFirestoreValue(value: unknown): Record<string, unknown> {
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
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = encodeFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(value) };
}

export function decodeFirestoreValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return undefined;
  const v = value as Record<string, unknown>;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return Number(v.doubleValue);
  if ('timestampValue' in v) return v.timestampValue;
  if ('stringValue' in v) return v.stringValue;
  if ('arrayValue' in v) {
    const arr = v.arrayValue as { values?: unknown[] } | undefined;
    return (arr?.values ?? []).map((item) => decodeFirestoreValue(item));
  }
  if ('mapValue' in v) {
    const map = v.mapValue as { fields?: Record<string, unknown> } | undefined;
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(map?.fields ?? {})) {
      out[k] = decodeFirestoreValue(val);
    }
    return out;
  }
  return undefined;
}

export function encodeFirestoreFields(
  obj: Record<string, unknown>
): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFirestoreValue(v);
    }
  }
  return fields;
}

export function decodeFirestoreFields(
  fields: Record<string, unknown> | undefined
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(fields ?? {})) {
    out[k] = decodeFirestoreValue(v);
  }
  return out;
}

function getNestedField(data: Record<string, unknown>, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let cur: unknown = data;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') {
      return undefined;
    }
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || a === undefined || b === undefined) return false;
  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  return false;
}

function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'string' && typeof b === 'string') return a.localeCompare(b);
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return String(a ?? '').localeCompare(String(b ?? ''));
}

interface StructuredFilterNode {
  fieldFilter?: {
    field?: { fieldPath?: string };
    op?: string;
    value?: unknown;
  };
  compositeFilter?: {
    op?: string;
    filters?: StructuredFilterNode[];
  };
}

function matchesStructuredFilter(
  data: Record<string, unknown>,
  node: StructuredFilterNode | undefined
): boolean {
  if (!node) return true;

  if (node.compositeFilter) {
    const op = node.compositeFilter.op ?? 'AND';
    const filters = node.compositeFilter.filters ?? [];
    if (op === 'OR') {
      return filters.some((child) => matchesStructuredFilter(data, child));
    }
    return filters.every((child) => matchesStructuredFilter(data, child));
  }

  if (node.fieldFilter) {
    const fieldPath = node.fieldFilter.field?.fieldPath ?? '';
    const op = node.fieldFilter.op ?? 'EQUAL';
    const targetVal = decodeFirestoreValue(node.fieldFilter.value);
    const actualVal = getNestedField(data, fieldPath);

    switch (op) {
      case 'EQUAL':
        return valuesEqual(actualVal, targetVal);
      case 'NOT_EQUAL':
        return !valuesEqual(actualVal, targetVal);
      case 'IN': {
        const list = Array.isArray(targetVal) ? targetVal : [];
        return list.some((item) => valuesEqual(actualVal, item));
      }
      case 'NOT_IN': {
        const list = Array.isArray(targetVal) ? targetVal : [];
        return !list.some((item) => valuesEqual(actualVal, item));
      }
      case 'ARRAY_CONTAINS': {
        if (!Array.isArray(actualVal)) return false;
        return actualVal.some((item) => valuesEqual(item, targetVal));
      }
      case 'ARRAY_CONTAINS_ANY': {
        if (!Array.isArray(actualVal) || !Array.isArray(targetVal)) return false;
        return actualVal.some((item) => targetVal.some((t) => valuesEqual(item, t)));
      }
      case 'GREATER_THAN':
        return actualVal !== undefined && actualVal !== null && compareValues(actualVal, targetVal) > 0;
      case 'GREATER_THAN_OR_EQUAL':
        return actualVal !== undefined && actualVal !== null && compareValues(actualVal, targetVal) >= 0;
      case 'LESS_THAN':
        return actualVal !== undefined && actualVal !== null && compareValues(actualVal, targetVal) < 0;
      case 'LESS_THAN_OR_EQUAL':
        return actualVal !== undefined && actualVal !== null && compareValues(actualVal, targetVal) <= 0;
      default:
        return false;
    }
  }

  return true;
}

async function clearServerCachesSafe(): Promise<void> {
  try {
    const mod = await requireRepoModule<{ clearFirebaseServerCachesForTests?: () => void }>(
      'lib/firebase/server.ts'
    );
    mod.clearFirebaseServerCachesForTests?.();
  } catch {
    // Ignore if server module isn't available yet
  }
}

function parseJsonBodySafe(body: BodyInit | null | undefined): unknown {
  if (!body) return undefined;
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return String(body);
}

export async function installFirestoreFetchHarness(
  seed: Record<string, Record<string, unknown>> = {}
): Promise<FirestoreFetchHarness> {
  await clearServerCachesSafe();
  await getDefaultKeyPair();

  const store = new Map<string, StoredFirestoreDoc>();
  let clockCounter = 1;

  const nextTimestamp = (): string => {
    clockCounter += 1;
    const baseMs = Date.UTC(2026, 10, 26, 12, 0, 0) + clockCounter * 1000;
    return new Date(baseMs).toISOString();
  };

  const setDoc = (docPath: string, data: Record<string, unknown>) => {
    const clean = docPath.replace(/^\/+/, '');
    const ts = nextTimestamp();
    const prev = store.get(clean);
    const cloned = structuredClone(data);
    store.set(clean, {
      fields: encodeFirestoreFields(cloned),
      data: cloned,
      createTime: prev?.createTime ?? ts,
      updateTime: ts,
    });
  };

  for (const [docPath, data] of Object.entries(seed)) {
    setDoc(docPath, data);
  }

  const counts = { reads: 0, writes: 0, deletes: 0 };
  const identityToolkitCalls: Array<{ url: string; method: string; body: unknown }> = [];
  const outboundExternalCalls: Array<{ url: string; method: string; body: unknown }> = [];
  let failureConfig: FirestoreFailureConfig | null = null;
  const localJwks = [...REGISTERED_JWKS];

  const checkFailure = (target: 'read' | 'query' | 'commit'): Response | null => {
    if (!failureConfig) return null;
    if (failureConfig.target !== 'all' && failureConfig.target !== target) return null;
    const cfg = failureConfig;
    if (cfg.once) {
      failureConfig = null;
    }
    return new Response(
      JSON.stringify({
        error: {
          code: cfg.status ?? 503,
          status: cfg.code ?? 'UNAVAILABLE',
          message: cfg.message ?? `Simulated Firestore ${target} failure`,
        },
      }),
      { status: cfg.status ?? 503, headers: { 'Content-Type': 'application/json' } }
    );
  };

  const originalFetch = globalThis.fetch;

  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();

    // 1. Google Secure Token JWKS
    if (url.includes('securetoken@system.gserviceaccount.com')) {
      return new Response(JSON.stringify({ keys: localJwks }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'max-age=3600' },
      });
    }

    // 2. Identity Toolkit (email/password sign-in fallback detector)
    if (url.includes('identitytoolkit.googleapis.com')) {
      identityToolkitCalls.push({
        url,
        method,
        body: parseJsonBodySafe(init?.body),
      });
      return new Response(
        JSON.stringify({
          error: {
            code: 403,
            message: 'IDENTITY_TOOLKIT_SIGNIN_BLOCKED_BY_E2E_HARNESS',
          },
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3. Cloud Firestore REST v1 API
    const firestoreMatch = url.match(
      /^https:\/\/firestore\.googleapis\.com\/v1\/(projects\/[^/]+\/databases\/\(default\)\/documents)(.*)$/
    );
    if (firestoreMatch) {
      const docPrefix = firestoreMatch[1];
      const suffixWithQuery = firestoreMatch[2] ?? '';
      const suffix = suffixWithQuery.split('?')[0];

      // 3a. :commit
      if (suffix === ':commit' && method === 'POST') {
        const failed = checkFailure('commit');
        if (failed) return failed;

        const body = (parseJsonBodySafe(init?.body) ?? {}) as {
          writes?: Array<{
            update?: { name: string; fields?: Record<string, unknown> };
            delete?: string;
            currentDocument?: { exists?: boolean; updateTime?: string };
          }>;
        };
        const writes = body.writes ?? [];

        // Atomic precondition check before applying any write
        for (const w of writes) {
          const targetName = w.update?.name ?? w.delete ?? '';
          const cleanPath = targetName.split('/documents/')[1]?.replace(/^\/+/, '') ?? '';
          const current = store.get(cleanPath);

          if (w.currentDocument?.exists === false && current) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 409,
                  status: 'ALREADY_EXISTS',
                  message: `Document already exists: ${cleanPath}`,
                },
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (w.currentDocument?.exists === true && !current) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 409,
                  status: 'NOT_FOUND',
                  message: `Document does not exist: ${cleanPath}`,
                },
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
          }

          if (
            w.currentDocument?.updateTime &&
            current?.updateTime !== w.currentDocument.updateTime
          ) {
            return new Response(
              JSON.stringify({
                error: {
                  code: 409,
                  status: 'FAILED_PRECONDITION',
                  message: `Precondition updateTime mismatch at ${cleanPath}`,
                },
              }),
              { status: 409, headers: { 'Content-Type': 'application/json' } }
            );
          }
        }

        const writeResults: Array<{ updateTime: string }> = [];
        for (const w of writes) {
          if (w.update) {
            const cleanPath = w.update.name.split('/documents/')[1]?.replace(/^\/+/, '') ?? '';
            const ts = nextTimestamp();
            const prev = store.get(cleanPath);
            const fields = w.update.fields ?? {};
            store.set(cleanPath, {
              fields,
              data: decodeFirestoreFields(fields),
              createTime: prev?.createTime ?? ts,
              updateTime: ts,
            });
            counts.writes += 1;
            writeResults.push({ updateTime: ts });
          } else if (w.delete) {
            const cleanPath = w.delete.split('/documents/')[1]?.replace(/^\/+/, '') ?? '';
            store.delete(cleanPath);
            counts.deletes += 1;
            writeResults.push({ updateTime: nextTimestamp() });
          }
        }

        return new Response(JSON.stringify({ writeResults }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // 3b. :runQuery
      if (suffix === ':runQuery' && method === 'POST') {
        const failed = checkFailure('query');
        if (failed) return failed;
        counts.reads += 1;

        const body = (parseJsonBodySafe(init?.body) ?? {}) as {
          structuredQuery?: {
            from?: Array<{ collectionId: string }>;
            where?: StructuredFilterNode;
            orderBy?: Array<{ field?: { fieldPath?: string }; direction?: 'ASCENDING' | 'DESCENDING' }>;
            limit?: number;
          };
        };

        const collectionId = body.structuredQuery?.from?.[0]?.collectionId ?? '';
        const prefix = `${collectionId}/`;
        let matched = Array.from(store.entries())
          .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
          .filter(([, doc]) => matchesStructuredFilter(doc.data, body.structuredQuery?.where));

        const orderBy = body.structuredQuery?.orderBy;
        if (orderBy && orderBy.length > 0) {
          matched = matched.sort(([, docA], [, docB]) => {
            for (const clause of orderBy) {
              const fp = clause.field?.fieldPath ?? '';
              const cmp = compareValues(getNestedField(docA.data, fp), getNestedField(docB.data, fp));
              if (cmp !== 0) {
                return clause.direction === 'DESCENDING' ? -cmp : cmp;
              }
            }
            return 0;
          });
        }

        if (typeof body.structuredQuery?.limit === 'number' && body.structuredQuery.limit >= 0) {
          matched = matched.slice(0, body.structuredQuery.limit);
        }

        const rows = matched.map(([path, doc]) => ({
          document: {
            name: `${docPrefix}/${path}`,
            fields: doc.fields,
            createTime: doc.createTime,
            updateTime: doc.updateTime,
          },
          readTime: nextTimestamp(),
        }));

        return new Response(
          JSON.stringify(rows.length > 0 ? rows : [{ readTime: nextTimestamp() }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // 3c. Single document or collection GET/PATCH/POST/DELETE
      const cleanResourcePath = suffix.replace(/^\/+/, '');
      const segments = cleanResourcePath.split('/').filter(Boolean);
      const isCollectionPath = segments.length % 2 === 1;

      if (method === 'GET') {
        const failed = checkFailure('read');
        if (failed) return failed;
        counts.reads += 1;

        if (isCollectionPath) {
          const prefix = `${cleanResourcePath}/`;
          const documents = Array.from(store.entries())
            .filter(([path]) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
            .map(([path, doc]) => ({
              name: `${docPrefix}/${path}`,
              fields: doc.fields,
              createTime: doc.createTime,
              updateTime: doc.updateTime,
            }));
          return new Response(JSON.stringify({ documents }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        const found = store.get(cleanResourcePath);
        if (!found) {
          return new Response(
            JSON.stringify({ error: { code: 404, status: 'NOT_FOUND', message: 'not found' } }),
            { status: 404, headers: { 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({
            name: `${docPrefix}/${cleanResourcePath}`,
            fields: found.fields,
            createTime: found.createTime,
            updateTime: found.updateTime,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'PATCH' || method === 'POST') {
        const failed = checkFailure('commit');
        if (failed) return failed;
        const body = (parseJsonBodySafe(init?.body) ?? {}) as { fields?: Record<string, unknown> };
        const fields = body.fields ?? {};
        const ts = nextTimestamp();
        const prev = store.get(cleanResourcePath);
        store.set(cleanResourcePath, {
          fields,
          data: decodeFirestoreFields(fields),
          createTime: prev?.createTime ?? ts,
          updateTime: ts,
        });
        counts.writes += 1;
        return new Response(
          JSON.stringify({
            name: `${docPrefix}/${cleanResourcePath}`,
            fields,
            createTime: prev?.createTime ?? ts,
            updateTime: ts,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      if (method === 'DELETE') {
        const failed = checkFailure('commit');
        if (failed) return failed;
        store.delete(cleanResourcePath);
        counts.deletes += 1;
        return new Response(JSON.stringify({}), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // 4. Any other external URL (records outbound SMS/WhatsApp/Email/etc. attempts and blocks)
    outboundExternalCalls.push({
      url,
      method,
      body: parseJsonBodySafe(init?.body),
    });
    return new Response(
      JSON.stringify({ error: 'OUTBOUND_EXTERNAL_CALL_BLOCKED_BY_E2E_HARNESS', url }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }) as typeof fetch;

  return {
    store,
    counts,
    identityToolkitCalls,
    outboundExternalCalls,
    getDoc<T = Record<string, unknown>>(docPath: string): T | null {
      const found = store.get(docPath.replace(/^\/+/, ''));
      return found ? (structuredClone(found.data) as T) : null;
    },
    setDoc,
    listCollection<T = Record<string, unknown>>(collectionId: string): Array<{ id: string; data: T }> {
      const prefix = `${collectionId}/`;
      return Array.from(store.entries())
        .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
        .map(([p, doc]) => ({
          id: p.slice(prefix.length),
          data: structuredClone(doc.data) as T,
        }));
    },
    resetCounts() {
      counts.reads = 0;
      counts.writes = 0;
      counts.deletes = 0;
    },
    simulateFailure(config: FirestoreFailureConfig | null) {
      failureConfig = config;
    },
    registerPublicJwk(jwk: JsonWebKey & { kid: string }) {
      const idx = localJwks.findIndex((k) => k.kid === jwk.kid);
      if (idx >= 0) {
        localJwks[idx] = jwk;
      } else {
        localJwks.push(jwk);
      }
    },
    async restore() {
      globalThis.fetch = originalFetch;
      await clearServerCachesSafe();
    },
  };
}
