import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { inboxCol } from '@/lib/firestore';
import { onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle2 } from 'lucide-react';
import type { InboxItem, NotificationTargetType } from '@/types/firestore';

const sendNotification = httpsCallable(functions, 'sendNotification');

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

function StudentInbox({ studentId }: { studentId: string }) {
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(inboxCol(studentId), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setInbox(snap.docs.map(d => d.data()));
        setLoading(false);
      },
      (err) => {
        console.warn('Inbox listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [studentId]);

  const markAsRead = async (msgId: string) => {
    try {
      await updateDoc(doc(inboxCol(studentId), msgId), { read: true });
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[--primary]" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="page-title">Notifications</h1>
        <p className="text-sm text-[--text-muted] mt-1">Your personal inbox for college updates.</p>
      </div>

      <div className="space-y-4">
        {inbox.length === 0 ? (
          <div className="card text-center text-[--text-muted] p-10">You have no notifications.</div>
        ) : (
          inbox.map(item => (
            <div key={item.id} className={`card ${item.read ? 'opacity-70' : 'border-l-4 border-l-blue-500'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className={`font-semibold ${!item.read ? 'text-[--primary]' : 'text-[--text]'}`}>{item.title}</h3>
                  <p className="text-sm text-[--text-muted] mt-1 whitespace-pre-wrap">{item.message}</p>
                  <p className="text-xs text-gray-400 mt-3">
                    {item.createdAt?.toDate().toLocaleString()}
                  </p>
                </div>
                {!item.read && (
                  <button onClick={() => markAsRead(item.id)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Mark Read
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function FacultySender() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<NotificationTargetType>('all');
  const [targetValue, setTargetValue] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const payload: any = {
        title,
        message,
        target: { type: targetType }
      };

      if (targetType === 'dept') {
        payload.target.deptIds = targetValue.split(',').map(s => s.trim().toLowerCase());
      } else if (targetType === 'division') {
        payload.target.divisions = targetValue.split(',').map(s => s.trim().toUpperCase());
      } else if (targetType === 'students') {
        payload.target.studentIds = targetValue.split(',').map(s => s.trim().toLowerCase());
      }

      await sendNotification(payload);
      toast.success('Notification dispatched successfully');
      setTitle('');
      setMessage('');
      setTargetValue('');
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to send notification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="page-title">Send Notification</h1>
        <p className="text-sm text-[--text-muted] mt-1">Broadcast targeted updates to students.</p>
      </div>

      <div className="card">
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input required className="input" value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Message</label>
            <textarea required className="input min-h-[100px]" value={message} onChange={e => setMessage(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Target Audience</label>
              <select className="input" value={targetType} onChange={e => setTargetType(e.target.value as any)}>
                <option value="all">All Students</option>
                <option value="dept">Specific Departments</option>
                <option value="division">Specific Divisions</option>
                <option value="students">Specific Students</option>
              </select>
            </div>
            {targetType !== 'all' && (
              <div>
                <label className="label">
                  {targetType === 'dept' ? 'Department Codes (e.g. cse, ece)' : 
                   targetType === 'division' ? 'Divisions (e.g. A, B)' : 
                   'Student IDs'}
                </label>
                <input required className="input" placeholder="Comma separated..." value={targetValue} onChange={e => setTargetValue(e.target.value)} />
              </div>
            )}
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full flex justify-center items-center gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Dispatch Notification
          </button>
        </form>
      </div>
    </div>
  );
}
