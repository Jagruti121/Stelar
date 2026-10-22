/**
 * STELLAR — Sidebar component
 *
 * Fixed left sidebar on desktop (240px). Contains the STELLAR logo,
 * nav groups with active state, and a sign-out button.
 * Consumed by AppShell; not rendered directly.
 */


import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, GraduationCap } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getNavForRoles } from '@/router/navConfig';
import { cn } from '@/utils/cn';
import { initials } from '@/utils/cn';

export function Sidebar(): React.ReactElement {
  const { user, claims } = useAuth();
  const navigate = useNavigate();
  const navGroups = getNavForRoles(claims?.roles ?? []);

  const handleSignOut = async (): Promise<void> => {
    await signOut(auth);
    navigate('/login');
  };

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col bg-white border-r border-[--border]"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-[--border] flex-shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[--primary]">
          <GraduationCap className="h-5 w-5 text-white" aria-hidden="true" />
        </div>
        <div>
          <span className="text-base font-bold text-[--text] tracking-tight">STELLAR</span>
          <p className="text-[10px] text-[--text-muted] leading-none mt-0.5">
            {claims?.roles.includes('HOD')
              ? 'HOD Portal'
              : claims?.roles.includes('FACULTY')
              ? 'Faculty Portal'
              : 'Student Portal'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6" aria-label="Sidebar">
        {navGroups.map((group) => (
          <div key={group.label ?? 'main'}>
            {group.label && (
              <p className="px-3 mb-1 text-[11px] font-semibold uppercase tracking-widest text-[--text-muted]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {group.items.map((item) => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn('sidebar-link', isActive && 'active')
                    }
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="border-t border-[--border] p-3 flex-shrink-0">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors">
          {/* Avatar */}
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[--primary] text-white text-xs font-semibold flex-shrink-0"
            aria-hidden="true"
          >
            {initials(user?.displayName ?? user?.email ?? '?')}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[--text] truncate">
              {user?.displayName ?? 'User'}
            </p>
            <p className="text-[10px] text-[--text-muted] truncate">
              {claims?.roles.join(', ')}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-1.5 rounded-md text-[--text-muted] hover:text-[--danger] hover:bg-red-50 transition-colors"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
