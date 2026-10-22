import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { toast } from 'sonner';
import { Loader2, Search, Briefcase } from 'lucide-react';
import type { PlacementInterest, Skill } from '@/types/firestore';

const searchTalentCall = httpsCallable(functions, 'searchTalent');

interface TalentResult {
  id: string;
  name: string;
  deptId?: string;
  batch?: string;
  cgpa?: number;
  profile: {
    bio: string;
    skills: Skill[];
    placementInterest: PlacementInterest;
    links: { github?: string; linkedin?: string; portfolio?: string };
    photoUrl?: string;
  };
}

export default function TalentPage(): React.ReactElement {
  const { claims } = useAuth();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  const [skills, setSkills] = useState('');
  const [placement, setPlacement] = useState<PlacementInterest | 'Any'>('Any');
  const [minCgpa, setMinCgpa] = useState<number | ''>('');
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TalentResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isFaculty) {
    return <div className="p-10 text-center text-[--text-muted]">Only faculty can access Talent Search.</div>;
  }

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setHasSearched(true);

    try {
      const skillsArray = skills.split(',').map(s => s.trim()).filter(Boolean);
      
      const payload: any = {};
      if (skillsArray.length > 0) payload.skills = skillsArray;
      if (placement !== 'Any') payload.placementInterest = placement;
      if (minCgpa !== '') payload.minCgpa = Number(minCgpa);

      const res = await searchTalentCall(payload);
      const data = res.data as { results: TalentResult[] };
      setResults(data.results || []);
    } catch (err: any) {
      console.error(err);
      const msg = err.details ? (Array.isArray(err.details) ? err.details.map((d: any) => d.message).join(', ') : err.details) : err.message;
      toast.error(msg || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="page-title">Talent Search</h1>
        <p className="text-sm text-[--text-muted] mt-1">Discover students based on skills and criteria.</p>
      </div>

      <div className="card">
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Skills (comma separated)</label>
              <input 
                className="input" 
                placeholder="e.g. React, Python, Machine Learning" 
                value={skills} 
                onChange={e => setSkills(e.target.value)} 
              />
            </div>
            <div>
              <label className="label">Minimum CGPA</label>
              <input 
                type="number" 
                step="0.01" 
                min="0" 
                max="10" 
                className="input" 
                placeholder="e.g. 7.5" 
                value={minCgpa} 
                onChange={e => setMinCgpa(e.target.value === '' ? '' : Number(e.target.value))} 
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Placement Interest</label>
              <select className="input" value={placement} onChange={e => setPlacement(e.target.value as any)}>
                <option value="Any">Any</option>
                <option value="Actively Looking">Actively Looking</option>
                <option value="Open to Offers">Open to Offers</option>
                <option value="Not Interested">Not Interested</option>
              </select>
            </div>
            <div className="flex items-end">
              <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Search
              </button>
            </div>
          </div>
        </form>
      </div>

      {hasSearched && (
        <div className="space-y-4 mt-8">
          <h2 className="section-title">Results ({results.length})</h2>
          
          {results.length === 0 ? (
            <div className="text-center p-10 text-[--text-muted] bg-white rounded-xl border border-gray-100">
              No students found matching these criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {results.map(student => (
                <div key={student.id} className="card hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-[--text]">{student.name}</h3>
                      <p className="text-xs font-medium text-[--text-muted] uppercase tracking-wider">
                        {student.deptId} • {student.batch} • {student.id}
                      </p>
                    </div>
                    {student.cgpa !== undefined && (
                      <div className="text-right">
                        <span className="text-xs text-[--text-muted] block">CGPA</span>
                        <span className="font-bold text-blue-600">{student.cgpa.toFixed(2)}</span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{student.profile.bio || 'No bio provided.'}</p>

                  <div className="mb-4 flex flex-wrap gap-1">
                    {student.profile.skills?.map((skill, idx) => (
                      <span key={idx} className="badge-secondary text-xs">{skill.name}</span>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Briefcase className="h-4 w-4" />
                      {student.profile.placementInterest}
                    </div>
                    <div className="flex gap-3">
                      {student.profile.links?.github && (
                        <a href={student.profile.links.github} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-gray-800">
                          GitHub
                        </a>
                      )}
                      {student.profile.links?.linkedin && (
                        <a href={student.profile.links.linkedin} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700">
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
