import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { inboxCol } from '@/lib/firestore';
import {
  collection, where, onSnapshot, query, orderBy,
  serverTimestamp, addDoc
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '@/lib/firebase';
import { toast } from 'sonner';
import {
  Loader2, Send, Bell, ChevronDown, History, Clock
} from 'lucide-react';
import type { InboxItem } from '@/types/firestore';

const sendNotification = httpsCallable(functions, 'sendNotification');

// ── Department Normalization Dictionary ───────────────────────────────────────

export const DEPARTMENT_MAP: Record<string, string> = {
  'CS': 'Computer Science',
  'IT': 'Information Technology',
  'Engineering': 'Engineering',
  'Other': 'Other',
  'Computer Science': 'Computer Science',
  'Information Technology': 'Information Technology',
  'CSE': 'Computer Science',
  'cse': 'Computer Science',
  'cs': 'Computer Science',
  'it': 'Information Technology',
};

// ── Priority definitions ──────────────────────────────────────────────────────

export type NotificationPriority = 'high' | 'low' | 'casual';

export interface PriorityConfig {
  label: string;
  icon: React.ReactElement;
  badgeClass: string;
  borderClass: string;
}

export function normalizePriority(p?: string): NotificationPriority {
  if (!p) return 'casual';
  const lower = p.toLowerCase().trim();
  if (lower.includes('high') || lower.includes('alert')) return 'high';
  if (lower.includes('low')) return 'low';
  return 'casual';
}

export const PRIORITY_MAP: Record<string, PriorityConfig> = {
  high: {
    label: 'High Alert',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-red-500" aria-label="High Alert">
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-red-50 text-red-700 border border-red-200 font-semibold',
    borderClass: 'border-l-4 border-l-red-500',
  },
  'High Alert': {
    label: 'High Alert',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-red-600" aria-label="High Alert">
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-red-100 text-red-800 border border-red-300 font-bold',
    borderClass: 'border-l-4 border-l-red-600',
  },
  'High Priority': {
    label: 'High Priority',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-red-500" aria-label="High Priority">
        <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-red-50 text-red-700 border border-red-200 font-semibold',
    borderClass: 'border-l-4 border-l-red-500',
  },
  low: {
    label: 'Low Priority',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-500" aria-label="Low Priority">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    borderClass: 'border-l-4 border-l-amber-400',
  },
  'Low Priority': {
    label: 'Low Priority',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-amber-500" aria-label="Low Priority">
        <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm8.706-1.442c1.146-.573 2.437.463 2.126 1.706l-.709 2.836.042-.02a.75.75 0 01.67 1.34l-.04.022c-1.147.573-2.438-.463-2.127-1.706l.71-2.836-.042.02a.75.75 0 11-.671-1.34l.041-.022zM12 9a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
    borderClass: 'border-l-4 border-l-amber-400',
  },
  casual: {
    label: 'Casual',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-blue-400" aria-label="Casual">
        <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-blue-50 text-blue-600 border border-blue-200',
    borderClass: 'border-l-4 border-l-blue-300',
  },
  Casual: {
    label: 'Casual',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-blue-400" aria-label="Casual">
        <path fillRule="evenodd" d="M4.848 2.771A49.144 49.144 0 0112 2.25c2.43 0 4.817.178 7.152.52 1.978.292 3.348 2.024 3.348 3.97v6.02c0 1.946-1.37 3.678-3.348 3.97a48.901 48.901 0 01-3.476.383.39.39 0 00-.297.17l-2.755 4.133a.75.75 0 01-1.248 0l-2.755-4.133a.39.39 0 00-.297-.17 48.9 48.9 0 01-3.476-.384c-1.978-.29-3.348-2.024-3.348-3.97V6.741c0-1.946 1.37-3.68 3.348-3.97z" clipRule="evenodd" />
      </svg>
    ),
    badgeClass: 'bg-blue-50 text-blue-600 border border-blue-200',
    borderClass: 'border-l-4 border-l-blue-300',
  },
};

export function getPriorityConfig(priority?: string): PriorityConfig {
  if (!priority) return PRIORITY_MAP.casual;
  if (PRIORITY_MAP[priority]) return PRIORITY_MAP[priority];
  const norm = normalizePriority(priority);
  return PRIORITY_MAP[norm] || PRIORITY_MAP.casual;
}

// ── Root component — route by role ────────────────────────────────────────────

export default function NotificationsPage(): React.ReactElement {
  const { claims } = useAuth();
  const isStudent = claims?.roles.includes('STUDENT');
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  if (isStudent) {
    return <StudentInbox studentId={claims?.studentId as string} />;
  }

  if (isFaculty) {
    return <FacultySender />;
  }

  return <div>Unauthorized</div>;
}

// ── Student Inbox (FIX 4 & FIX 11) ───────────────────────────────────────────

function StudentInbox({ studentId }: { studentId: string }) {
  const { claims } = useAuth();
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const rawDept = ((claims as any)?.department || claims?.deptId || 'CS').toString().toUpperCase();
    const studentDept = DEPARTMENT_MAP[rawDept] || (rawDept === 'CSE' ? 'Computer Science' : rawDept);

    let inboxItems: InboxItem[] = [];
    let deptItems: InboxItem[] = [];

    const updateCombined = () => {
      const map = new Map<string, InboxItem>();
      [...deptItems, ...inboxItems].forEach(item => {
        if (!map.has(item.id)) map.set(item.id, item);
      });
      const combined = Array.from(map.values()).sort((a, b) => {
        const timeA = (a.createdAt as any)?.seconds || ((a.createdAt as any)?.toDate ? (a.createdAt as any).toDate().getTime() : 0);
        const timeB = (b.createdAt as any)?.seconds || ((b.createdAt as any)?.toDate ? (b.createdAt as any).toDate().getTime() : 0);
        return timeB - timeA;
      });
      setInbox(combined);
      setLoading(false);
    };

    // 1. Personal Inbox listener
    let unsubInbox = () => {};
    if (studentId) {
      unsubInbox = onSnapshot(
        query(inboxCol(studentId), orderBy('createdAt', 'desc')),
        (snap) => {
          inboxItems = snap.docs.map(d => ({ ...d.data(), id: d.id }));
          updateCombined();
        },
        (err) => {
          console.warn('Inbox listener error:', err);
          updateCombined();
        }
      );
    }

    // 2. Department standardized query listener: where("department", "==", studentDept)
    const qDept = query(
      collection(db, 'notifications'),
      where("department", "==", studentDept),
      orderBy('createdAt', 'desc')
    );
    const unsubDept = onSnapshot(
      qDept,
      (snap) => {
        deptItems = snap.docs.map(d => {
          const data = d.data() as any;
          return {
            id: d.id,
            notificationId: d.id,
            title: data.title || '',
            message: data.message || '',
            priority: (data.priority as NotificationPriority) || 'casual',
            read: false,
            createdAt: data.createdAt,
          } as InboxItem;
        });
        updateCombined();
      },
      (err) => {
        console.warn('Department notifications listener warning:', err);
        updateCombined();
      }
    );

    return () => {
      unsubInbox();
      unsubDept();
    };
  }, [studentId, claims]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[--primary]" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Bell className="h-6 w-6 text-[--primary]" />
          Notifications
        </h1>
        <p className="text-sm text-[--text-muted] mt-1">Your personal inbox for college updates.</p>
      </div>

      <div className="space-y-4">
        {inbox.length === 0 ? (
          <div className="card text-center text-[--text-muted] p-10">You have no notifications.</div>
        ) : (
          inbox.map(item => {
            const pConfig = getPriorityConfig(item.priority);

            return (
              <div
                key={item.id}
                className={`card ${pConfig.borderClass} ${item.read ? 'opacity-70' : ''}`}
              >
                {/* "Mark as read" button completely removed */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {pConfig.icon}
                      <h3 className={`font-semibold ${!item.read ? 'text-[--primary]' : 'text-[--text]'}`}>
                        {item.title}
                      </h3>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${pConfig.badgeClass}`}>
                      {pConfig.label}
                    </span>
                  </div>
                  <p className="text-sm text-[--text-muted] whitespace-pre-wrap pl-6">{item.message}</p>
                  <p className="text-xs text-gray-400 mt-2 flex items-center gap-1 pl-6">
                    <Clock className="h-3 w-3" />
                    {item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleString() : 'Just now'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Faculty Sender (Targeted audiences + Priority persistence + History) ──────

interface SentNotificationRecord {
  id: string;
  title: string;
  message: string;
  priority: string;
  targetLabel: string;
  createdAt: any;
}

const DEPT_OPTIONS = ['CS', 'IT', 'Engineering', 'Other'];
const DIVISION_OPTIONS = ['A', 'B', 'C', 'D'];
const YEAR_OPTIONS = ['First Year', 'Second Year', 'Third Year'];

function FacultySender() {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  // Primary audience selector: 'all' | 'dept'
  const [audienceType, setAudienceType] = useState<'all' | 'dept'>('all');
  // Secondary dropdowns for "Specific Department"
  const [targetDept, setTargetDept] = useState('CS');
  const [targetDivision, setTargetDivision] = useState('A');
  const [targetYear, setTargetYear] = useState('First Year');
  // Priority: 'high' | 'low' | 'casual'
  const [priority, setPriority] = useState<string>('high');
  const [loading, setLoading] = useState(false);

  // Notification history
  const [history, setHistory] = useState<SentNotificationRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'compose' | 'history'>('compose');

  // Load notification history from Firestore `notifications` collection
  useEffect(() => {
    setHistoryLoading(true);
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const records: SentNotificationRecord[] = snap.docs.map(d => {
          const data = d.data() as any;
          let targetLabel = 'All Students';
          if (data.target?.type === 'dept') {
            const deptDisplay = data.department || data.target?.department || targetDept;
            targetLabel = `Dept: ${deptDisplay} / Div: ${data.target?.divisions?.join(', ') || '—'} / ${data.target?.year || '—'}`;
          }
          // Strictly read priority from Firestore document
          const rawPriority = data.priority || data.priorityLevel || 'casual';
          return {
            id: d.id,
            title: data.title || '(No title)',
            message: data.message || '',
            priority: rawPriority,
            targetLabel,
            createdAt: data.createdAt,
          };
        });
        setHistory(records);
        setHistoryLoading(false);
      },
      (err) => {
        console.warn('Notification history listener error:', err);
        setHistoryLoading(false);
      }
    );
    return () => unsub();
  }, [targetDept]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // FIX 1: Normalize department acronyms ("CS") to database profile string ("Computer Science")
      const normalizedDept = audienceType === 'dept' ? (DEPARTMENT_MAP[targetDept] || targetDept) : 'All';
      const target: any = { type: audienceType === 'all' ? 'all' : 'dept' };

      if (audienceType === 'dept') {
        target.department = normalizedDept;
        target.deptIds = [
          targetDept.toLowerCase(),
          normalizedDept.toLowerCase(),
          'cs',
          'cse',
          'computer science',
          'it',
          'information technology'
        ];
        target.divisions = [targetDivision.toUpperCase()];
        target.year = targetYear;
      }

      // FIX 3: Ensure exact priority string is bound and saved into Firestore document
      const payload: any = {
        title: title.trim(),
        message: message.trim(),
        target,
        department: normalizedDept,
        priority: priority, // Exact priority string (e.g. 'high', 'High Priority', 'High Alert')
        priorityLevel: priority,
        createdBy: user?.uid || 'faculty',
        createdAt: serverTimestamp(),
      };

      // 1. Direct write to Firestore ensures exact fields are immediately committed
      await addDoc(collection(db, 'notifications'), payload);

      // 2. Also invoke Cloud Function for fanout if deployed
      try {
        await sendNotification(payload);
      } catch (fnErr) {
        console.warn('sendNotification fanout note:', fnErr);
      }

      toast.success('Notification dispatched successfully');
      setTitle('');
      setMessage('');
      setPriority('high');
      setAudienceType('all');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2">
          <Bell className="h-6 w-6 text-[--primary]" />
          Notifications
        </h1>
        <p className="text-sm text-[--text-muted] mt-1">Broadcast targeted updates to students.</p>
      </div>

      {/* Tab bar */}
      <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('compose')}
          className={`flex items-center gap-1.5 py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'compose'
              ? 'bg-white text-[--primary] shadow-sm border border-gray-200/80'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Send className="h-3.5 w-3.5" />
          Compose
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'history'
              ? 'bg-white text-[--primary] shadow-sm border border-gray-200/80'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          History
          {history.length > 0 && (
            <span className="ml-1 bg-[--primary] text-white text-[10px] rounded-full px-1.5 py-0.5 leading-none">
              {history.length}
            </span>
          )}
        </button>
      </div>

      {/* ── Compose Tab ─────────────────────────────────────── */}
      {activeTab === 'compose' && (
        <div className="card">
          <form onSubmit={handleSend} className="space-y-5">
            {/* Title */}
            <div>
              <label className="label">Title</label>
              <input required className="input" placeholder="Notification title…" value={title} onChange={e => setTitle(e.target.value)} />
            </div>

            {/* Message */}
            <div>
              <label className="label">Message</label>
              <textarea required className="input min-h-[100px]" placeholder="Write your message…" value={message} onChange={e => setMessage(e.target.value)} />
            </div>

            {/* Target Audience + conditional secondary dropdowns */}
            <div>
              <label className="label">Target Audience</label>
              <div className="flex flex-wrap items-start gap-3">
                {/* Primary dropdown */}
                <div className="relative min-w-[180px]">
                  <select
                    className="input pr-8 appearance-none font-semibold"
                    value={audienceType}
                    onChange={e => setAudienceType(e.target.value as 'all' | 'dept')}
                  >
                    <option value="all">All Students</option>
                    <option value="dept">Specific Department</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
                </div>

                {/* Secondary dropdowns — conditionally rendered when "Specific Department" selected */}
                {audienceType === 'dept' && (
                  <div className="flex flex-wrap gap-3 flex-1">
                    {/* Department (CS maps to Computer Science) */}
                    <div className="relative min-w-[130px] flex-1">
                      <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1 block">Department</label>
                      <select
                        className="input appearance-none pr-8 font-medium"
                        value={targetDept}
                        onChange={e => setTargetDept(e.target.value)}
                      >
                        {DEPT_OPTIONS.map(d => (
                          <option key={d} value={d}>
                            {d} ({DEPARTMENT_MAP[d] || d})
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 h-4 w-4 text-[--text-muted]" />
                    </div>

                    {/* Division */}
                    <div className="relative min-w-[100px] flex-1">
                      <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1 block">Division</label>
                      <select
                        className="input appearance-none pr-8"
                        value={targetDivision}
                        onChange={e => setTargetDivision(e.target.value)}
                      >
                        {DIVISION_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 h-4 w-4 text-[--text-muted]" />
                    </div>

                    {/* Year */}
                    <div className="relative min-w-[140px] flex-1">
                      <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider mb-1 block">Year</label>
                      <select
                        className="input appearance-none pr-8"
                        value={targetYear}
                        onChange={e => setTargetYear(e.target.value)}
                      >
                        {YEAR_OPTIONS.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 bottom-2 h-4 w-4 text-[--text-muted]" />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* FIX 3: Priority Dropdown + synced visual pills */}
            <div>
              <label className="label">Priority Level</label>
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                <div className="relative min-w-[200px]">
                  <select
                    className="input pr-8 appearance-none font-medium"
                    value={priority}
                    onChange={e => setPriority(e.target.value)}
                  >
                    <option value="high">High Priority / High Alert</option>
                    <option value="low">Low Priority</option>
                    <option value="casual">Casual</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
                </div>

                {/* Synced Priority Quick-Pills */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: 'high', label: 'High Priority', cfg: PRIORITY_MAP.high },
                    { key: 'low', label: 'Low Priority', cfg: PRIORITY_MAP.low },
                    { key: 'casual', label: 'Casual', cfg: PRIORITY_MAP.casual },
                  ].map(({ key, label, cfg }) => {
                    const isSelected = normalizePriority(priority) === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPriority(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          isSelected
                            ? `${cfg.badgeClass} shadow-sm ring-2 ring-offset-1 ${
                                key === 'high' ? 'ring-red-400' : key === 'low' ? 'ring-amber-400' : 'ring-blue-400'
                              }`
                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {cfg.icon}
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Send Button */}
            <button type="submit" disabled={loading} className="btn-primary w-full flex justify-center items-center gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Dispatch Notification
            </button>
          </form>
        </div>
      )}

      {/* ── History Tab (FIX 3: strictly maps exact priority string) ── */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {historyLoading ? (
            <div className="flex justify-center p-10">
              <Loader2 className="h-6 w-6 animate-spin text-[--primary]" />
            </div>
          ) : history.length === 0 ? (
            <div className="card text-center text-[--text-muted] p-10">
              No notifications have been sent yet.
            </div>
          ) : (
            history.map(item => {
              const pConfig = getPriorityConfig(item.priority);
              return (
                <div key={item.id} className={`card ${pConfig.borderClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {pConfig.icon}
                      <div className="min-w-0">
                        <p className="font-semibold text-[--text] truncate">{item.title}</p>
                        <p className="text-sm text-[--text-muted] mt-0.5 line-clamp-2">{item.message}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pConfig.badgeClass}`}>
                            {pConfig.label}
                          </span>
                          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium">
                            {item.targetLabel}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap flex items-center gap-1 flex-shrink-0">
                      <Clock className="h-3 w-3" />
                      {item.createdAt?.toDate?.() ? item.createdAt.toDate().toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
