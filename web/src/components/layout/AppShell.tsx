/**
 * STELLAR — App Shell
 *
 * The main layout wrapper for authenticated routes.
 * Renders: Sidebar (desktop) + TopBar + <Outlet /> + BottomTabBar (mobile).
 * Mobile sidebar is a drawer overlay.
 */

import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { X } from 'lucide-react';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { BottomTabBar } from '@/components/layout/BottomTabBar';
import { cn } from '@/utils/cn';

export function AppShell(): React.ReactElement {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[--surface]">
      {/* ── Desktop sidebar ──────────────────────────────── */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* ── Mobile drawer ─────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-[240px] bg-white shadow-xl lg:hidden',
              'animate-slide-in-left'
            )}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
          >
            {/* Close button */}
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-[--text-muted]
                         hover:bg-gray-100 transition-colors"
              aria-label="Close navigation menu"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <Sidebar />
          </div>
        </>
      )}

      {/* ── Top bar ───────────────────────────────────────── */}
      <TopBar onMenuToggle={() => setDrawerOpen(true)} unreadCount={0} />

      {/* ── Main content ──────────────────────────────────── */}
      <main
        className={cn(
          'pt-16 pb-20 lg:pb-0', // pb-20 for mobile bottom tab bar
          'lg:pl-[240px]'        // offset for sidebar
        )}
        id="main-content"
      >
        <div className="page-container">
          <Outlet />
        </div>
      </main>

      {/* ── Mobile bottom tab bar ─────────────────────────── */}
      <BottomTabBar />
    </div>
  );
}
