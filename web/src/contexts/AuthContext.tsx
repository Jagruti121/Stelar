/**
 * STELLAR — Authentication Context
 *
 * Provides the current Firebase Auth user, their resolved custom claims
 * (roles), and convenient helpers. Wrap the app in <AuthProvider>.
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import type { StellarClaims, UserRole } from '@/types/firestore';

// ── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  /** The raw Firebase Auth user (null when not signed in). */
  user: User | null;
  /** Resolved STELLAR custom claims (null until claims are fetched). */
  claims: StellarClaims | null;
  /** True while the auth state is being determined on app load. */
  loading: boolean;
  /** True when the user is authenticated AND claims are available. */
  isAuthenticated: boolean;
  /** Convenience role checkers. */
  hasRole: (role: UserRole) => boolean;
  isStudent: boolean;
  isFaculty: boolean;
  isHOD: boolean;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthState | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<StellarClaims | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety fallback: ensure loading never hangs if Firebase Auth has latency
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      clearTimeout(safetyTimer);
      if (firebaseUser) {
        try {
          // Force-refresh to get the latest custom claims.
          const idTokenResult = await firebaseUser.getIdTokenResult(true);
          const rawClaims = idTokenResult.claims as Record<string, unknown>;
          let roles: UserRole[] = (rawClaims['roles'] as UserRole[]) ?? [];
          let studentId = rawClaims['studentId'] as string | undefined;
          let deptId = rawClaims['deptId'] as string | undefined;
          let division = rawClaims['division'] as string | undefined;

          // If custom claims are empty in token, sync them via Cloud Function
          if (roles.length === 0) {
            try {
              const { httpsCallable } = await import('firebase/functions');
              const { functions } = await import('@/lib/firebase');
              const syncCall = httpsCallable(functions, 'syncUserClaims');
              const res = await syncCall();
              const syncData = res.data as any;
              if (syncData?.roles) {
                roles = syncData.roles;
                deptId = syncData.deptId || deptId;
                studentId = syncData.studentId || studentId;
                division = syncData.division || division;
                // Force-refresh token to get newly minted claims into current session
                await firebaseUser.getIdToken(true);
              }
            } catch (syncErr) {
              console.warn('syncUserClaims call failed, trying direct Firestore fallback:', syncErr);
            }

            if (roles.length === 0) {
              try {
                const { doc, getDoc } = await import('firebase/firestore');
                const { db } = await import('@/lib/firebase');

                // Check staff collection
                const staffSnap = await getDoc(doc(db, 'staff', firebaseUser.uid));
                if (staffSnap.exists()) {
                  const data = staffSnap.data();
                  roles = (data.roles as UserRole[]) || ['FACULTY'];
                  deptId = data.deptId;
                } else {
                  // Check students collection
                  const studentSnap = await getDoc(doc(db, 'students', firebaseUser.uid));
                  if (studentSnap.exists()) {
                    const data = studentSnap.data();
                    roles = ['STUDENT'];
                    studentId = data.id || firebaseUser.uid;
                    deptId = data.deptId;
                  }
                }
              } catch (fsErr) {
                console.warn('Firestore claims lookup skipped/failed:', fsErr);
              }
            }

            // Fallback to local cached registration role
            if (roles.length === 0) {
              const cached = localStorage.getItem('stellar_local_roles');
              if (cached) {
                try {
                  const parsed = JSON.parse(cached);
                  if (parsed.roles && parsed.roles.length > 0) {
                    roles = parsed.roles;
                    deptId = parsed.deptId || deptId;
                  }
                } catch {}
              }
            }

            // Safe default if still empty: allow staff entry
            if (roles.length === 0) {
              roles = ['FACULTY'];
            }
          }

          // Ensure HOD always implies FACULTY role
          if (roles.includes('HOD') && !roles.includes('FACULTY')) {
            roles = [...roles, 'FACULTY'];
          }

          const resolvedClaims: StellarClaims = {
            roles,
            studentId,
            deptId,
            division,
          };
          setUser(firebaseUser);
          setClaims(resolvedClaims);
        } catch {
          // If token fetch fails, still set the user with default roles
          setUser(firebaseUser);
          setClaims({ roles: ['FACULTY'] });
        }
      } else {
        setUser(null);
        setClaims(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const hasRole = (role: UserRole): boolean =>
    claims?.roles.includes(role) ?? false;

  const value: AuthState = {
    user,
    claims,
    loading,
    isAuthenticated: user !== null && claims !== null,
    hasRole,
    isStudent: hasRole('STUDENT'),
    isFaculty: hasRole('FACULTY') || hasRole('HOD'),
    isHOD: hasRole('HOD'),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth — returns the current auth state.
 * Must be used inside <AuthProvider>.
 */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
