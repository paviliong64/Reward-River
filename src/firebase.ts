/**
 * Reward River - Firebase Integration
 * Provides real Firebase Authentication and Firestore persistence
 */

import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocFromServer,
  collection,
  query,
  where,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { User } from './types';

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Initialize Firestore with specific database ID from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Initialize Firebase Auth
export const auth = getAuth(app);

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Firestore Error Handler Types
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Validate Firestore Connection on initial boot as required by skill
 */
export async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
// Execute connection test
testConnection();

/**
 * Create or sync user profile in Firestore
 */
export async function syncUserProfile(
  fbUser: FirebaseUser,
  customDisplayName?: string
): Promise<User> {
  const userRef = doc(db, 'users', fbUser.uid);
  const now = new Date().toISOString();

  let existingData: Record<string, unknown> | null = null;
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      existingData = snap.data();
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
  }

  const role = (fbUser.email === 'paviliong64@gmail.com') ? 'admin' : (existingData?.role as 'user' | 'admin' || 'user');
  const displayName = customDisplayName || fbUser.displayName || (existingData?.displayName as string) || fbUser.email?.split('@')[0] || 'Member';
  const externalOpaqueId = (existingData?.externalOpaqueId as string) || `rr_cpx_${fbUser.uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;

  const profileData: User = {
    id: fbUser.uid,
    email: fbUser.email || '',
    displayName,
    emailVerified: fbUser.emailVerified,
    role,
    externalOpaqueId,
    createdAt: (existingData?.createdAt as string) || now,
    updatedAt: now
  };

  try {
    if (!existingData) {
      await setDoc(userRef, {
        userId: fbUser.uid,
        email: profileData.email,
        displayName: profileData.displayName,
        emailVerified: profileData.emailVerified,
        role: profileData.role,
        externalOpaqueId: profileData.externalOpaqueId,
        createdAt: profileData.createdAt,
        updatedAt: profileData.updatedAt
      });
    } else {
      await updateDoc(userRef, {
        displayName: profileData.displayName,
        emailVerified: profileData.emailVerified,
        updatedAt: now
      });
    }
  } catch (err) {
    handleFirestoreError(err, existingData ? OperationType.UPDATE : OperationType.CREATE, `users/${fbUser.uid}`);
  }

  return profileData;
}

/**
 * Real Firebase Email/Password Sign Up
 */
export async function registerWithFirebase(
  email: string,
  pass: string,
  displayName?: string
): Promise<{ user: User; idToken: string }> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  if (displayName?.trim()) {
    try {
      await updateProfile(cred.user, { displayName: displayName.trim() });
    } catch {
      // Non-fatal
    }
  }

  // Send real email verification
  try {
    await sendEmailVerification(cred.user);
  } catch (e) {
    console.warn('Could not dispatch verification email:', e);
  }

  const user = await syncUserProfile(cred.user, displayName);
  const idToken = await cred.user.getIdToken();

  return { user, idToken };
}

/**
 * Real Firebase Email/Password Sign In
 */
export async function signInWithFirebase(
  email: string,
  pass: string
): Promise<{ user: User; idToken: string }> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  const user = await syncUserProfile(cred.user);
  const idToken = await cred.user.getIdToken();
  return { user, idToken };
}

/**
 * Real Firebase Google Sign-In Popup
 */
export async function signInWithGooglePopup(): Promise<{ user: User; idToken: string }> {
  const cred = await signInWithPopup(auth, googleProvider);
  const user = await syncUserProfile(cred.user);
  const idToken = await cred.user.getIdToken();
  return { user, idToken };
}

/**
 * Send password reset email
 */
export async function resetFirebasePassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

/**
 * Resend email verification
 */
export async function resendVerification(): Promise<void> {
  if (auth.currentUser) {
    await sendEmailVerification(auth.currentUser);
  } else {
    throw new Error('No signed-in user found to verify.');
  }
}

/**
 * Sign out
 */
export async function logOutFromFirebase(): Promise<void> {
  await signOut(auth);
}
