import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { studentProfileDoc } from '@/lib/firestore';
import { onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, Link as LinkIcon, UserCircle, BookOpen, Lock } from 'lucide-react';
import type { Skill, PrivacyLevel, PlacementInterest, ProfilePrivacy } from '@/types/firestore';

export default function ProfilePage(): React.ReactElement {
  const { claims } = useAuth();
  const studentId = claims?.studentId;
  const isStudent = claims?.roles.includes('STUDENT');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form states
  const [bio, setBio] = useState('');
  const [skills, setSkills] = useState<Skill[]>([]);
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [placementInterest, setPlacementInterest] = useState<PlacementInterest>('maybe');
  const [privacy, setPrivacy] = useState<ProfilePrivacy>({
    skills: 'everyone',
    achievements: 'everyone',
    links: 'everyone',
    bio: 'everyone'
  });

  // Fetch real-time profile
  useEffect(() => {
    if (!isStudent || !studentId) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(
      studentProfileDoc(studentId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setBio(data.bio || '');
          setSkills(data.skills || []);
          setGithub(data.links?.github || '');
          setLinkedin(data.links?.linkedin || '');
          setPortfolio(data.links?.portfolio || '');
          setPlacementInterest(data.placementInterest || 'maybe');
          setPrivacy(data.privacy || {
            skills: 'everyone', achievements: 'everyone', links: 'everyone', bio: 'everyone'
          });
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Profile listener error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [studentId, isStudent]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentId) return;

    setSaving(true);
    try {
      const skillKeys = skills.map(s => s.name.toLowerCase());
      await setDoc(studentProfileDoc(studentId), {
        bio,
        skills,
        skillKeys,
        links: {
          github: github || '',
          linkedin: linkedin || '',
          portfolio: portfolio || ''
        },
        placementInterest,
        privacy: privacy as any,
        updatedAt: serverTimestamp()
      }, { merge: true });

      toast.success('Profile updated successfully');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const addSkill = (name: string, level: any) => {
    if (!name.trim()) return;
    if (skills.find(s => s.name.toLowerCase() === name.toLowerCase())) return;
    setSkills([...skills, { name: name.trim(), level }]);
  };

  const removeSkill = (name: string) => {
    setSkills(skills.filter(s => s.name !== name));
  };

  if (!isStudent) {
    return <div className="p-6">Only students can access this page.</div>;
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[--primary]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Manage your skills, bio, links, and privacy settings.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Bio Section */}
            <div className="card space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <UserCircle className="h-5 w-5 text-[--primary]" />
                About Me
              </h2>
              <div>
                <label className="label">Bio</label>
                <textarea
                  className="input min-h-[100px]"
                  placeholder="Write a short bio..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={300}
                />
                <p className="text-xs text-right mt-1 text-[--text-muted]">{bio.length}/300</p>
              </div>
            </div>

            {/* Links Section */}
            <div className="card space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <LinkIcon className="h-5 w-5 text-[--primary]" />
                Links
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">GitHub URL</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://github.com/..."
                    value={github}
                    onChange={(e) => setGithub(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">LinkedIn URL</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://linkedin.com/in/..."
                    value={linkedin}
                    onChange={(e) => setLinkedin(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Portfolio Website</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://..."
                    value={portfolio}
                    onChange={(e) => setPortfolio(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Skills Section */}
            <div className="card space-y-4">
              <h2 className="section-title flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-[--primary]" />
                Skills
              </h2>
              <div className="flex gap-2">
                <input
                  id="newSkill"
                  className="input flex-1"
                  placeholder="e.g. React, Python"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addSkill(e.currentTarget.value, 'Intermediate');
                      e.currentTarget.value = '';
                    }
                  }}
                />
                <button 
                  type="button" 
                  className="btn-secondary"
                  onClick={() => {
                    const input = document.getElementById('newSkill') as HTMLInputElement;
                    addSkill(input.value, 'Intermediate');
                    input.value = '';
                  }}
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2 mt-4">
                {skills.map(skill => (
                  <span key={skill.name} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-md text-sm border border-blue-200">
                    {skill.name}
                    <button type="button" onClick={() => removeSkill(skill.name)} className="hover:text-blue-900 font-bold ml-1">×</button>
                  </span>
                ))}
                {skills.length === 0 && <p className="text-sm text-[--text-muted]">No skills added yet.</p>}
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary w-full flex justify-center items-center gap-2"
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Profile Changes'}
            </button>
          </form>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="section-title flex items-center gap-2">
              <Lock className="h-5 w-5 text-[--primary]" />
              Privacy & Preferences
            </h2>
            
            <div>
              <label className="label">Placement Interest</label>
              <select 
                className="input" 
                value={placementInterest}
                onChange={(e) => setPlacementInterest(e.target.value as PlacementInterest)}
              >
                <option value="yes">Actively Looking</option>
                <option value="maybe">Open to Offers</option>
                <option value="no">Not Interested</option>
              </select>
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className="label">Bio Privacy</label>
              <select 
                className="input" 
                value={privacy.bio}
                onChange={(e) => setPrivacy({...privacy, bio: e.target.value as PrivacyLevel})}
              >
                <option value="everyone">Everyone</option>
                <option value="faculty">Faculty Only</option>
              </select>
            </div>
            
            <div>
              <label className="label">Skills Privacy</label>
              <select 
                className="input" 
                value={privacy.skills}
                onChange={(e) => setPrivacy({...privacy, skills: e.target.value as PrivacyLevel})}
              >
                <option value="everyone">Everyone</option>
                <option value="faculty">Faculty Only</option>
              </select>
            </div>

            <p className="text-xs text-[--text-muted]">
              Faculty and HODs can always see your profile details regardless of privacy settings. 
              These settings control what other students can see.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
