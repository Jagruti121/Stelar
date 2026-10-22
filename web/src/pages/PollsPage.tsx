import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { pollsCol, pollVotesCol } from '@/lib/firestore';
import { onSnapshot, query, orderBy, setDoc, doc, serverTimestamp, getDoc } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Plus, Users, Send } from 'lucide-react';
import type { Poll, PollOption } from '@/types/firestore';

export default function PollsPage(): React.ReactElement {
  const { user, claims } = useAuth();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  const [polls, setPolls] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const q = query(pollsCol(), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        setPolls(snap.docs.map(d => d.data()));
        setLoading(false);
      },
      (err) => {
        console.warn('Polls listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-[--primary]" /></div>;

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="page-title">Live Polls</h1>
          <p className="text-sm text-[--text-muted] mt-1">Engage and collect feedback instantly.</p>
        </div>
      </div>

      {isFaculty && <CreatePollForm />}

      <div className="space-y-4">
        {polls.length === 0 ? (
          <div className="card text-center p-10 text-[--text-muted]">No active polls.</div>
        ) : (
          polls.map(poll => (
            <PollCard 
              key={poll.id} 
              poll={poll} 
              isFaculty={isFaculty || false} 
              userId={user?.uid} 
              studentId={claims?.studentId as string} 
            />
          ))
        )}
      </div>
    </div>
  );
}

function CreatePollForm() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [submitting, setSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const validOptions = options.filter(o => o.trim() !== '');
    if (validOptions.length < 2) {
      toast.error('Please provide at least 2 options');
      return;
    }
    
    setSubmitting(true);
    try {
      const newRef = doc(pollsCol());
      const pollOptions: PollOption[] = validOptions.map((text, idx) => ({
        id: `opt_${idx}`,
        text: text.trim(),
        count: 0
      }));

      await setDoc(newRef, {
        id: newRef.id,
        question,
        options: pollOptions,
        target: { deptIds: [], divisions: [] }, // all for demo
        anonymous: true,
        createdBy: user?.uid as string,
        createdAt: serverTimestamp() as any
      });
      
      toast.success('Poll created!');
      setIsOpen(false);
      setQuestion('');
      setOptions(['', '']);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to create poll');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button onClick={() => setIsOpen(true)} className="btn-primary flex items-center gap-2 mb-6">
        <Plus className="h-4 w-4" /> Create New Poll
      </button>
    );
  }

  return (
    <div className="card mb-6 border-blue-200 shadow-md">
      <h3 className="section-title mb-4">Create New Poll</h3>
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="label">Question</label>
          <input required className="input font-medium" value={question} onChange={e => setQuestion(e.target.value)} placeholder="What should be the theme for..." />
        </div>
        <div className="space-y-2">
          <label className="label">Options</label>
          {options.map((opt, idx) => (
            <input 
              key={idx} 
              className="input" 
              placeholder={`Option ${idx + 1}`} 
              value={opt} 
              onChange={e => {
                const newOpts = [...options];
                newOpts[idx] = e.target.value;
                setOptions(newOpts);
              }} 
            />
          ))}
          <button type="button" onClick={() => setOptions([...options, ''])} className="text-sm text-[--primary] hover:underline">
            + Add Option
          </button>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={() => setIsOpen(false)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={submitting} className="btn-primary flex items-center gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish Poll
          </button>
        </div>
      </form>
    </div>
  );
}

function PollCard({ poll, isFaculty, userId, studentId }: { poll: Poll, isFaculty: boolean, userId?: string, studentId?: string }) {
  const [hasVoted, setHasVoted] = useState(false);
  const [voting, setVoting] = useState(false);

  const voterDocId = userId || studentId;

  useEffect(() => {
    if (isFaculty || !voterDocId) return;
    const checkVote = async () => {
      const candidateIds = [userId, studentId].filter(Boolean) as string[];
      for (const cid of candidateIds) {
        try {
          const v = await getDoc(doc(pollVotesCol(poll.id), cid));
          if (v.exists()) {
            setHasVoted(true);
            return;
          }
        } catch {
          // ignore
        }
      }
    };
    checkVote();
  }, [poll.id, isFaculty, userId, studentId, voterDocId]);

  const totalVotes = poll.options.reduce((acc, curr) => acc + curr.count, 0);

  const castVote = async (optionId: string) => {
    if (!voterDocId || hasVoted) return;
    setVoting(true);
    try {
      await setDoc(doc(pollVotesCol(poll.id), voterDocId), {
        id: voterDocId,
        optionId,
        studentId: studentId || voterDocId,
        authUid: userId || voterDocId,
        createdAt: serverTimestamp()
      });
      setHasVoted(true);
      toast.success('Vote recorded!');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to vote');
    } finally {
      setVoting(false);
    }
  };

  const showResults = isFaculty || hasVoted;

  return (
    <div className="card space-y-4">
      <div className="flex justify-between items-start">
        <h3 className="font-semibold text-lg text-[--text]">{poll.question}</h3>
        {showResults && (
          <span className="badge-primary flex items-center gap-1">
            <Users className="h-3 w-3" /> {totalVotes} Votes
          </span>
        )}
      </div>

      <div className="space-y-2 mt-4">
        {poll.options.map(opt => {
          const percentage = totalVotes > 0 ? Math.round((opt.count / totalVotes) * 100) : 0;
          
          if (showResults) {
            return (
              <div key={opt.id} className="relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50/50 p-3">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-blue-100/50 z-0 transition-all duration-500 ease-out" 
                  style={{ width: `${percentage}%` }}
                />
                <div className="relative z-10 flex justify-between items-center text-sm">
                  <span className="font-medium text-[--text]">{opt.text}</span>
                  <span className="font-semibold text-[--primary]">{percentage}% <span className="text-gray-400 font-normal text-xs ml-1">({opt.count})</span></span>
                </div>
              </div>
            );
          }

          return (
            <button 
              key={opt.id}
              onClick={() => castVote(opt.id)}
              disabled={voting}
              className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition-colors text-sm font-medium text-[--text]"
            >
              {opt.text}
            </button>
          );
        })}
      </div>
      
      {!isFaculty && !hasVoted && (
        <p className="text-xs text-[--text-muted] mt-2">Results are hidden until you vote. Your vote is {poll.anonymous ? 'anonymous' : 'public'}.</p>
      )}
    </div>
  );
}
