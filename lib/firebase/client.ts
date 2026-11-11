'use client';

import { useCallback, useEffect, useState } from 'react';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  onIdTokenChanged,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  getFirestore,
  onSnapshot,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { LessonExamRecord, LessonGradeRecord } from '@/lib/attendance/lesson-scores';

export interface FirebaseWebConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function getFirebaseWebConfig(): FirebaseWebConfig | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim() || '';
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim() || '';
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'yalla-center';
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID?.trim() || '';

  if (!apiKey || !authDomain || !projectId || !appId) {
    return null;
  }

  return {
    apiKey,
    authDomain,
    projectId,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET?.trim() || undefined,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID?.trim() || undefined,
    appId,
  };
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
  db: Firestore;
} | null {
  if (typeof window === 'undefined') return null;
  const config = getFirebaseWebConfig();
  if (!config) return null;

  try {
    const app = cachedApp ?? (getApps().length > 0 ? getApp() : initializeApp(config));
    const auth = cachedAuth ?? getAuth(app);
    const db = cachedDb ?? getFirestore(app);
    cachedApp = app;
    cachedAuth = auth;
    cachedDb = db;
    return { app, auth, db };
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

export async function signOutFirebaseStaff(): Promise<void> {
  const services = getFirebaseClientServices();
  if (!services) return;
  await signOut(services.auth);
}

export async function getFreshFirebaseIdToken(): Promise<string | null> {
  const services = getFirebaseClientServices();
  const currentUser = services?.auth.currentUser;
  if (!currentUser) return null;
  return currentUser.getIdToken();
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

    const unsubscribe = onIdTokenChanged(services.auth, async (nextUser) => {
      if (!nextUser) {
        setUser(null);
        setIdToken(null);
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
  const services = getFirebaseClientServices();
  if (!services || !services.auth.currentUser) {
    return () => undefined;
  }

  const { db } = services;
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

  const unsubExams = onSnapshot(
    examsQuery,
    (snapshot) => {
      const exams = snapshot.docs.map((doc) => doc.data() as LessonExamRecord);
      params.onExams(exams);
    },
    (err) => {
      params.onError?.(err.message || 'تعذّر مزامنة اختبارات الحصة من Firestore');
    }
  );

  const unsubGrades = onSnapshot(
    gradesQuery,
    (snapshot) => {
      const grades = snapshot.docs.map((doc) => doc.data() as LessonGradeRecord);
      params.onGrades(grades);
    },
    (err) => {
      params.onError?.(err.message || 'تعذّر مزامنة الدرجات اللحظية من Firestore');
    }
  );

  return () => {
    unsubExams();
    unsubGrades();
  };
}
