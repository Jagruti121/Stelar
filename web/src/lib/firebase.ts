/**
 * STELLAR — Firebase initialization
 *
 * Single module that initialises Firebase and exports every service.
 * Import from here everywhere — never call initializeApp() elsewhere.
 */

import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  connectFirestoreEmulator,
  memoryLocalCache,
  type Firestore,
} from 'firebase/firestore';
import {
  getStorage,
  connectStorageEmulator,
  type FirebaseStorage,
} from 'firebase/storage';
import {
  getDatabase,
  connectDatabaseEmulator,
  type Database,
} from 'firebase/database';
import { getFunctions, connectFunctionsEmulator, type Functions } from 'firebase/functions';

// ── Firebase project config ───────────────────────────────────────────────────
// All values come from environment variables — never hard-code here.

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID as string,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL as string,
};

// ── Singleton initialisation ──────────────────────────────────────────────────

const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth = getAuth(app);
export const db: Firestore = (() => {
  try {
    return initializeFirestore(app, {
      localCache: memoryLocalCache(),
    });
  } catch {
    return getFirestore(app);
  }
})();
export const storage: FirebaseStorage = getStorage(app);
export const rtdb: Database = getDatabase(app);
export const functions: Functions = getFunctions(app, 'us-central1');

// ── Emulator connections ──────────────────────────────────────────────────────
// Connect to the local Firebase Emulator Suite when VITE_USE_EMULATORS=true.

if (import.meta.env.VITE_USE_EMULATORS === 'true') {
  // Guard against double-connection in React Strict Mode
  if (!(auth as { _config?: { emulator?: unknown } })._config?.emulator) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
    connectStorageEmulator(storage, '127.0.0.1', 9199);
    connectDatabaseEmulator(rtdb, '127.0.0.1', 9000);
    connectFunctionsEmulator(functions, '127.0.0.1', 5001);
  }
}

export default app;
