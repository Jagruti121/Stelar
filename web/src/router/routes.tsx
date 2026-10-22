/**
 * STELLAR — App Router
 *
 * Single source of truth for all application routes.
 * Uses React Router v6 with lazy loading for code splitting.
 */

import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { RequireAuth, RequireRole, RedirectIfAuth } from '@/router/guards';
import { Skeleton } from '@/components/shared/Skeleton';
import { AppErrorBoundary } from '@/components/shared/AppErrorBoundary';

// ── Lazy-loaded pages ──────────────────────────────────────────────────────────

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));
const ActivatePage = lazy(() => import('@/pages/ActivatePage'));
const StudentsPage = lazy(() => import('@/pages/StudentsPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const AttendancePage = lazy(() => import('@/pages/AttendancePage'));
const ResultsPage = lazy(() => import('@/pages/ResultsPage'));
const ResultsUploadPage = lazy(() => import('@/pages/ResultsUploadPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const PollsPage = lazy(() => import('@/pages/PollsPage'));
const CommunitiesPage = lazy(() => import('@/pages/CommunitiesPage'));
const TalentPage = lazy(() => import('@/pages/TalentPage'));

// Placeholder pages — static imports (no lazy; they're tiny stubs)
import {
  ResourcesPage,
  OpportunitiesPage
} from '@/pages/PlaceholderPage';

// Suspense wrapper
const withSuspense = (element: React.ReactNode): React.ReactNode => (
  <Suspense fallback={<Skeleton.Page />}>{element}</Suspense>
);

// ── Router definition ─────────────────────────────────────────────────────────

export const router = createBrowserRouter([
  // ── Root redirect ────────────────────────────────────────
  {
    path: '/',
    element: <Navigate to="/login" replace />,
    errorElement: <AppErrorBoundary />,
  },

  // ── Auth routes (redirect if already logged in) ──────────
  {
    element: <RedirectIfAuth />,
    errorElement: <AppErrorBoundary />,
    children: [
      {
        path: '/login',
        element: withSuspense(<LoginPage />),
      },
      {
        path: '/register',
        element: withSuspense(<RegisterPage />),
      },
      {
        path: '/activate',
        element: withSuspense(<ActivatePage />),
      },
    ],
  },

  // ── Protected app routes ─────────────────────────────────
  {
    element: <RequireAuth />,
    errorElement: <AppErrorBoundary />,
    children: [
      {
        element: <AppShell />,
        errorElement: <AppErrorBoundary />,
        children: [
          // Dashboard — all authenticated roles
          {
            path: '/app/dashboard',
            element: withSuspense(<DashboardPage />),
          },

          // Student-only routes
          {
            element: <RequireRole roles={['STUDENT']} />,
            children: [
              { path: '/app/profile', element: withSuspense(<ProfilePage />) },
              { path: '/app/results', element: withSuspense(<ResultsPage />) },
            ],
          },

          // Faculty + HOD routes
          {
            element: <RequireRole roles={['FACULTY', 'HOD']} />,
            children: [
              { path: '/app/talent', element: withSuspense(<TalentPage />) },
            ],
          },

          // HOD & Faculty management routes
          {
            element: <RequireRole roles={['HOD', 'FACULTY']} />,
            children: [
              { path: '/app/students', element: withSuspense(<StudentsPage />) },
              { path: '/app/results-upload', element: withSuspense(<ResultsUploadPage />) },
            ],
          },

          // Shared routes (all authenticated users)
          { path: '/app/attendance', element: withSuspense(<AttendancePage />) },
          { path: '/app/notifications', element: withSuspense(<NotificationsPage />) },
          { path: '/app/polls', element: withSuspense(<PollsPage />) },
          { path: '/app/communities', element: withSuspense(<CommunitiesPage />) },
          { path: '/app/communities/join/:inviteCode', element: withSuspense(<CommunitiesPage />) },
          { path: '/app/resources', element: <ResourcesPage /> },
          { path: '/app/opportunities', element: <OpportunitiesPage /> },
        ],
      },
    ],
  },

  // ── Error pages ──────────────────────────────────────────
  {
    path: '/unauthorized',
    element: withSuspense(<UnauthorizedPage />),
  },
  {
    path: '*',
    element: withSuspense(<NotFoundPage />),
  },
], {
  future: {
    v7_relativeSplatPath: true,
  },
});
