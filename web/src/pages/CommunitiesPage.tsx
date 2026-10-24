/**
 * STELLAR — Communities Module (Feature 13)
 *
 * Faculty / HOD:
 * - Community Creation Form (Name, Description, Name of Admin)
 * - Target Audience selector ("All Students" or "Specific Department")
 * - Chat Permission Type ("One-side chat" [Broadcast] vs "Both-side chat" [Group])
 * - Secret Code auto-generated and displayed with one-click copy
 *
 * Student / Faculty Joining:
 * - Auto-join disabled: membership strictly requires Secret Code
 * - "Join Community" button opening modal to enter Secret Code
 * - Validates code against Firestore, appends UID to members array and members sub-collection
 *
 * Chat UI:
 * - Real-time messaging
 * - Enforces Chat Permission Type: if One-side chat, message input is disabled for non-admins with broadcast banner
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  orderBy,
  serverTimestamp,
  updateDoc,
  arrayUnion,
  increment,
  arrayRemove,
  runTransaction,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import {
  Loader2,
  Users,
  Plus,
  Send,
  Hash,
  ArrowLeft,
  Lock,
  Key,
  Copy,
  Check,
  Shield,
  MessageSquare,
  Building,
  X,
  Radio,
  CheckCircle2,
  Smile,
  Image,
  BarChart2,
  Calendar,
  PlusCircle,
  Trash2,
  MapPin,
  Clock,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { normalizeDepartment } from '@/pages/NotificationsPage';
import type { Community, Message, ChatPermissionType } from '@/types/firestore';

const DEPT_OPTIONS = [
  { label: 'Computer Science (CS)', value: 'Computer Science' },
  { label: 'Information Technology (IT)', value: 'Information Technology' },
  { label: 'Data Science (DS)', value: 'Data Science' },
  { label: 'Engineering', value: 'Engineering' },
  { label: 'Other', value: 'Other' },
];

// Emoji categories for the emoji picker
const EMOJI_GROUPS = [
  { label: 'Smileys', emojis: ['😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','😘','🥰','😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥','😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔','😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨','😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','😡','😠','🤬','😷','🤒','🤕','🤢','🤮','🤧','😇','🥳','🥺'] },
  { label: 'Gestures', emojis: ['👋','🤚','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏'] },
  { label: 'Hearts', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☯️','🕉️','🛐','🔯','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓'] },
  { label: 'Objects', emojis: ['📱','💻','🖥️','⌨️','🖨️','🖱️','🖲️','💾','💿','📀','📺','📷','📸','📹','🎥','📡','📠','📟','📞','☎️','🔋','🔌','💡','🔦','🕯️','🗑️','🛢️','💰','💴','💵','💶','💷','💸','💳','💎','⚖️','🔧','🔨','⚒️','🛠️','⛏️','🔩','🗜️','🔗','⛓️','🧲','🔫','💣','🔪','🗡️','⚔️','🛡️','🚬','⚰️','⚱️','🏺'] },
  { label: 'Nature', emojis: ['🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌲','🌳','🌴','🌵','🌾','🍀','🍁','🍂','🍃','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑','🥒','🥬','🥦','🧄','🧅','🥜','🌰'] },
  { label: 'Study', emojis: ['📚','📖','📝','✏️','🖊️','🖋️','✒️','🖌️','🖍️','📓','📔','📒','📃','📄','📑','🗒️','📊','📈','📉','📋','📌','📍','🗂️','🗃️','🗄️','🗑️','📥','📤','📦','📫','📪','📬','📭','📮','🗳️','✂️','🗃️','📐','📏','🖇️','🗺️','🌐','🗾','🧭','⏱️','⌚','⏰','🕰️','⌛','⏳'] },
];


export default function CommunitiesPage(): React.ReactElement {
  const { claims, user } = useAuth();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);

  // Creation form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdSecretCode, setCreatedSecretCode] = useState<string | null>(null);

  // Joining modal state
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Active filter tab: 'all' | 'my'
  const [filterTab, setFilterTab] = useState<'all' | 'my'>('all');

  // Real-time listener for all communities
  useEffect(() => {
    const q = query(collection(db, 'communities'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...d.data(),
          id: d.id,
        })) as Community[];
        setCommunities(list);
        setLoading(false);

        // Keep selected community in sync if open
        if (selectedCommunity) {
          const updated = list.find((c) => c.id === selectedCommunity.id);
          if (updated) setSelectedCommunity(updated);
        }
      },
      (err) => {
        console.warn('Communities listener warning:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [selectedCommunity?.id]);

  const isMemberOf = (comm: Community): boolean => {
    if (!user?.uid) return false;
    if (comm.ownerId === user.uid) return true;
    if (Array.isArray(comm.members) && comm.members.includes(user.uid)) return true;
    return false;
  };

  const displayedCommunities = communities.filter((comm) => {
    if (filterTab === 'my') {
      return isMemberOf(comm);
    }
    return true;
  });

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="animate-spin text-[--primary] h-8 w-8" />
      </div>
    );
  }

  // Selected Community Chat View
  if (selectedCommunity) {
    return (
      <CommunityChatView
        community={selectedCommunity}
        currentUserUid={user?.uid || ''}
        currentUserName={user?.displayName || 'User'}
        isFaculty={isFaculty || false}
        onBack={() => setSelectedCommunity(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-10">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[--border] pb-5">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <MessageSquare className="h-6 w-6" />
            </span>
            Communities
          </h1>
          <p className="text-sm text-[--text-muted] mt-1">
            Closed communication groups and academic channels with strict messaging controls.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => setShowJoinModal(true)}
            className="btn-secondary text-xs flex items-center gap-1.5 py-2 px-3.5 font-semibold"
          >
            <Key className="h-3.5 w-3.5 text-amber-500" />
            Join with Secret Code
          </button>

          {isFaculty && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-primary text-xs flex items-center gap-1.5 py-2 px-3.5 font-semibold"
            >
              <Plus className="h-4 w-4" />
              Create Community
            </button>
          )}
        </div>
      </div>

      {/* Secret Code Banner (Shown right after faculty creates a community) */}
      {createdSecretCode && (
        <div className="bg-emerald-50 border-2 border-emerald-400 rounded-xl p-4 shadow-sm animate-fade-in flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 text-white rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">Community Created Successfully!</h4>
              <p className="text-xs text-emerald-800">
                Auto-join is disabled. Students must enter this Secret Code to join:
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-emerald-300">
            <span className="font-mono font-extrabold text-base text-emerald-700 tracking-wider">
              {createdSecretCode}
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(createdSecretCode);
                toast.success('Secret Code copied to clipboard!');
              }}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-800"
              title="Copy Secret Code"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <button
            onClick={() => setCreatedSecretCode(null)}
            className="text-emerald-700 hover:text-emerald-900 p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setFilterTab('all')}
          className={cn(
            'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
            filterTab === 'all'
              ? 'bg-[--primary] text-white shadow-xs'
              : 'text-[--text-muted] hover:bg-slate-100'
          )}
        >
          All Communities ({communities.length})
        </button>
        <button
          onClick={() => setFilterTab('my')}
          className={cn(
            'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
            filterTab === 'my'
              ? 'bg-[--primary] text-white shadow-xs'
              : 'text-[--text-muted] hover:bg-slate-100'
          )}
        >
          My Joined Communities ({communities.filter(isMemberOf).length})
        </button>
      </div>

      {/* Grid of Communities */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {displayedCommunities.map((comm) => {
          const isMember = isMemberOf(comm);
          const isAdmin = comm.ownerId === user?.uid;
          const isOneSide = comm.chatPermission === 'one-side';

          return (
            <div
              key={comm.id}
              onClick={() => {
                if (isMember) {
                  setSelectedCommunity(comm);
                } else {
                  setShowJoinModal(true);
                }
              }}
              className="card cursor-pointer hover:shadow-md hover:border-indigo-300 transition-all flex flex-col justify-between border border-slate-200 group"
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold flex-shrink-0">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-base text-[--text] group-hover:text-[--primary] transition-colors truncate">
                        {comm.name}
                      </h3>
                      <p className="text-[11px] text-[--text-muted] truncate">
                        Admin: <span className="font-semibold text-slate-700">{comm.adminName || 'Faculty'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {isMember ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex-shrink-0">
                      {isAdmin ? 'Admin' : 'Joined ✓'}
                    </span>
                  ) : (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 flex-shrink-0 flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5 text-slate-400" />
                      Locked
                    </span>
                  )}
                </div>

                {/* Description */}
                <p className="text-xs text-[--text-muted] line-clamp-2 mt-2 leading-relaxed">
                  {comm.description}
                </p>

                {/* Badges */}
                <div className="flex flex-wrap items-center gap-1.5 mt-3.5">
                  {/* Chat Permission Badge */}
                  <span
                    className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full border flex items-center gap-1',
                      isOneSide
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    )}
                  >
                    {isOneSide ? <Radio className="h-2.5 w-2.5 text-amber-600" /> : <Users className="h-2.5 w-2.5 text-blue-600" />}
                    {isOneSide ? 'One-Side (Broadcast)' : 'Both-Side (Group)'}
                  </span>

                  {/* Target Audience Badge */}
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
                    <Building className="h-2.5 w-2.5 text-slate-400" />
                    {comm.targetAudience === 'dept' ? (comm.department || 'Department') : 'All Students'}
                  </span>
                </div>
              </div>

              {/* Card Footer */}
              <div className="pt-3 border-t border-slate-100 mt-4 flex items-center justify-between text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-[11px]">
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  {comm.memberCount || 1} members
                </span>

                {isAdmin || isFaculty ? (
                  <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    Code: {comm.secretCode || comm.inviteCode}
                  </span>
                ) : isMember ? (
                  <span className="text-[11px] font-semibold text-emerald-600">Open Chat →</span>
                ) : (
                  <span className="text-[11px] font-semibold text-[--primary] flex items-center gap-1">
                    <Key className="h-3 w-3" /> Enter Code
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {displayedCommunities.length === 0 && (
          <div className="col-span-full card text-center py-16 px-4">
            <MessageSquare className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <h3 className="font-semibold text-slate-700">No communities found</h3>
            <p className="text-xs text-[--text-muted] mt-1">
              {filterTab === 'my'
                ? "You haven't joined any communities yet. Click 'Join with Secret Code' above!"
                : 'No communities available currently.'}
            </p>
          </div>
        )}
      </div>

      {/* Creation Modal (Faculty Only) */}
      {showCreateModal && (
        <CreateCommunityModal
          currentUserName={user?.displayName || 'Faculty'}
          currentUserUid={user?.uid || ''}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(secretCode) => {
            setShowCreateModal(false);
            setCreatedSecretCode(secretCode);
          }}
        />
      )}

      {/* Join Community Modal */}
      {showJoinModal && (
        <JoinCommunityModal
          currentUserUid={user?.uid || ''}
          currentUserName={user?.displayName || 'Student'}
          onClose={() => setShowJoinModal(false)}
          onSuccess={(comm) => {
            setShowJoinModal(false);
            setSelectedCommunity(comm);
          }}
        />
      )}
    </div>
  );
}

// ── Faculty: Community Creation Modal Component ───────────────────────────────

interface CreateModalProps {
  currentUserName: string;
  currentUserUid: string;
  onClose: () => void;
  onSuccess: (secretCode: string) => void;
}

function CreateCommunityModal({
  currentUserName,
  currentUserUid,
  onClose,
  onSuccess,
}: CreateModalProps): React.ReactElement {
  const [submitting, setSubmitting] = useState(false);

  // Mandatory Form States
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [adminName, setAdminName] = useState(currentUserName);

  // Target Audience Selector
  const [targetAudience, setTargetAudience] = useState<'all' | 'dept'>('all');
  const [targetDept, setTargetDept] = useState('Computer Science');

  // Chat Permission Type
  const [chatPermission, setChatPermission] = useState<ChatPermissionType>('one-side');

  // Random alphanumeric secret code generator (6 characters, uppercase)
  const generateSecretCode = (): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error('Community Name is required');
      return;
    }
    if (!description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!adminName.trim()) {
      toast.error('Name of Admin is required');
      return;
    }

    setSubmitting(true);
    try {
      const secretCode = generateSecretCode();
      const normalizedDept = targetAudience === 'dept' ? normalizeDepartment(targetDept) : 'All';

      const payload: Partial<Community> & Record<string, any> = {
        name: name.trim(),
        description: description.trim(),
        adminName: adminName.trim(),
        targetAudience,
        department: normalizedDept,
        chatPermission,
        secretCode,
        inviteCode: secretCode,
        ownerId: currentUserUid,
        members: [currentUserUid],
        memberCount: 1,
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      const docRef = await addDoc(collection(db, 'communities'), payload);

      // Register creator as owner in members sub-collection
      await setDoc(doc(db, 'communities', docRef.id, 'members', currentUserUid), {
        id: currentUserUid,
        uid: currentUserUid,
        name: adminName.trim(),
        role: 'owner',
        joinedAt: serverTimestamp(),
      });

      toast.success(`Community "${name}" created! Secret Code: ${secretCode}`);
      onSuccess(secretCode);
    } catch (err: any) {
      console.error('Community creation error:', err);
      toast.error('Failed to create community: ' + (err.message || 'Error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="card max-w-lg w-full shadow-2xl border border-slate-200 bg-white p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 border-b border-slate-100 pb-3">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[--primary]">
            Faculty / HOD Only
          </span>
          <h2 className="text-lg font-bold text-[--text] flex items-center gap-2 mt-0.5">
            <Plus className="h-5 w-5 text-[--primary]" />
            Create New Community
          </h2>
          <p className="text-xs text-[--text-muted]">
            Build a closed channel with strict messaging rules and Secret Code joining.
          </p>
        </div>

        <form onSubmit={handleCreate} className="space-y-4">
          {/* Community Name */}
          <div>
            <label className="label">
              Community Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. CS Batch 2024, Robotics Team, Placement Alerts"
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Description */}
          <div>
            <label className="label">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              placeholder="Explain the purpose and guidelines of this communication group..."
              className="input py-2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Name of Admin */}
          <div>
            <label className="label">
              Name of Admin <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="e.g. Prof. Ramesh Sharma (HOD)"
                className="input pl-9"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
              />
              <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
            </div>
          </div>

          {/* Target Audience Selector */}
          <div>
            <label className="label">
              Target Audience <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <button
                type="button"
                onClick={() => setTargetAudience('all')}
                className={cn(
                  'p-2.5 rounded-lg border text-xs font-semibold text-center transition-all',
                  targetAudience === 'all'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                All Students
              </button>
              <button
                type="button"
                onClick={() => setTargetAudience('dept')}
                className={cn(
                  'p-2.5 rounded-lg border text-xs font-semibold text-center transition-all',
                  targetAudience === 'dept'
                    ? 'bg-blue-50 border-blue-500 text-blue-700 ring-2 ring-blue-200'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                )}
              >
                Specific Department
              </button>
            </div>

            {targetAudience === 'dept' && (
              <div className="mt-2.5 animate-fade-in">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Department</label>
                <select
                  className="input mt-1 font-medium text-xs"
                  value={targetDept}
                  onChange={(e) => setTargetDept(e.target.value)}
                >
                  {DEPT_OPTIONS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Chat Permission Type */}
          <div>
            <label className="label">
              Chat Permission Type <span className="text-red-500">*</span>
            </label>
            <div className="space-y-2 mt-1">
              {/* One-Side Chat (Broadcast) */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  chatPermission === 'one-side'
                    ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="radio"
                  name="chatPermission"
                  value="one-side"
                  checked={chatPermission === 'one-side'}
                  onChange={() => setChatPermission('one-side')}
                  className="mt-0.5 text-amber-600"
                />
                <div>
                  <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <Radio className="h-3.5 w-3.5 text-amber-600" />
                    One-Side Chat (Broadcast Mode)
                  </span>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Only the Admin ({adminName || 'creator'}) can write messages. Students can only read announcements.
                  </p>
                </div>
              </label>

              {/* Both-Side Chat (Group) */}
              <label
                className={cn(
                  'flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                  chatPermission === 'both-side'
                    ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-300'
                    : 'bg-white border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="radio"
                  name="chatPermission"
                  value="both-side"
                  checked={chatPermission === 'both-side'}
                  onChange={() => setChatPermission('both-side')}
                  className="mt-0.5 text-blue-600"
                />
                <div>
                  <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-blue-600" />
                    Both-Side Chat (Group Mode)
                  </span>
                  <p className="text-[11px] text-blue-800 mt-0.5">
                    All joined members can read and write messages freely, functioning like a group discussion.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Notice about Secret Code */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
            <span className="font-semibold text-slate-800">Auto-Join Disabled:</span> Students are not added
            automatically. A unique alphanumeric Secret Code will be generated and shown after creation.
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 font-semibold"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating Community...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create &amp; Generate Code
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Join Community Modal (Secret Code Input) ──────────────────────────────────

interface JoinModalProps {
  currentUserUid: string;
  currentUserName: string;
  onClose: () => void;
  onSuccess: (community: Community) => void;
}

function JoinCommunityModal({
  currentUserUid,
  currentUserName,
  onClose,
  onSuccess,
}: JoinModalProps): React.ReactElement {
  const [code, setCode] = useState('');
  const [joining, setJoining] = useState(false);

  const handleJoinSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const cleanCode = code.trim().toUpperCase();

    if (!cleanCode) {
      toast.error('Please enter the Secret Code');
      return;
    }

    setJoining(true);
    try {
      // Query communities by secretCode or inviteCode
      let q = query(collection(db, 'communities'), where('secretCode', '==', cleanCode));
      let snap = await getDocs(q);

      if (snap.empty) {
        q = query(collection(db, 'communities'), where('inviteCode', '==', cleanCode));
        snap = await getDocs(q);
      }

      if (snap.empty) {
        toast.error('Invalid Secret Code. Please check the code with your faculty/admin.');
        setJoining(false);
        return;
      }

      const commDoc = snap.docs[0];
      const commData = { ...commDoc.data(), id: commDoc.id } as Community;
      const existingMembers = commData.members || [];

      // Check if already a member
      if (existingMembers.includes(currentUserUid)) {
        toast.info(`You are already a member of ${commData.name}!`);
        onSuccess(commData);
        return;
      }

      // Append user's UID to members array and increment memberCount
      await updateDoc(doc(db, 'communities', commDoc.id), {
        members: arrayUnion(currentUserUid),
        memberCount: increment(1),
        updatedAt: serverTimestamp(),
      });

      // Also create record in members sub-collection for full compatibility
      await setDoc(doc(db, 'communities', commDoc.id, 'members', currentUserUid), {
        id: currentUserUid,
        uid: currentUserUid,
        name: currentUserName,
        role: 'member',
        joinedAt: serverTimestamp(),
      });

      toast.success(`Successfully joined ${commData.name}!`);
      onSuccess(commData);
    } catch (err: any) {
      console.error('Error joining community:', err);
      toast.error('Failed to join: ' + (err.message || 'Error'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="card max-w-md w-full shadow-2xl border border-slate-200 bg-white p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-4">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mb-2">
            <Key className="h-5 w-5" />
          </div>
          <h2 className="text-base font-bold text-[--text]">Join Community</h2>
          <p className="text-xs text-[--text-muted] mt-0.5">
            Enter the unique Secret Code provided by your Faculty or Department Admin.
          </p>
        </div>

        <form onSubmit={handleJoinSubmit} className="space-y-4">
          <div>
            <label className="label">Secret Code</label>
            <input
              type="text"
              required
              autoFocus
              maxLength={12}
              placeholder="e.g. 7X9K2P"
              className="input uppercase font-mono tracking-widest text-center text-lg font-bold py-2.5"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={joining}
              className="btn-secondary text-xs px-4 py-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={joining || !code.trim()}
              className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 font-semibold"
            >
              {joining ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Verifying...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Join Community
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── WhatsApp-like Chat Interface with Emoji, Image, Poll, Events ────────────────────

type MessageKind = 'text' | 'image' | 'poll' | 'event';

interface ExtMessage extends Message {
  kind?: MessageKind;
  imageUrl?: string;
  imageCaption?: string;
  pollQuestion?: string;
  pollOptions?: { id: string; text: string; votes: string[] }[];
  eventTitle?: string;
  eventDate?: string;
  eventTime?: string;
  eventLocation?: string;
  eventDesc?: string;
  reactions?: Record<string, string[]>; // emoji -> [uid]
}

interface ChatViewProps {
  community: Community;
  currentUserUid: string;
  currentUserName: string;
  isFaculty: boolean;
  onBack: () => void;
}

type ComposeMode = 'text' | 'image' | 'poll' | 'event';

const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🙏'];

function CommunityChatView({
  community,
  currentUserUid,
  currentUserName,
  isFaculty,
  onBack,
}: ChatViewProps): React.ReactElement {
  const [messages, setMessages] = useState<ExtMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [votingOptId, setVotingOptId] = useState<string | null>(null); // tracks which poll option is being voted
  const [composeMode, setComposeMode] = useState<ComposeMode>('text');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeEmojiGroup, setActiveEmojiGroup] = useState(0);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);

  // Image upload state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  // Poll state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);

  // Event state
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [eventTime, setEventTime] = useState('');
  const [eventLocation, setEventLocation] = useState('');
  const [eventDesc, setEventDesc] = useState('');

  const bottomRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement | null>(null);

  const isAdmin = community.ownerId === currentUserUid;
  const isOneSide = community.chatPermission === 'one-side';
  const canSendMessage = !isOneSide || isAdmin;

  // Real-time messages
  useEffect(() => {
    const q = query(
      collection(db, 'communities', community.id, 'messages'),
      orderBy('createdAt', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as ExtMessage[]);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }, (err) => console.warn('Messages listener:', err));
    return () => unsub();
  }, [community.id]);

  const resetCompose = () => {
    setText('');
    setComposeMode('text');
    setShowEmojiPicker(false);
    setImageFile(null);
    setImagePreview(null);
    setImageCaption('');
    setPollQuestion('');
    setPollOptions(['', '']);
    setEventTitle(''); setEventDate(''); setEventTime(''); setEventLocation(''); setEventDesc('');
  };

  // Send text / image / poll / event
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!canSendMessage) return;
    setSending(true);
    try {
      const base = {
        senderId: currentUserUid,
        senderName: currentUserName,
        senderRole: isAdmin ? 'Admin' : isFaculty ? 'Faculty' : 'Student',
        createdAt: serverTimestamp() as any,
        readBy: [currentUserUid],
        deleted: false,
        reactions: {},
      };

      if (composeMode === 'text') {
        if (!text.trim()) { setSending(false); return; }
        const msgRef = doc(collection(db, 'communities', community.id, 'messages'));
        await setDoc(msgRef, { id: msgRef.id, kind: 'text', text: text.trim(), ...base });

      } else if (composeMode === 'image' && imageFile) {
        // Upload image and store URL
        let imageUrl = imagePreview || '';
        // If Firebase Storage is configured, upload there; otherwise use base64 preview
        try {
          const storageRef = ref(storage, `community_images/${community.id}/${Date.now()}_${imageFile.name}`);
          const snapshot = await uploadBytes(storageRef, imageFile);
          imageUrl = await getDownloadURL(snapshot.ref);
        } catch {
          // fallback: use base64 preview directly (works without Storage rules setup)
          imageUrl = imagePreview || '';
        }
        const msgRef = doc(collection(db, 'communities', community.id, 'messages'));
        await setDoc(msgRef, { id: msgRef.id, kind: 'image', imageUrl, imageCaption, text: imageCaption || 'Photo', ...base });

      } else if (composeMode === 'poll') {
        if (!pollQuestion.trim()) { toast.error('Enter a poll question'); setSending(false); return; }
        const opts = pollOptions.filter(o => o.trim()).map((o, i) => ({ id: String(i), text: o.trim(), votes: [] }));
        if (opts.length < 2) { toast.error('Add at least 2 poll options'); setSending(false); return; }
        const msgRef = doc(collection(db, 'communities', community.id, 'messages'));
        await setDoc(msgRef, { id: msgRef.id, kind: 'poll', pollQuestion, pollOptions: opts, text: `📊 Poll: ${pollQuestion}`, ...base });

      } else if (composeMode === 'event') {
        if (!eventTitle.trim()) { toast.error('Enter event title'); setSending(false); return; }
        const msgRef = doc(collection(db, 'communities', community.id, 'messages'));
        await setDoc(msgRef, { id: msgRef.id, kind: 'event', eventTitle, eventDate, eventTime, eventLocation, eventDesc, text: `📅 Event: ${eventTitle}`, ...base });
      }

      resetCompose();
      textInputRef.current?.focus();
    } catch (err: any) {
      toast.error('Failed to send: ' + (err.message || 'Error'));
    } finally {
      setSending(false);
    }
  };

  // Vote on poll — uses a Firestore transaction to avoid race conditions
  const handlePollVote = async (msgId: string, optId: string) => {
    if (!currentUserUid) {
      toast.error('Please log in to vote.');
      return;
    }
    if (votingOptId) return; // prevent double-click
    setVotingOptId(optId);
    try {
      const msgRef = doc(db, 'communities', community.id, 'messages', msgId);
      let voteAdded = false;
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(msgRef);
        if (!snap.exists()) throw new Error('Message not found');
        const data = snap.data() as any;
        const opts: { id: string; text: string; votes: string[] }[] = data.pollOptions || [];

        const updatedOpts = opts.map(opt => {
          const votes = Array.isArray(opt.votes) ? opt.votes : [];
          const alreadyVoted = votes.includes(currentUserUid);
          if (opt.id === optId) {
            voteAdded = !alreadyVoted;
            // Toggle: remove if already voted, add if not
            return {
              ...opt,
              votes: alreadyVoted
                ? votes.filter(v => v !== currentUserUid)
                : [...votes, currentUserUid],
            };
          }
          // Single-vote: remove from all other options
          return { ...opt, votes: votes.filter(v => v !== currentUserUid) };
        });

        tx.update(msgRef, { pollOptions: updatedOpts });
      });
      toast.success(voteAdded ? 'Vote recorded!' : 'Vote removed');
    } catch (err: any) {
      console.error('Vote error:', err);
      toast.error('Failed to record vote. Please try again.');
    } finally {
      setVotingOptId(null);
    }
  };

  // React to message
  const handleReaction = async (msgId: string, emoji: string, currentReactions: Record<string, string[]> = {}) => {
    const uidList = currentReactions[emoji] || [];
    const hasReacted = uidList.includes(currentUserUid);
    await updateDoc(doc(db, 'communities', community.id, 'messages', msgId), {
      [`reactions.${emoji}`]: hasReacted ? arrayRemove(currentUserUid) : arrayUnion(currentUserUid),
    });
  };

  // Image file selection
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    setComposeMode('image');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && composeMode === 'text') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-130px)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
      {/* Chat Top Bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-[--primary] to-indigo-600 text-white flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onBack} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors" title="Back">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
            {community.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-sm sm:text-base truncate">{community.name}</h2>
            <p className="text-[11px] text-white/70 truncate">
              {community.memberCount || 1} members · {isOneSide ? 'Broadcast' : 'Group Chat'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(isAdmin || isFaculty) && (
            <div className="flex items-center gap-1 bg-white/20 px-2.5 py-1 rounded-lg text-xs">
              <span className="font-mono font-bold text-yellow-200">{community.secretCode || community.inviteCode}</span>
              <button onClick={() => { navigator.clipboard.writeText(community.secretCode || community.inviteCode || ''); toast.success('Code copied!'); }} className="hover:text-yellow-200">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-[#f0f2f5]">
        {messages.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="font-semibold text-slate-500 text-sm">No messages yet</p>
            <p className="text-xs text-slate-400 mt-1">{isOneSide ? 'The admin will broadcast announcements here.' : 'Start the conversation!'}</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMine = msg.senderId === currentUserUid;
            const reactions = (msg as any).reactions || {};
            const totalReactions = Object.values(reactions).reduce((s: number, arr) => s + (arr as string[]).length, 0);

            return (
              <div
                key={msg.id}
                className={cn('flex flex-col max-w-[82%] sm:max-w-[70%]', isMine ? 'ml-auto items-end' : 'mr-auto items-start')}
                onMouseEnter={() => setHoveredMsgId(msg.id)}
                onMouseLeave={() => setHoveredMsgId(null)}
              >
                {/* Sender name */}
                {!isMine && (
                  <span className="text-[11px] font-bold text-indigo-600 mb-0.5 px-1">{msg.senderName}</span>
                )}

                {/* Message bubble */}
                <div className={cn(
                  'relative rounded-2xl shadow-sm overflow-hidden',
                  isMine ? 'bg-[--primary] text-white rounded-tr-sm' : 'bg-white text-slate-800 rounded-tl-sm border border-slate-200/80'
                )}>
                  {/* Image message */}
                  {msg.kind === 'image' && (msg as any).imageUrl && (
                    <div>
                      <img src={(msg as any).imageUrl} alt="Shared" className="max-w-[280px] max-h-[200px] object-cover w-full" />
                      {(msg as any).imageCaption && (
                        <p className={cn('text-xs px-3 py-1.5', isMine ? 'text-white/90' : 'text-slate-600')}>{(msg as any).imageCaption}</p>
                      )}
                    </div>
                  )}

                  {/* Poll message */}
                  {msg.kind === 'poll' && (msg as any).pollOptions && (
                    <div className="p-3 min-w-[220px] max-w-[300px]">
                      <p className={cn('font-bold text-sm mb-3 flex items-center gap-1.5', isMine ? 'text-white' : 'text-slate-800')}>
                        <BarChart2 className="h-4 w-4" />
                        {(msg as any).pollQuestion}
                      </p>
                      <div className="space-y-2">
                        {((msg as any).pollOptions as { id: string; text: string; votes: string[] }[]).map(opt => {
                          const totalVotes = ((msg as any).pollOptions as any[]).reduce((s: number, o: any) => s + o.votes.length, 0);
                          const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
                          const voted = opt.votes.includes(currentUserUid);
                          return (
                            <button
                              key={opt.id}
                              onClick={() => handlePollVote(msg.id, opt.id)}
                              disabled={votingOptId !== null}
                              className={cn(
                                'w-full text-left rounded-lg overflow-hidden border transition-all relative',
                                voted ? 'border-indigo-400' : 'border-slate-200',
                                votingOptId === opt.id ? 'opacity-60 cursor-wait' : 'cursor-pointer',
                                'bg-white/10'
                              )}
                            >
                              <div
                                className={cn('absolute inset-y-0 left-0 transition-all', voted ? 'bg-indigo-500/30' : 'bg-slate-100/50')}
                                style={{ width: `${pct}%` }}
                              />
                              <div className="relative flex items-center justify-between px-2.5 py-1.5">
                                <span className={cn('text-xs font-medium', isMine ? 'text-white' : 'text-slate-700')}>{opt.text}</span>
                                <span className={cn('text-[10px] font-bold', isMine ? 'text-white/70' : 'text-slate-500')}>{pct}%</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      <p className={cn('text-[10px] mt-2', isMine ? 'text-white/60' : 'text-slate-400')}>
                        {((msg as any).pollOptions as any[]).reduce((s: number, o: any) => s + o.votes.length, 0)} votes
                      </p>
                    </div>
                  )}

                  {/* Event message */}
                  {msg.kind === 'event' && (
                    <div className="p-3 min-w-[220px] max-w-[300px]">
                      <div className={cn('flex items-center gap-2 mb-2', isMine ? 'text-white' : 'text-indigo-600')}>
                        <Calendar className="h-4 w-4" />
                        <span className="font-bold text-sm">{(msg as any).eventTitle}</span>
                      </div>
                      {(msg as any).eventDate && (
                        <p className={cn('text-xs flex items-center gap-1.5 mt-1', isMine ? 'text-white/80' : 'text-slate-600')}>
                          <Clock className="h-3 w-3" />
                          {(msg as any).eventDate}{(msg as any).eventTime ? ` at ${(msg as any).eventTime}` : ''}
                        </p>
                      )}
                      {(msg as any).eventLocation && (
                        <p className={cn('text-xs flex items-center gap-1.5 mt-1', isMine ? 'text-white/80' : 'text-slate-600')}>
                          <MapPin className="h-3 w-3" />
                          {(msg as any).eventLocation}
                        </p>
                      )}
                      {(msg as any).eventDesc && (
                        <p className={cn('text-xs mt-2 leading-relaxed', isMine ? 'text-white/70' : 'text-slate-500')}>{(msg as any).eventDesc}</p>
                      )}
                    </div>
                  )}

                  {/* Regular text message */}
                  {(msg.kind === 'text' || !msg.kind) && msg.text && (
                    <p className={cn('text-xs sm:text-sm leading-relaxed whitespace-pre-wrap px-3.5 py-2.5', isMine ? 'text-white' : 'text-slate-800')}>
                      {msg.text}
                    </p>
                  )}

                  {/* Timestamp */}
                  <p className={cn('text-[10px] px-3 pb-1.5 text-right', isMine ? 'text-white/50' : 'text-slate-400')}>
                    {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </p>
                </div>

                {/* Reactions display */}
                {totalReactions > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1 px-1">
                    {Object.entries(reactions).filter(([, arr]) => (arr as string[]).length > 0).map(([emoji, arr]) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji, reactions)}
                        className={cn(
                          'flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded-full border transition-all',
                          (arr as string[]).includes(currentUserUid)
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                        )}
                      >
                        {emoji} <span className="font-semibold">{(arr as string[]).length}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Quick Reaction Bar (on hover) */}
                {hoveredMsgId === msg.id && (
                  <div className={cn('flex gap-1 mt-1 px-1', isMine ? 'justify-end' : 'justify-start')}>
                    {QUICK_REACTIONS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji, reactions)}
                        className="text-base hover:scale-125 transition-transform p-0.5 rounded-full hover:bg-white/80"
                        title={`React with ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Compose Area */}
      {canSendMessage ? (
        <div className="flex-shrink-0 bg-white border-t border-slate-200">

          {/* Compose Mode panels */}
          {composeMode === 'image' && imagePreview && (
            <div className="p-3 bg-slate-50 border-b border-slate-200">
              <div className="flex items-start gap-3">
                <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-xl border border-slate-200" />
                <div className="flex-1">
                  <p className="text-xs font-semibold text-slate-700 mb-1">Photo Preview</p>
                  <input
                    type="text"
                    placeholder="Add a caption..."
                    value={imageCaption}
                    onChange={e => setImageCaption(e.target.value)}
                    className="input text-xs py-1.5 w-full"
                  />
                </div>
                <button onClick={resetCompose} className="p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
            </div>
          )}

          {composeMode === 'poll' && (
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><BarChart2 className="h-3.5 w-3.5 text-indigo-600" /> Create Poll</p>
                <button onClick={resetCompose} className="p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
              <input type="text" placeholder="Poll question..." value={pollQuestion} onChange={e => setPollQuestion(e.target.value)} className="input text-xs py-1.5 w-full" />
              <div className="space-y-1.5">
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Option ${i + 1}...`}
                      value={opt}
                      onChange={e => setPollOptions(prev => prev.map((p, j) => j === i ? e.target.value : p))}
                      className="input text-xs py-1.5 flex-1"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => setPollOptions(prev => prev.filter((_, j) => j !== i))} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 6 && (
                  <button onClick={() => setPollOptions(prev => [...prev, ''])} className="text-[11px] text-indigo-600 font-semibold flex items-center gap-1 hover:text-indigo-800">
                    <PlusCircle className="h-3.5 w-3.5" /> Add option
                  </button>
                )}
              </div>
            </div>
          )}

          {composeMode === 'event' && (
            <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-green-600" /> Create Event</p>
                <button onClick={resetCompose} className="p-1 text-slate-400 hover:text-red-500"><X className="h-4 w-4" /></button>
              </div>
              <input type="text" placeholder="Event title *" value={eventTitle} onChange={e => setEventTitle(e.target.value)} className="input text-xs py-1.5 w-full" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="input text-xs py-1.5" />
                <input type="time" value={eventTime} onChange={e => setEventTime(e.target.value)} className="input text-xs py-1.5" />
              </div>
              <input type="text" placeholder="Location (optional)" value={eventLocation} onChange={e => setEventLocation(e.target.value)} className="input text-xs py-1.5 w-full" />
              <textarea placeholder="Description (optional)" value={eventDesc} onChange={e => setEventDesc(e.target.value)} rows={2} className="input text-xs py-1.5 w-full resize-none" />
            </div>
          )}

          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div className="bg-white border-t border-slate-200 shadow-lg" style={{ maxHeight: 240, overflow: 'hidden' }}>
              {/* Emoji Group Tabs */}
              <div className="flex gap-1 px-3 pt-2 border-b border-slate-100 overflow-x-auto pb-1">
                {EMOJI_GROUPS.map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveEmojiGroup(i)}
                    className={cn('text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap transition-all',
                      activeEmojiGroup === i ? 'bg-[--primary] text-white' : 'text-slate-500 hover:bg-slate-100'
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-0.5 p-3 overflow-y-auto" style={{ maxHeight: 170 }}>
                {EMOJI_GROUPS[activeEmojiGroup].emojis.map((emoji, i) => (
                  <button
                    key={i}
                    onClick={() => { setText(prev => prev + emoji); setShowEmojiPicker(false); textInputRef.current?.focus(); }}
                    className="text-xl hover:bg-slate-100 rounded p-1 transition-colors"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Main Input Bar */}
          <div className="flex items-center gap-2 px-3 py-2.5">
            {/* Hidden image input */}
            <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageSelect} />

            {/* Attachment tools */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setShowEmojiPicker(prev => !prev); setComposeMode('text'); }}
                title="Emoji"
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-amber-500 transition-colors"
              >
                <Smile className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                title="Photo"
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 hover:text-green-500 transition-colors"
              >
                <Image className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => { setComposeMode(prev => prev === 'poll' ? 'text' : 'poll'); setShowEmojiPicker(false); }}
                title="Create Poll"
                className={cn('p-2 rounded-full transition-colors', composeMode === 'poll' ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500 hover:text-indigo-500')}
              >
                <BarChart2 className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => { setComposeMode(prev => prev === 'event' ? 'text' : 'event'); setShowEmojiPicker(false); }}
                title="Create Event"
                className={cn('p-2 rounded-full transition-colors', composeMode === 'event' ? 'bg-green-100 text-green-600' : 'hover:bg-slate-100 text-slate-500 hover:text-green-500')}
              >
                <Calendar className="h-5 w-5" />
              </button>
            </div>

            {/* Text input */}
            <input
              ref={textInputRef}
              type="text"
              placeholder={composeMode === 'text' ? (isOneSide ? 'Broadcast to group...' : 'Type a message...') : `Ready to send ${composeMode}...`}
              className="flex-1 bg-slate-100 rounded-full px-4 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-indigo-300 transition-all border border-transparent focus:border-indigo-300"
              value={text}
              onChange={e => { setText(e.target.value); if (composeMode !== 'text') setComposeMode('text'); }}
              onKeyDown={handleKeyDown}
              disabled={sending || (composeMode !== 'text')}
            />

            {/* Send Button */}
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={sending || (composeMode === 'text' && !text.trim()) || (composeMode === 'image' && !imageFile) || (composeMode === 'poll' && !pollQuestion.trim()) || (composeMode === 'event' && !eventTitle.trim())}
              className="btn-primary rounded-full h-11 w-11 p-0 flex items-center justify-center flex-shrink-0 disabled:opacity-50 bg-gradient-to-br from-[--primary] to-indigo-600 shadow-md hover:shadow-lg transition-shadow"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-amber-50 border-t border-amber-200 flex items-center justify-center gap-2 text-xs text-amber-800 font-medium">
          <Lock className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span><strong>Broadcast Channel:</strong> Only the Admin ({community.adminName || 'Faculty'}) can write messages.</span>
        </div>
      )}
    </div>
  );
}
