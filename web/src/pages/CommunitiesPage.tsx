import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { communitiesCol, communityMessagesCol } from '@/lib/firestore';
import { onSnapshot, query, orderBy, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Loader2, Users, Plus, Send, Hash, ArrowLeft } from 'lucide-react';
import type { Community, Message } from '@/types/firestore';

const createCommunityCall = httpsCallable(functions, 'createCommunity');
const joinCommunityCall = httpsCallable(functions, 'joinCommunity');

export default function CommunitiesPage(): React.ReactElement {
  const { claims, user } = useAuth();
  const { inviteCode } = useParams<{ inviteCode?: string }>();
  const navigate = useNavigate();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  
  // Create state
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Join state
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    const q = query(communitiesCol(), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setCommunities(snap.docs.map(d => d.data()));
        setLoading(false);
      },
      (err) => {
        console.warn('Communities listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (inviteCode && !loading) {
      handleJoin(inviteCode);
    }
  }, [inviteCode, loading]);

  const handleJoin = async (code: string) => {
    setJoining(true);
    try {
      const res = await joinCommunityCall({ inviteCode: code });
      const data = res.data as any;
      toast.success(`Joined ${data.name}!`);
      const joinedComm = communities.find(c => c.id === data.id);
      if (joinedComm) setSelectedCommunity(joinedComm);
      navigate('/app/communities', { replace: true });
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to join community');
      navigate('/app/communities', { replace: true });
    } finally {
      setJoining(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (createName.trim().length < 2) {
      toast.error('Community name must be at least 2 characters');
      return;
    }
    setCreating(true);
    try {
      await createCommunityCall({
        name: createName.trim(),
        description: createDesc.trim(),
        restrictionType: 'invite'
      });
      toast.success('Community created!');
      setShowCreate(false);
      setCreateName('');
      setCreateDesc('');
    } catch (err: any) {
      console.error('Community creation error:', err);
      let msg = err.message || 'Failed to create community';
      if (Array.isArray(err.details)) {
        msg = err.details.map((d: any) => d.message).join(', ');
      } else if (err.details && typeof err.details === 'object' && err.details.message) {
        msg = err.details.message;
      }
      toast.error(msg);
    } finally {
      setCreating(false);
    }
  };

  if (loading || joining) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[--primary]" /></div>;
  }

  // If a community is selected, show the chat view (especially on mobile)
  if (selectedCommunity) {
    return (
      <div className="animate-fade-in flex flex-col h-[calc(100vh-140px)]">
        <div className="flex items-center gap-4 bg-white p-4 border-b border-gray-200">
          <button onClick={() => setSelectedCommunity(null)} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h2 className="font-bold text-lg text-[--text] flex items-center gap-1">
              <Hash className="h-5 w-5 text-gray-400" />
              {selectedCommunity.name}
            </h2>
            <p className="text-xs text-[--text-muted]">
              {selectedCommunity.memberCount} members • Invite Code: {selectedCommunity.inviteCode}
            </p>
          </div>
        </div>
        <ChatRoom communityId={selectedCommunity.id} uid={user?.uid as string} name={user?.displayName || 'User'} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title">Communities</h1>
          <p className="text-sm text-[--text-muted] mt-1">Join technical and creative groups.</p>
        </div>
        {isFaculty && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-primary flex items-center gap-2">
            <Plus className="h-4 w-4" /> New Community
          </button>
        )}
      </div>

      {showCreate && (
        <div className="card border-blue-200">
          <h3 className="section-title mb-4">Create Community</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="label">Community Name</label>
              <input 
                required 
                minLength={2}
                placeholder="e.g. Robotics Club, AI & Data Science, Cultural Committee"
                className="input" 
                value={createName} 
                onChange={e => setCreateName(e.target.value)} 
              />
            </div>
            <div>
              <label className="label">Description (Optional)</label>
              <input 
                placeholder="Brief description of the community"
                className="input" 
                value={createDesc} 
                onChange={e => setCreateDesc(e.target.value)} 
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={creating} className="btn-primary flex items-center gap-2">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />} Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {communities.map(comm => (
          <div 
            key={comm.id} 
            onClick={() => setSelectedCommunity(comm)}
            className="card cursor-pointer hover:border-blue-300 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-bold text-lg text-[--text] group-hover:text-[--primary] flex items-center gap-1">
                <Hash className="h-4 w-4 text-gray-400" />
                {comm.name}
              </h3>
            </div>
            <p className="text-sm text-[--text-muted] mt-2 line-clamp-2">{comm.description}</p>
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500 font-medium">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {comm.memberCount}</span>
              {isFaculty && <span className="text-blue-500">Code: {comm.inviteCode}</span>}
            </div>
          </div>
        ))}
        {communities.length === 0 && (
          <div className="col-span-full text-center p-10 text-[--text-muted]">No communities available.</div>
        )}
      </div>
    </div>
  );
}

function ChatRoom({ communityId, uid, name }: { communityId: string, uid: string, name: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(communityMessagesCol(communityId), orderBy('createdAt', 'asc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setMessages(snap.docs.map(d => d.data() as Message));
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      (err) => {
        console.warn('Community messages listener error:', err);
      }
    );
    return () => unsub();
  }, [communityId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const msg = text.trim();
    setText('');
    try {
      const newRef = doc(communityMessagesCol(communityId));
      await setDoc(newRef, {
        id: newRef.id,
        text: msg,
        senderId: uid,
        senderName: name,
        createdAt: serverTimestamp() as any,
        readBy: [uid],
        deleted: false
      });
    } catch (err) {
      console.error(err);
      toast.error('Failed to send message. You might not be a member.');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-slate-50 relative overflow-hidden">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => {
          const isMine = msg.senderId === uid;
          return (
            <div key={msg.id} className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
              <div className="flex items-baseline gap-2 mb-1 px-1">
                <span className="text-xs font-bold text-gray-500">{msg.senderName}</span>
                <span className="text-[10px] text-gray-400">
                  {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </span>
              </div>
              <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                isMine ? 'bg-[--primary] text-white rounded-tr-sm' : 'bg-white border border-gray-200 text-[--text] rounded-tl-sm'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSend} className="flex gap-2">
          <input 
            className="input flex-1 rounded-full px-6" 
            placeholder="Type a message..." 
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <button type="submit" disabled={!text.trim()} className="btn-primary rounded-full p-3 h-auto w-auto aspect-square flex items-center justify-center">
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
