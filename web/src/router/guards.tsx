/**
 * STELLAR — Route Guards
 *
 * RequireAuth: redirects to /login if not authenticated.
 * RequireRole: redirects to /unauthorized if user lacks the required role.
 * RedirectIfAuth: redirects to /app/dashboard if already authenticated.
 */


import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/shared/Skeleton';
import type { UserRole } from '@/types/firestore';

// ── RequireAuth ───────────────────────────────────────────────────────────────

/**
 * Wraps routes that require the user to be authenticated.
 * Shows a loading skeleton while auth state is resolving.
 */
export function RequireAuth(): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Skeleton.Page />;

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

// ── RequireRole ───────────────────────────────────────────────────────────────

interface RequireRoleProps {
  /** At least one of these roles must be present in the user's claims. */
  roles: UserRole[];
}

/**
 * Wraps routes that require specific roles.
 * Must be nested inside <RequireAuth>.
 */
export function RequireRole({ roles }: RequireRoleProps): React.ReactElement {
  const { claims, loading } = useAuth();

  if (loading) return <Skeleton.Page />;

  const hasAny = roles.some((role) => claims?.roles.includes(role));

  if (!hasAny) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet />;
}

// ── RedirectIfAuth ────────────────────────────────────────────────────────────

/**
 * Redirects authenticated users away from auth pages (login, register).
 */
export function RedirectIfAuth(): React.ReactElement {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Skeleton.Page />;

  if (isAuthenticated) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <Outlet />;
}
