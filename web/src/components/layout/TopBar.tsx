/**
 * STELLAR — Top Bar component
 *
 * 64px fixed top bar with:
 * - Page title (injected via context or prop)
 * - Global search input (placeholder, functional in Phase 7)
 * - Notification bell with unread badge
 * - Avatar dropdown (sign out)
 */

import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Search, LogOut, UserCircle, ChevronDown, X, ChevronRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, query, limit } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { cn, initials } from '@/utils/cn';

interface TopBarProps {
  /** Mobile: toggle the drawer/sidebar. */
  onMenuToggle: () => void;
  /** Unread notification count. */
  unreadCount?: number;
}

interface SearchStudent {
  id: string;
  name: string;
  rollNo?: string;
  roll?: string;
  deptId?: string;
  department?: string;
  division?: string;
  skills?: string[];
}

export function TopBar({ onMenuToggle, unreadCount = 0 }: TopBarProps): React.ReactElement {
  const { user, claims } = useAuth();
  const navigate = useNavigate();
  const [avatarOpen, setAvatarOpen] = useState(false);

  // Global Omni-Search States (Feature 17)
  const [searchQuery, setSearchQuery] = useState('');
  const [studentsCache, setStudentsCache] = useState<SearchStudent[]>([]);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Load and cache student users collection for instant client-side omni-search
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'students'), limit(250));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: SearchStudent[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            name: data.name || 'Unnamed Student',
            rollNo: data.rollNo || data.roll || '',
            roll: data.roll || data.rollNo || '',
            deptId: data.deptId || '',
            department: data.department || (data.deptId ? data.deptId.toUpperCase() : 'CS'),
            division: data.division || 'A',
            skills: Array.isArray(data.skills)
              ? data.skills.map((s: any) => (typeof s === 'string' ? s : s.name)).filter(Boolean)
              : [],
          };
        });
        setStudentsCache(list);
      },
      (err) => console.warn('Student search cache error:', err)
    );

    return () => unsub();
  }, [user]);

  // Handle outside clicks to close search dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Omni-search algorithm: checks Student Name, Roll Number, and Skills Array
  const filteredStudents =
    searchQuery.trim().length > 0
      ? studentsCache
          .filter((s) => {
            const term = searchQuery.toLowerCase().trim();
            const matchName = s.name.toLowerCase().includes(term);
            const matchRoll =
              (s.rollNo && s.rollNo.toLowerCase().includes(term)) ||
              (s.roll && s.roll.toLowerCase().includes(term));
            const matchSkill = s.skills && s.skills.some((sk) => sk.toLowerCase().includes(term));
            return matchName || matchRoll || matchSkill;
          })
          .slice(0, 8)
      : [];

  const handleSelectStudent = (studentId: string) => {
    setIsSearchOpen(false);
    setSearchQuery('');
    navigate(`/app/student-profile/${studentId}`);
  };

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

      {/* Omni-Search Bar (Feature 17) */}
      <div className="relative flex-1 max-w-md hidden sm:block" ref={searchContainerRef}>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]"
            aria-hidden="true"
          />
          <input
            type="search"
            placeholder="Search students by name, roll no, or skills (e.g. React)..."
            className="input pl-9 pr-8 h-9 text-xs w-full"
            aria-label="Global student omni-search"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsSearchOpen(true);
            }}
            onFocus={() => {
              if (searchQuery.trim().length > 0) setIsSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setIsSearchOpen(false);
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setIsSearchOpen(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown Results Menu */}
        {isSearchOpen && searchQuery.trim().length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in max-h-96 overflow-y-auto">
            <div className="p-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
              <span>Student Matches ({filteredStudents.length})</span>
              <span>Name • Roll • Skills</span>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No students found matching "<span className="font-semibold text-slate-600">{searchQuery}</span>".
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredStudents.map((student) => {
                  const rollStr = student.rollNo || student.roll || '';
                  const term = searchQuery.toLowerCase().trim();
                  const matchedSkills = (student.skills || []).filter((sk) =>
                    sk.toLowerCase().includes(term)
                  );

                  return (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelectStudent(student.id)}
                      className="w-full text-left p-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[--text] group-hover:text-[--primary] transition-colors truncate">
                            {student.name}
                          </p>
                          <p className="text-[11px] text-[--text-muted] truncate">
                            {rollStr ? `Roll: ${rollStr}` : 'Student'} • {student.department} • Div {student.division}
                          </p>
                          {matchedSkills.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1">
                              {matchedSkills.slice(0, 3).map((sk, idx) => (
                                <span
                                  key={idx}
                                  className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 font-medium border border-indigo-200"
                                >
                                  {sk}
                                </span>
                              ))}
                              {matchedSkills.length > 3 && (
                                <span className="text-[10px] text-slate-400">
                                  +{matchedSkills.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-[--primary] group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
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
