'use client';

import { useCallback, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { LessonExamRecord, LessonGradeRecord } from '@/lib/attendance/lesson-scores';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
  vapidKey?: string;
}

export const DEFAULT_FIREBASE_WEB_CONFIG: FirebaseWebConfig = {
  apiKey: 'AIzaSyCcKNXipMYZlwaZRYFKYqEFZnAxo1lwsB4',
  authDomain: 'yalla-center.firebaseapp.com',
  projectId: 'yalla-center',
  storageBucket: 'yalla-center.firebasestorage.app',
  messagingSenderId: '876735697299',
  appId: '1:876735697299:web:31eff284bfe9d6c8771866',
  measurementId: 'G-2VCJL9XHT3',
  vapidKey: 'BMWN50P7wQrPxs_lmdMCchy0hbpupsLtyG2wPaljzrMyJz-BT5ORotoR99nLqOgMUdBXkT8nF1d9k-7QtVGEmVM',
};

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  if (process.env.NODE_ENV === 'test' && !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    return null;
  }

  let stored: Partial<FirebaseWebConfig> = {};
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('yc-firebase-web-config');
      if (raw) stored = JSON.parse(raw);
    } catch {}
  }

  const rawEnvApiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (rawEnvApiKey === '') {
    return null;
  }

  const apiKey = (
    rawEnvApiKey ||
    stored.apiKey ||
    DEFAULT_FIREBASE_WEB_CONFIG.apiKey
  ).trim();
  const authDomain = (
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    stored.authDomain ||
    DEFAULT_FIREBASE_WEB_CONFIG.authDomain
  ).trim();
  const projectId = (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    stored.projectId ||
    DEFAULT_FIREBASE_WEB_CONFIG.projectId
  ).trim();
  const appId = (
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ||
    stored.appId ||
    DEFAULT_FIREBASE_WEB_CONFIG.appId
  ).trim();

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: (
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      stored.storageBucket ||
      DEFAULT_FIREBASE_WEB_CONFIG.storageBucket
    )?.trim(),
    messagingSenderId: (
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ||
      stored.messagingSenderId ||
      DEFAULT_FIREBASE_WEB_CONFIG.messagingSenderId
    )?.trim(),
    appId,
    measurementId: (
      process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ||
      DEFAULT_FIREBASE_WEB_CONFIG.measurementId
    )?.trim(),
    vapidKey: (
      process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
      DEFAULT_FIREBASE_WEB_CONFIG.vapidKey
    )?.trim(),
  };
}

export function saveFirebaseWebConfig(config: { apiKey: string; appId: string; authDomain?: string; projectId?: string }) {
  if (typeof window === 'undefined') return;
  const current = {
    apiKey: config.apiKey.trim(),
    appId: config.appId.trim(),
    authDomain: (config.authDomain || 'yalla-center.firebaseapp.com').trim(),
    projectId: (config.projectId || 'yalla-center').trim(),
  };
  localStorage.setItem('yc-firebase-web-config', JSON.stringify(current));
  cachedApp = null;
  cachedAuth = null;
  cachedDb = null;
}

export function hasFirebaseWebConfig(): boolean {
  return getFirebaseWebConfig() !== null;
}

let cachedApp: FirebaseApp | null = null;
let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

export function getFirebaseClientServices(): {
  app: FirebaseApp;
  auth: Auth;
  db?: Firestore;
} | null {
  if (typeof window === 'undefined') return null;
  const config = getFirebaseWebConfig();
  if (!config) return null;

  try {
    const app = cachedApp ?? (getApps().length > 0 ? getApp() : initializeApp(config));
    const auth = cachedAuth ?? getAuth(app);
    cachedApp = app;
    cachedAuth = auth;
    return { app, auth, db: cachedDb ?? undefined };
  } catch {
    return null;
  }
}

export async function signInFirebaseStaff(email: string, password: string): Promise<{
  user: FirebaseUser;
  idToken: string;
}> {
  const services = getFirebaseClientServices();
  if (!services) {
    throw new Error('إعدادات Firebase Web غير مكتملة في البيئة الحالية');
  }
  const credential = await signInWithEmailAndPassword(services.auth, email.trim(), password);
  const idToken = await credential.user.getIdToken(true);
  return { user: credential.user, idToken };
}

export async function signInFirebaseGoogle(): Promise<void> {
  const services = getFirebaseClientServices();
  if (!services) throw new Error('إعدادات Firebase Web غير مكتملة');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithPopup(services.auth, provider);
}

export async function signOutFirebaseStaff(): Promise<void> {
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.removeItem('yc_id_token');
      document.cookie = 'yc_token=; path=/; max-age=0; SameSite=Lax';
    } catch {}
  }
  const services = getFirebaseClientServices();
  if (!services) return;
  await signOut(services.auth);
}

export async function sendFirebasePasswordReset(email: string): Promise<void> {
  const services = getFirebaseClientServices();
  if (!services) {
    throw new Error('خدمة المصادقة السحابية غير متوفرة');
  }
  await sendPasswordResetEmail(services.auth, email.trim());
}

export function getStoredFallbackToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const sessionToken = sessionStorage.getItem('yc_id_token');
    if (sessionToken) return sessionToken.trim();
    const cookieMatch = document.cookie.match(/(?:^|;\s*)yc_token=([^;]+)/);
    if (cookieMatch && cookieMatch[1]) return decodeURIComponent(cookieMatch[1]).trim();
  } catch {}
  return null;
}

export async function getFreshFirebaseIdToken(): Promise<string | null> {
  const services = getFirebaseClientServices();
  const currentUser = services?.auth.currentUser;
  if (currentUser) {
    return currentUser.getIdToken();
  }
  return getStoredFallbackToken();
}

export interface FirebaseAuthSessionState {
  configured: boolean;
  loading: boolean;
  user: FirebaseUser | null;
  idToken: string | null;
  error: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

export function useFirebaseAuthSession(): FirebaseAuthSessionState {
  const configured = hasFirebaseWebConfig();
  const [loading, setLoading] = useState<boolean>(configured);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const services = getFirebaseClientServices();
    if (!services) {
      setLoading(false);
      setUser(null);
      setIdToken(null);
      return;
    }

    const fallbackToken = getStoredFallbackToken();
    if (fallbackToken) {
      setIdToken((prev) => prev || fallbackToken);
    }

    const unsubscribe = onIdTokenChanged(services.auth, async (nextUser) => {
      if (!nextUser) {
        const stored = getStoredFallbackToken();
        setUser(null);
        setIdToken(stored);
        setLoading(false);
        return;
      }
      try {
        const token = await nextUser.getIdToken();
        setUser(nextUser);
        setIdToken(token);
        setError(null);
      } catch {
        setError('تعذّر التحقق من جلسة Firebase الحالية');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setLoading(true);
    try {
      const result = await signInFirebaseStaff(email, password);
      setUser(result.user);
      setIdToken(result.idToken);
    } catch (err: unknown) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : 'فشل تسجيل الدخول بحساب Firebase';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    await signOutFirebaseStaff();
    setUser(null);
    setIdToken(null);
  }, []);

  return {
    configured,
    loading,
    user,
    idToken,
    error,
    signIn,
    signOut: signOutUser,
  };
}

export function subscribeSessionLessonScores(params: {
  tenantId: string;
  sessionId: string;
  onExams: (exams: LessonExamRecord[]) => void;
  onGrades: (grades: LessonGradeRecord[]) => void;
  onError?: (message: string) => void;
}): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const services = getFirebaseClientServices();
  if (!services || !services.auth.currentUser) {
    return () => undefined;
  }

  let unsubExams: (() => void) | undefined;
  let unsubGrades: (() => void) | undefined;
  let active = true;

  void (async () => {
    try {
      const { collection, getFirestore, onSnapshot, query, where } = await import('firebase/firestore');
      if (!active) return;
      const db = cachedDb ?? getFirestore(services.app);
      cachedDb = db;
      const examsQuery = query(
        collection(db, 'lesson_exams'),
        where('tenantId', '==', params.tenantId),
        where('sessionId', '==', params.sessionId)
      );
      const gradesQuery = query(
        collection(db, 'lesson_grades'),
        where('tenantId', '==', params.tenantId),
        where('sessionId', '==', params.sessionId)
      );

      unsubExams = onSnapshot(
        examsQuery,
        (snapshot) => {
          if (!active) return;
          const exams = snapshot.docs.map((doc) => doc.data() as LessonExamRecord);
          params.onExams(exams);
        },
        (err) => {
          if (!active) return;
          params.onError?.(err.message || 'تعذّر مزامنة اختبارات الحصة من Firestore');
        }
      );

      unsubGrades = onSnapshot(
        gradesQuery,
        (snapshot) => {
          if (!active) return;
          const grades = snapshot.docs.map((doc) => doc.data() as LessonGradeRecord);
          params.onGrades(grades);
        },
        (err) => {
          if (!active) return;
          params.onError?.(err.message || 'تعذّر مزامنة الدرجات اللحظية من Firestore');
        }
      );
    } catch (err) {
      if (!active) return;
      params.onError?.(err instanceof Error ? err.message : 'تعذّر الاتصال بـ Firestore');
    }
  })();

  return () => {
    active = false;
    unsubExams?.();
    unsubGrades?.();
  };
}
