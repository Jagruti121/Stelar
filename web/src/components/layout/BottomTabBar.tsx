/**
 * STELLAR — Mobile Bottom Tab Bar
 *
 * Replaces the sidebar on mobile (< lg breakpoint).
 * Shows the top 5 nav items with showInTabBar=true for the current role.
 */


import { NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getNavForRoles } from '@/router/navConfig';
import { cn } from '@/utils/cn';

export function BottomTabBar(): React.ReactElement {
  const { claims } = useAuth();
  const allGroups = getNavForRoles(claims?.roles ?? []);

  // Flatten all items and take the first 5 with showInTabBar=true
  const tabItems = allGroups
    .flatMap((g) => g.items)
    .filter((item) => item.showInTabBar)
    .slice(0, 5);

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[--border]
                 flex lg:hidden"
      aria-label="Bottom navigation"
    >
      {tabItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px]',
              'font-medium transition-colors',
              isActive
                ? 'text-[--primary]'
                : 'text-[--text-muted] hover:text-[--text]'
            )
          }
          aria-label={item.label}
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn('h-5 w-5', isActive && 'stroke-[--primary]')}
                aria-hidden="true"
              />
              <span>{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
