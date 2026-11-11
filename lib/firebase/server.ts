import type { UserRole } from '@/lib/dal/types';
import {
  FirestoreHttpError,
  FirestoreRestClient,
  type FirestoreWriteOperation,
  type StructuredFilter,
} from './firestore-rest';

const GOOGLE_SECURE_TOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  rawClaims: Record<string, unknown>;
}

export interface StaffMembershipRecord {
  uid: string;
  email?: string;
  displayName?: string;
  tenantId: string;
  role: UserRole;
  branchIds?: string[];
  teacherId?: string;
  isActive: boolean;
}

export interface VerifyTokenOptions {
  projectId?: string;
  nowSec?: number;
  fetchImpl?: typeof fetch;
  jwksOverride?: JsonWebKeyWithKid[];
}

export interface JsonWebKeyWithKid extends JsonWebKey {
  kid?: string;
}

interface JwksCacheEntry {
  keys: JsonWebKeyWithKid[];
  expiresAtMs: number;
}

let jwksCache: JwksCacheEntry | null = null;
let serviceAccountTokenCache: { token: string; expiresAtMs: number; cacheKey: string } | null =
  null;

export function clearFirebaseServerCachesForTests(): void {
  jwksCache = null;
  serviceAccountTokenCache = null;
}

export function getFirebaseProjectId(): string {
  return (
    process.env.FIREBASE_PROJECT_ID?.trim() ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() ||
    'yalla-center'
  );
}

function base64UrlToUint8Array(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeBase64UrlJson<T>(segment: string): T {
  const bytes = base64UrlToUint8Array(segment);
  const jsonText = new TextDecoder().decode(bytes);
  return JSON.parse(jsonText) as T;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function stringToBase64Url(str: string): string {
  return uint8ArrayToBase64Url(new TextEncoder().encode(str));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const base64Body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function parseMaxAgeSeconds(cacheControl: string | null): number {
  if (!cacheControl) return 3600;
  const match = cacheControl.match(/max-age=(\d+)/i);
  return match ? Math.max(60, Number(match[1])) : 3600;
}

async function fetchGoogleJwks(
  fetchImpl: typeof fetch,
  forceRefresh = false
): Promise<JsonWebKeyWithKid[]> {
  const nowMs = Date.now();
  if (!forceRefresh && jwksCache && jwksCache.expiresAtMs > nowMs) {
    return jwksCache.keys;
  }

  const res = await fetchImpl(GOOGLE_SECURE_TOKEN_JWKS_URL, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`فشل تحميل مفاتيح التحقق العامة من Firebase (${res.status})`);
  }
  const body = (await res.json()) as { keys?: JsonWebKeyWithKid[] };
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error('استجابة مفاتيح التحقق من Firebase غير صالحة');
  }
  const maxAgeSec = parseMaxAgeSeconds(res.headers.get('cache-control'));
  jwksCache = {
    keys: body.keys,
    expiresAtMs: nowMs + maxAgeSec * 1000,
  };
  return body.keys;
}

export class FirebaseAuthError extends Error {
  status: 401 | 403 | 503;

  constructor(status: 401 | 403 | 503, message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
    this.status = status;
  }
}

export function extractBearerToken(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) return null;
  const match = authorizationHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

export async function verifyFirebaseIdToken(
  idToken: string,
  options: VerifyTokenOptions = {}
): Promise<VerifiedFirebaseToken> {
  if (!idToken || typeof idToken !== 'string') {
    throw new FirebaseAuthError(401, 'يلزم تقديم رمز جلسة Firebase صالح');
  }

  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new FirebaseAuthError(401, 'صيغة رمز جلسة Firebase غير صالحة');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string; kid?: string };
  let payload: Record<string, unknown>;
  try {
    header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
    payload = decodeBase64UrlJson<Record<string, unknown>>(payloadB64);
  } catch {
    throw new FirebaseAuthError(401, 'تعذّر فك ترميز رمز جلسة Firebase');
  }

  if (header.alg !== 'RS256' || !header.kid) {
    throw new FirebaseAuthError(401, 'خوارزمية توقيع رمز Firebase غير معتمدة');
  }

  const projectId = options.projectId || getFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = options.nowSec ?? Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new FirebaseAuthError(401, 'رمز الجلسة غير صادر لمشروع يلا سنتر المطلوب');
  }
  if (payload.iss !== expectedIssuer) {
    throw new FirebaseAuthError(401, 'مصدر رمز جلسة Firebase غير موثوق');
  }
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 128) {
    throw new FirebaseAuthError(401, 'معرّف مستخدم Firebase مفقود');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec) {
    throw new FirebaseAuthError(401, 'انتهت صلاحية جلسة Firebase؛ يرجى تسجيل الدخول مجدداً');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new FirebaseAuthError(401, 'توقيت إصدار رمز الجلسة غير صالح');
  }
  if (typeof payload.auth_time === 'number' && payload.auth_time > nowSec + 300) {
    throw new FirebaseAuthError(401, 'توقيت مصادقة Firebase غير صالح');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let jwk: JsonWebKeyWithKid | undefined;
  if (options.jwksOverride) {
    jwk = options.jwksOverride.find((item) => item.kid === header.kid);
  } else {
    let keys = await fetchGoogleJwks(fetchImpl, false);
    jwk = keys.find((item) => item.kid === header.kid);
    if (!jwk) {
      keys = await fetchGoogleJwks(fetchImpl, true);
      jwk = keys.find((item) => item.kid === header.kid);
    }
  }

  if (!jwk) {
    throw new FirebaseAuthError(401, 'مفتاح التحقق لرمز Firebase غير معروف أو منتهي الصلاحية');
  }

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signatureBytes = base64UrlToUint8Array(signatureB64);
  const signatureCopy = new Uint8Array(signatureBytes.length);
  signatureCopy.set(signatureBytes);

  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    signatureCopy.buffer,
    signingInput
  );

  if (!valid) {
    throw new FirebaseAuthError(401, 'توقيع جلسة Firebase غير صحيح');
  }

  return {
    uid: payload.sub,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    emailVerified: payload.email_verified === true,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    rawClaims: payload,
  };
}

export async function getServiceAccountAccessToken(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim() || '';
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim() || '';
  if (!clientEmail || !privateKey) {
    return null;
  }

  const cacheKey = `${clientEmail}:${privateKey.length}`;
  const nowMs = Date.now();
  if (
    serviceAccountTokenCache &&
    serviceAccountTokenCache.cacheKey === cacheKey &&
    serviceAccountTokenCache.expiresAtMs > nowMs + 60_000
  ) {
    return serviceAccountTokenCache.token;
  }

  const nowSec = Math.floor(nowMs / 1000);
  const headerB64 = stringToBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimB64 = stringToBase64Url(
    JSON.stringify({
      iss: clientEmail,
      sub: clientEmail,
      aud: GOOGLE_OAUTH_TOKEN_URL,
      scope: 'https://www.googleapis.com/auth/datastore',
      iat: nowSec,
      exp: nowSec + 3600,
    })
  );

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKey),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signingBytes = new TextEncoder().encode(`${headerB64}.${claimB64}`);
  const signatureBuffer = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, signingBytes);
  const jwt = `${headerB64}.${claimB64}.${uint8ArrayToBase64Url(new Uint8Array(signatureBuffer))}`;

  const tokenRes = await fetchImpl(GOOGLE_OAUTH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`فشل الحصول على تصريح الوصول لخدمة Firestore (${tokenRes.status})`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenData.access_token) {
    throw new Error('استجابة Google OAuth لم تتضمن access_token');
  }

  const expiresInSec = Number(tokenData.expires_in ?? 3600);
  serviceAccountTokenCache = {
    token: tokenData.access_token,
    expiresAtMs: nowMs + expiresInSec * 1000,
    cacheKey,
  };
  return tokenData.access_token;
}

export interface ILessonScoreStore {
  getDocument<T = Record<string, unknown>>(
    documentPath: string
  ): Promise<{ exists: false } | { exists: true; data: T; updateTime?: string }>;
  queryCollection<T = Record<string, unknown>>(
    collectionId: string,
    filters: StructuredFilter[]
  ): Promise<Array<{ data: T; updateTime?: string; id: string }>>;
  commit(writes: FirestoreWriteOperation[]): Promise<void>;
}

export async function createServerFirestoreStore(params: {
  callerIdToken: string;
  fetchImpl?: typeof fetch;
}): Promise<ILessonScoreStore> {
  const projectId = getFirebaseProjectId();
  const fetchImpl = params.fetchImpl ?? fetch;
  const adminToken = await getServiceAccountAccessToken(fetchImpl);
  const accessToken = adminToken || params.callerIdToken;

  if (!projectId || !accessToken) {
    throw new FirebaseAuthError(
      503,
      'إعدادات Cloud Firestore على الخادم غير مكتملة لمشروع yalla-center'
    );
  }

  return new FirestoreRestClient({
    projectId,
    accessToken,
    fetchImpl,
  });
}

export { FirestoreHttpError };
