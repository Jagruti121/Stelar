/**
 * STELLAR — App Root
 *
 * Wraps the router with all global providers:
 * - AuthProvider (Firebase Auth + custom claims)
 * - QueryClientProvider (TanStack Query)
 * - Toaster (sonner)
 * - RouterProvider
 */


import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { router } from '@/router/routes';

// ── TanStack Query client ──────────────────────────────────────────────────────

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── App component ──────────────────────────────────────────────────────────────

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast: 'font-sans text-sm rounded-xl border border-[--border] shadow-card',
              title: 'font-semibold text-[--text]',
              description: 'text-[--text-muted]',
              actionButton: 'btn-primary text-xs',
              cancelButton: 'btn-ghost text-xs',
              success: 'border-green-200',
              error: 'border-red-200',
            },
          }}
        />
      </AuthProvider>
    </QueryClientProvider>
  );
}
