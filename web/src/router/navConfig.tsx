/**
 * STELLAR — Navigation configuration
 *
 * Defines nav items per role. The sidebar and bottom tab bar both
 * consume this config so they always stay in sync.
 */

import {
  LayoutDashboard,
  Users,
  BookOpen,
  ClipboardList,
  Bell,
  BarChart2,
  MessageSquare,
  Search,
  FileText,
  Trophy,
  UserCircle,
  Briefcase,
  type LucideIcon,
} from 'lucide-react';
import type { UserRole } from '@/types/firestore';

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
  /** Bottom tab bar shows max 5 items; show=true puts item in the tab bar. */
  showInTabBar?: boolean;
}

export interface NavGroup {
  /** Group label — null for ungrouped items at the top. */
  label: string | null;
  items: NavItem[];
}

// ── Student navigation ────────────────────────────────────────────────────────

export const STUDENT_NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, showInTabBar: true },
      { label: 'My Profile', path: '/app/profile', icon: UserCircle, showInTabBar: true },
    ],
  },
  {
    label: 'Academic',
    items: [
      { label: 'Attendance', path: '/app/attendance', icon: ClipboardList, showInTabBar: true },
      { label: 'Results', path: '/app/results', icon: BarChart2 },
      { label: 'Resources', path: '/app/resources', icon: FileText },
    ],
  },
  {
    label: 'Community',
    items: [
      { label: 'Notifications', path: '/app/notifications', icon: Bell, showInTabBar: true },
      { label: 'Polls', path: '/app/polls', icon: BookOpen },
      { label: 'Communities', path: '/app/communities', icon: MessageSquare, showInTabBar: true },
      { label: 'Opportunities', path: '/app/opportunities', icon: Briefcase },
    ],
  },
];

// ── Faculty navigation ────────────────────────────────────────────────────────

export const FACULTY_NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, showInTabBar: true },
      { label: 'Talent Search', path: '/app/talent', icon: Search, showInTabBar: true },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { label: 'Attendance', path: '/app/attendance', icon: ClipboardList, showInTabBar: true },
      { label: 'Student Roster', path: '/app/students', icon: Users },
      { label: 'Resources', path: '/app/resources', icon: FileText },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { label: 'Notifications', path: '/app/notifications', icon: Bell, showInTabBar: true },
      { label: 'Polls', path: '/app/polls', icon: BookOpen },
      { label: 'Communities', path: '/app/communities', icon: MessageSquare },
      { label: 'Opportunities', path: '/app/opportunities', icon: Briefcase },
    ],
  },
];

// ── HOD navigation (Faculty nav + HOD-only items) ─────────────────────────────

export const HOD_NAV: NavGroup[] = [
  {
    label: null,
    items: [
      { label: 'Dashboard', path: '/app/dashboard', icon: LayoutDashboard, showInTabBar: true },
      { label: 'Talent Search', path: '/app/talent', icon: Search, showInTabBar: true },
    ],
  },
  {
    label: 'Students',
    items: [
      { label: 'Student Management', path: '/app/students', icon: Users, showInTabBar: true },
      { label: 'Results Upload', path: '/app/results-upload', icon: Trophy },
    ],
  },
  {
    label: 'Teaching',
    items: [
      { label: 'Attendance', path: '/app/attendance', icon: ClipboardList },
      { label: 'Resources', path: '/app/resources', icon: FileText },
    ],
  },
  {
    label: 'Engagement',
    items: [
      { label: 'Notifications', path: '/app/notifications', icon: Bell, showInTabBar: true },
      { label: 'Polls', path: '/app/polls', icon: BookOpen },
      { label: 'Communities', path: '/app/communities', icon: MessageSquare },
      { label: 'Opportunities', path: '/app/opportunities', icon: Briefcase },
    ],
  },
];

/** Returns the appropriate nav config for the given roles. */
export function getNavForRoles(roles: UserRole[]): NavGroup[] {
  if (roles.includes('HOD')) return HOD_NAV;
  if (roles.includes('FACULTY')) return FACULTY_NAV;
  return STUDENT_NAV;
}
