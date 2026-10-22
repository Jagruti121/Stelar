/**
 * STELLAR — Top Bar component
 *
 * 64px fixed top bar with:
 * - Page title (injected via context or prop)
 * - Global search input (placeholder, functional in Phase 7)
 * - Notification bell with unread badge
 * - Avatar dropdown (sign out)
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Search, LogOut, UserCircle, ChevronDown } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { cn, initials } from '@/utils/cn';

interface TopBarProps {
  /** Mobile: toggle the drawer/sidebar. */
  onMenuToggle: () => void;
  /** Unread notification count. */
  unreadCount?: number;
}

export function TopBar({ onMenuToggle, unreadCount = 0 }: TopBarProps): React.ReactElement {
  const { user, claims } = useAuth();
  const navigate = useNavigate();
  const [avatarOpen, setAvatarOpen] = useState(false);

  const handleSignOut = async (): Promise<void> => {
    setAvatarOpen(false);
    await signOut(auth);
    navigate('/login');
  };

  return (
    <header
      className="fixed top-0 right-0 left-0 lg:left-[240px] z-30 flex h-16 items-center
                 gap-4 bg-white border-b border-[--border] px-4 lg:px-6"
      aria-label="Top bar"
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-[--text-muted] hover:bg-gray-100 transition-colors"
        aria-label="Open navigation menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Search */}
      <div className="relative flex-1 max-w-sm hidden sm:block">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]"
          aria-hidden="true"
        />
        <input
          type="search"
          placeholder="Search students, skills…"
          className="input pl-9 h-9 text-sm"
          aria-label="Global search"
          // Functional in Phase 7 (Talent Search)
          readOnly
        />
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {/* Notification bell */}
        <Link
          to="/app/notifications"
          className="relative p-2 rounded-lg text-[--text-muted] hover:bg-gray-100 transition-colors"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span
              className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center
                         rounded-full bg-[--danger] text-[10px] font-bold text-white"
              aria-hidden="true"
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>

        {/* Avatar dropdown */}
        <div className="relative">
          <button
            onClick={() => setAvatarOpen((v) => !v)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors',
              'hover:bg-gray-100',
              avatarOpen && 'bg-gray-100'
            )}
            aria-haspopup="true"
            aria-expanded={avatarOpen}
            aria-label="User menu"
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full
                         bg-[--primary] text-white text-xs font-semibold"
              aria-hidden="true"
            >
              {initials(user?.displayName ?? user?.email ?? '?')}
            </div>
            <span className="hidden md:block text-sm font-medium text-[--text] max-w-[120px] truncate">
              {user?.displayName ?? 'User'}
            </span>
            <ChevronDown className="hidden md:block h-4 w-4 text-[--text-muted]" aria-hidden="true" />
          </button>

          {/* Dropdown menu */}
          {avatarOpen && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setAvatarOpen(false)}
                aria-hidden="true"
              />
              <div
                className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-white
                           border border-[--border] shadow-lg z-20 py-1 animate-fade-in"
                role="menu"
              >
                <div className="px-4 py-2 border-b border-[--border]">
                  <p className="text-xs font-medium text-[--text] truncate">
                    {user?.displayName ?? 'User'}
                  </p>
                  <p className="text-[10px] text-[--text-muted]">
                    {claims?.roles.join(', ')}
                  </p>
                </div>
                <Link
                  to="/app/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-[--text]
                             hover:bg-gray-50 transition-colors"
                  role="menuitem"
                  onClick={() => setAvatarOpen(false)}
                >
                  <UserCircle className="h-4 w-4" aria-hidden="true" />
                  My Profile
                </Link>
                <button
                  onClick={handleSignOut}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-[--danger]
                             hover:bg-red-50 transition-colors"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
