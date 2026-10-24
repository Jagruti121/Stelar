/**
 * STELLAR — Student Profile Page (Feature 14)
 *
 * Upgrade to a comprehensive Digital Resume:
 * 1. Basic Information Fields:
 *    - Full Name (Text, mandatory)
 *    - Phone Number (Tel/Text, optional)
 *    - Home Address (Textarea, optional)
 *    - Bio / Description (Textarea, optional)
 *    - Experience (Dynamic list to add/remove multiple work/internship experiences)
 *    - Strictly binds to student's Firestore user document (`students/{studentId}`)
 *      and synchronizes with `studentProfiles/{studentId}`.
 *
 * 2. Standardized Skills Dropdown:
 *    - Searchable, multi-select categorized dropdown
 *    - Technical Skills: Python, MySQL, Power BI, Data Analytics, Data Science, React, Node.js, C++, Java, etc.
 *    - Non-Technical/Soft Skills: Communication, Leadership, Public Speaking, Event Management, Problem Solving, etc.
 *    - Stored as an array of strings (`string[]`) inside the `skills` field of the database document.
 */

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { studentDoc, studentProfileDoc, staffDoc } from '@/lib/firestore';
import { db } from '@/lib/firebase';
import { doc, updateDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Loader2,
  Link as LinkIcon,
  UserCircle,
  BookOpen,
  Lock,
  Briefcase,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Search,
  ChevronDown,
  Check,
  X,
  FileText,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import type { PrivacyLevel, PlacementInterest, ProfilePrivacy, Staff, StudentExperience } from '@/types/firestore';

// ── Standardized Skills Categorized Dataset ───────────────────────────────────

export interface SkillCategory {
  category: string;
  skills: string[];
}

export const STANDARDIZED_SKILLS: SkillCategory[] = [
  {
    category: 'Technical Skills',
    skills: [
      'Python',
      'MySQL',
      'Power BI',
      'Data Analytics',
      'Data Science',
      'React',
      'Node.js',
      'C++',
      'Java',
      'JavaScript',
      'TypeScript',
      'HTML/CSS',
      'Cloud Computing',
      'Docker',
      'Machine Learning',
      'Cybersecurity',
      'Git & GitHub',
      'Flutter',
      'Kotlin',
      'MongoDB',
      'SQL',
      'Spring Boot',
      'Django',
      'Express.js',
      'Next.js',
    ],
  },
  {
    category: 'Non-Technical / Soft Skills',
    skills: [
      'Communication',
      'Leadership',
      'Public Speaking',
      'Event Management',
      'Problem Solving',
      'Teamwork',
      'Time Management',
      'Critical Thinking',
      'Project Management',
      'Adaptability',
      'Negotiation',
      'Creativity',
      'Emotional Intelligence',
    ],
  },
];

export default function ProfilePage(): React.ReactElement {
  const { claims, user } = useAuth();
  const studentId = claims?.studentId;
  const isStudent = claims?.roles.includes('STUDENT');
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  // Route faculty/HOD to their staff profile
  if (isFaculty) {
    return <FacultyProfilePage uid={user?.uid || ''} />;
  }

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Basic Information States
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [bio, setBio] = useState('');
  const [experiences, setExperiences] = useState<StudentExperience[]>([]);

  // Standardized Skills (array of strings)
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  // Links & Settings States
  const [github, setGithub] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [portfolio, setPortfolio] = useState('');
  const [placementInterest, setPlacementInterest] = useState<PlacementInterest>('maybe');
  const [privacy, setPrivacy] = useState<ProfilePrivacy>({
    skills: 'everyone',
    achievements: 'everyone',
    links: 'everyone',
    bio: 'everyone',
  });

  // Fetch real-time student document & profile document
  useEffect(() => {
    if (!isStudent || !studentId) {
      setLoading(false);
      return;
    }

    // 1. Listen to `students/{studentId}` (the user document)
    const unsubStudent = onSnapshot(
      studentDoc(studentId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.name) setFullName(data.name);
          if (data.phone) setPhone(data.phone);
          if (data.address) setAddress(data.address);
          if (data.bio) setBio(data.bio);
          if (data.experience) {
            if (Array.isArray(data.experience)) {
              setExperiences(data.experience as StudentExperience[]);
            } else if (typeof data.experience === 'string' && data.experience.trim()) {
              setExperiences([{
                id: 'exp_1',
                title: 'Experience',
                company: 'Details',
                description: data.experience,
              }]);
            }
          }
          if (data.skills && Array.isArray(data.skills)) {
            // Normalize skills array
            const strSkills = data.skills.map((s: any) => (typeof s === 'string' ? s : s.name)).filter(Boolean);
            if (strSkills.length > 0) setSelectedSkills(strSkills);
          }
        }
      },
      (err) => console.warn('Student doc listener note:', err)
    );

    // 2. Listen to `studentProfiles/{studentId}`
    const unsubProfile = onSnapshot(
      studentProfileDoc(studentId),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.bio) setBio(data.bio);
          if (data.links?.github) setGithub(data.links.github);
          if (data.links?.linkedin) setLinkedin(data.links.linkedin);
          if (data.links?.portfolio) setPortfolio(data.links.portfolio);
          if (data.placementInterest) setPlacementInterest(data.placementInterest);
          if (data.privacy) setPrivacy(data.privacy);
          if (data.skills && Array.isArray(data.skills) && selectedSkills.length === 0) {
            const strSkills = data.skills.map((s: any) => (typeof s === 'string' ? s : s.name)).filter(Boolean);
            setSelectedSkills(strSkills);
          }
        }
        setLoading(false);
      },
      (err) => {
        console.warn('Profile listener error:', err);
        setLoading(false);
      }
    );

    return () => {
      unsubStudent();
      unsubProfile();
    };
  }, [studentId, isStudent]);

  const handleSave = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!studentId) return;

    if (!fullName.trim()) {
      toast.error('Full Name is required');
      return;
    }

    setSaving(true);
    try {
      const skillKeys = selectedSkills.map((s) => s.toLowerCase());

      // 1. Strictly bind and update the student's Firestore user document (`students/{studentId}`)
      await updateDoc(doc(db, 'students', studentId), {
        name: fullName.trim(),
        nameLower: fullName.trim().toLowerCase(),
        phone: phone.trim(),
        address: address.trim(),
        bio: bio.trim(),
        experience: experiences,
        skills: selectedSkills, // Stored strictly as array of strings
        skillKeys,
        updatedAt: serverTimestamp(),
      });

      // 2. Update `studentProfiles/{studentId}` for full compatibility
      await setDoc(
        doc(db, 'studentProfiles', studentId),
        {
          name: fullName.trim(),
          phone: phone.trim(),
          address: address.trim(),
          bio: bio.trim(),
          experience: experiences,
          skills: selectedSkills, // Stored strictly as array of strings
          skillKeys,
          links: {
            github: github.trim(),
            linkedin: linkedin.trim(),
            portfolio: portfolio.trim(),
          },
          placementInterest,
          privacy: privacy as any,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      toast.success('Profile and digital resume updated successfully!');
    } catch (err: any) {
      console.error('Error saving profile:', err);
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  // Add a new empty experience entry
  const addExperience = () => {
    const newEntry: StudentExperience = {
      id: `exp_${Date.now()}`,
      title: '',
      company: '',
      duration: '',
      description: '',
    };
    setExperiences([...experiences, newEntry]);
  };

  // Update a specific experience entry
  const updateExperienceItem = (id: string, field: keyof StudentExperience, value: string) => {
    setExperiences(
      experiences.map((exp) => (exp.id === id ? { ...exp, [field]: value } : exp))
    );
  };

  // Remove an experience entry
  const removeExperience = (id: string) => {
    setExperiences(experiences.filter((exp) => exp.id !== id));
  };

  // Toggle skill selection
  const toggleSkill = (skillName: string) => {
    if (selectedSkills.includes(skillName)) {
      setSelectedSkills(selectedSkills.filter((s) => s !== skillName));
    } else {
      setSelectedSkills([...selectedSkills, skillName]);
    }
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
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <UserCircle className="h-6 w-6 text-[--primary]" />
          Student Profile &amp; Digital Resume
        </h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Manage your personal details, career experience, and standardized skills for campus placements.
        </p>
      </div>

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main 2-Column Form Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* 1. Basic Information Section */}
          <div className="card space-y-4 border border-slate-200">
            <h2 className="section-title flex items-center gap-2">
              <UserCircle className="h-5 w-5 text-[--primary]" />
              Basic Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div>
                <label className="label">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Raju Jha"
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </div>

              {/* Phone Number */}
              <div>
                <label className="label">Phone Number</label>
                <div className="relative">
                  <input
                    type="tel"
                    placeholder="e.g. +91 98765 43210"
                    className="input pl-9"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
                </div>
              </div>

              {/* Home Address */}
              <div className="sm:col-span-2">
                <label className="label">Home Address</label>
                <div className="relative">
                  <textarea
                    rows={2}
                    placeholder="Permanent or residential address (Street, City, Postal Code)..."
                    className="input pl-9 py-2 min-h-[70px]"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-[--text-muted]" />
                </div>
              </div>

              {/* Bio / Description */}
              <div className="sm:col-span-2">
                <label className="label flex items-center justify-between">
                  <span>Bio / Professional Summary</span>
                  <span className="text-[10px] text-[--text-muted]">{bio.length}/500</span>
                </label>
                <textarea
                  className="input min-h-[90px] py-2"
                  placeholder="Write a concise overview of your background, academic interests, and career goals..."
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={500}
                />
              </div>
            </div>
          </div>

          {/* 2. Standardized Skills Section */}
          <div className="card space-y-4 border border-slate-200">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-600" />
                  Standardized Skills
                </h2>
                <p className="text-xs text-[--text-muted] mt-0.5">
                  Select from verified industry categories to optimize talent searches and placement matching.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {selectedSkills.length} Selected
              </span>
            </div>

            {/* Standardized Multi-Select Dropdown Component */}
            <StandardizedSkillsDropdown
              selectedSkills={selectedSkills}
              onToggleSkill={toggleSkill}
              onRemoveSkill={(s) => setSelectedSkills(selectedSkills.filter((item) => item !== s))}
            />
          </div>

          {/* 3. Experience Section (Dynamic List) */}
          <div className="card space-y-4 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="section-title flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-blue-600" />
                  Experience &amp; Internships
                </h2>
                <p className="text-xs text-[--text-muted] mt-0.5">
                  List your past internships, research projects, freelance, or club roles.
                </p>
              </div>
              <button
                type="button"
                onClick={addExperience}
                className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3 font-semibold"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Experience
              </button>
            </div>

            {experiences.length === 0 ? (
              <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Briefcase className="h-6 w-6 text-slate-400 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-600">No experience records added yet.</p>
                <p className="text-[11px] text-[--text-muted] mt-0.5">
                  Click "+ Add Experience" above to list internships or extracurricular roles.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {experiences.map((exp, index) => (
                  <div
                    key={exp.id || index}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                          {index + 1}
                        </span>
                        Experience Entry
                      </span>
                      <button
                        type="button"
                        onClick={() => removeExperience(exp.id)}
                        className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Remove experience"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">
                          Role / Title
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Web Development Intern"
                          className="input mt-1 h-9 text-xs"
                          value={exp.title}
                          onChange={(e) => updateExperienceItem(exp.id, 'title', e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">
                          Company / Organization
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Infosys, College Tech Club"
                          className="input mt-1 h-9 text-xs"
                          value={exp.company}
                          onChange={(e) => updateExperienceItem(exp.id, 'company', e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">
                          Duration
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. June 2023 – August 2023 (3 months)"
                          className="input mt-1 h-9 text-xs"
                          value={exp.duration || ''}
                          onChange={(e) => updateExperienceItem(exp.id, 'duration', e.target.value)}
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-semibold text-slate-500 uppercase">
                          Responsibilities &amp; Achievements
                        </label>
                        <textarea
                          rows={2}
                          placeholder="Brief summary of key contributions, technologies used, or achievements..."
                          className="input mt-1 py-1.5 text-xs min-h-[60px]"
                          value={exp.description || ''}
                          onChange={(e) => updateExperienceItem(exp.id, 'description', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Professional Links Section */}
          <div className="card space-y-4 border border-slate-200">
            <h2 className="section-title flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-[--primary]" />
              Professional Links
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
                  placeholder="https://myportfolio.com"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="btn-primary w-full flex justify-center items-center gap-2 py-3 text-sm font-semibold shadow-sm"
            disabled={saving}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Profile Changes...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                Save &amp; Update Profile
              </>
            )}
          </button>
        </div>

        {/* Right Sidebar: Preferences & Placement Settings */}
        <div className="space-y-6">
          <div className="card space-y-4 border border-slate-200">
            <h2 className="section-title flex items-center gap-2">
              <Lock className="h-5 w-5 text-[--primary]" />
              Placement &amp; Privacy
            </h2>

            <div>
              <label className="label">Placement Status</label>
              <select
                className="input font-medium"
                value={placementInterest}
                onChange={(e) => setPlacementInterest(e.target.value as PlacementInterest)}
              >
                <option value="yes">Actively Looking</option>
                <option value="maybe">Open to Opportunities</option>
                <option value="no">Not Interested Currently</option>
              </select>
            </div>

            <hr className="border-gray-100" />

            <div>
              <label className="label">Bio Visibility</label>
              <select
                className="input"
                value={privacy.bio}
                onChange={(e) => setPrivacy({ ...privacy, bio: e.target.value as PrivacyLevel })}
              >
                <option value="everyone">Everyone</option>
                <option value="faculty">Faculty &amp; Recruiters Only</option>
              </select>
            </div>

            <div>
              <label className="label">Skills Visibility</label>
              <select
                className="input"
                value={privacy.skills}
                onChange={(e) => setPrivacy({ ...privacy, skills: e.target.value as PrivacyLevel })}
              >
                <option value="everyone">Everyone</option>
                <option value="faculty">Faculty &amp; Recruiters Only</option>
              </select>
            </div>

            <p className="text-[11px] text-[--text-muted] leading-relaxed pt-1">
              Institutional faculty and department heads have verified access to profile credentials for official academic
              recommendations and placements.
            </p>
          </div>
        </div>
      </form>
    </div>
  );
}

// ── Searchable Multi-Select Standardized Skills Component ──────────────────────

export interface SkillsDropdownProps {
  selectedSkills: string[];
  onToggleSkill: (skill: string) => void;
  onRemoveSkill: (skill: string) => void;
}

export function StandardizedSkillsDropdown({
  selectedSkills,
  onToggleSkill,
  onRemoveSkill,
}: SkillsDropdownProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter skills by search query
  const filteredCategories = STANDARDIZED_SKILLS.map((cat) => ({
    category: cat.category,
    skills: cat.skills.filter((s) => s.toLowerCase().includes(searchTerm.toLowerCase())),
  })).filter((cat) => cat.skills.length > 0);

  return (
    <div className="space-y-3" ref={dropdownRef}>
      {/* Selected Skills Chips */}
      <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
        {selectedSkills.length === 0 ? (
          <span className="text-xs text-[--text-muted] italic p-1">
            No standardized skills selected yet. Use the dropdown below to select skills.
          </span>
        ) : (
          selectedSkills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 bg-white text-indigo-800 px-2.5 py-1 rounded-lg text-xs font-semibold border border-indigo-200 shadow-xs"
            >
              <span>{skill}</span>
              <button
                type="button"
                onClick={() => onRemoveSkill(skill)}
                className="text-indigo-400 hover:text-indigo-700 transition-colors p-0.5 rounded"
                title={`Remove ${skill}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Dropdown Toggle Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="input w-full flex items-center justify-between text-xs text-left bg-white font-medium"
        >
          <span className="text-slate-600">
            {selectedSkills.length > 0
              ? `Select more skills (${selectedSkills.length} selected)...`
              : 'Browse & search standardized skills...'}
          </span>
          <ChevronDown className={cn('h-4 w-4 text-slate-400 transition-transform', isOpen && 'rotate-180')} />
        </button>

        {/* Dropdown Menu Panel */}
        {isOpen && (
          <div className="absolute left-0 right-0 top-full mt-1.5 z-40 bg-white border border-slate-200 rounded-xl shadow-xl p-3 max-h-72 overflow-y-auto animate-fade-in">
            {/* Search Input */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search skills (e.g. Python, React, Leadership)..."
                className="input pl-8 py-1.5 text-xs h-8 w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                autoFocus
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Categorized Skills List */}
            {filteredCategories.length === 0 ? (
              <div className="text-center py-4 text-xs text-slate-400">
                No matching skills found.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredCategories.map((cat) => (
                  <div key={cat.category}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 px-1">
                      {cat.category}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.skills.map((skill) => {
                        const isSelected = selectedSkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => onToggleSkill(skill)}
                            className={cn(
                              'text-xs px-2.5 py-1 rounded-lg border font-medium flex items-center gap-1 transition-all',
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                            )}
                          >
                            {isSelected && <Check className="h-3 w-3" />}
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Faculty / HOD Profile Page Component ──────────────────────────────────────

function FacultyProfilePage({ uid }: { uid: string }): React.ReactElement {
  const { claims } = useAuth();
  const [staffData, setStaffData] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const isHOD = claims?.roles.includes('HOD');

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      staffDoc(uid),
      (snap) => {
        setStaffData(snap.exists() ? snap.data() : null);
        setLoading(false);
      },
      (err) => {
        console.warn('Staff profile error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [uid]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[--primary]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div>
        <h1 className="page-title">My Profile</h1>
        <p className="text-sm text-[--text-muted] mt-1">Your staff account details.</p>
      </div>

      <div className="card space-y-6 border border-slate-200">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-2xl shadow-sm flex-shrink-0">
            {(staffData?.name || 'F')[0].toUpperCase()}
          </div>
          <div>
            <h2 className="text-xl font-bold text-[--text]">{staffData?.name || 'Faculty Member'}</h2>
            <p className="text-sm text-[--text-muted] mt-0.5">{staffData?.email || '—'}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className={`badge text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isHOD ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                }`}
              >
                {isHOD ? 'Head of Department' : 'Faculty'}
              </span>
              {staffData?.deptId && (
                <span className="badge text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                  Dept: {staffData.deptId.toUpperCase()}
                </span>
              )}
            </div>
          </div>
        </div>

        <hr className="border-gray-100" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider block mb-1">
              <UserCircle className="inline h-3 w-3 mr-1" />
              Employee ID
            </label>
            <p className="text-sm font-semibold text-[--text] bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {staffData?.employeeId || '—'}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider block mb-1">
              <Briefcase className="inline h-3 w-3 mr-1" />
              Department
            </label>
            <p className="text-sm font-semibold text-[--text] bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
              {staffData?.deptId?.toUpperCase() || '—'}
            </p>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider block mb-1">
              <Lock className="inline h-3 w-3 mr-1" />
              Roles
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {(staffData?.roles || claims?.roles || []).map((r) => (
                <span key={r} className="badge-primary text-[10px]">
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[--text-muted] uppercase tracking-wider block mb-1">
              <BookOpen className="inline h-3 w-3 mr-1" />
              Account Status
            </label>
            <span className="badge-success text-[10px]">Active</span>
          </div>
        </div>

        {!staffData && (
          <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-3">
            Staff profile document not found in Firestore.
          </p>
        )}
      </div>
    </div>
  );
}
