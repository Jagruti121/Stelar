/**
 * STELLAR — Talent Search Page (Feature 15)
 *
 * Dedicated search interface for Faculty & HOD to find students based on technical and soft skills.
 * - Standardized Categorized Multi-Select Dropdown with Type-to-Search autocomplete.
 * - Direct Firestore `array-contains-any` query execution against the `students` collection.
 * - Responsive student resume cards with matching skills highlighted and deep links to read-only profiles.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import {
  Loader2,
  Search,
  Sparkles,
  User,
  Phone,
  Briefcase,
  ExternalLink,
  BookOpen,
  X,
  Filter,
} from 'lucide-react';
import { StandardizedSkillsDropdown } from '@/pages/ProfilePage';

interface StudentTalent {
  id: string;
  name: string;
  rollNo?: string;
  roll?: string;
  deptId?: string;
  department?: string;
  division?: string;
  year?: string;
  batch?: string;
  phone?: string;
  address?: string;
  bio?: string;
  skills?: string[];
  experience?: Array<{ id: string; title: string; company: string; duration?: string; description?: string }>;
  links?: { github?: string; linkedin?: string; portfolio?: string };
}

export default function TalentPage(): React.ReactElement {
  const { claims } = useAuth();
  const navigate = useNavigate();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');

  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<StudentTalent[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isFaculty) {
    return (
      <div className="p-10 text-center text-[--text-muted]">
        Only faculty and department heads can access the Talent Search portal.
      </div>
    );
  }

  // Toggle skill selection
  const handleToggleSkill = (skill: string) => {
    const updated = selectedSkills.includes(skill)
      ? selectedSkills.filter((s) => s !== skill)
      : [...selectedSkills, skill];
    setSelectedSkills(updated);
  };

  // Remove skill
  const handleRemoveSkill = (skill: string) => {
    setSelectedSkills(selectedSkills.filter((s) => s !== skill));
  };

  // Clear all
  const handleClearAll = () => {
    setSelectedSkills([]);
    setResults([]);
    setHasSearched(false);
  };

  // Execute Firestore array-contains-any query
  const executeSearch = async (skillsToQuery: string[]) => {
    if (skillsToQuery.length === 0) {
      toast.info('Please select at least one skill to perform talent search.');
      return;
    }

    setLoading(true);
    setHasSearched(true);

    try {
      // Firestore array-contains-any supports up to 10-30 values
      const queryList = skillsToQuery.slice(0, 10);
      const q = query(
        collection(db, 'students'),
        where('skills', 'array-contains-any', queryList)
      );

      const snap = await getDocs(q);
      const studentDocs: StudentTalent[] = [];

      snap.forEach((docSnap) => {
        const data = docSnap.data();
        studentDocs.push({
          id: docSnap.id,
          name: data.name || 'Unnamed Student',
          rollNo: data.rollNo || data.roll || '',
          roll: data.roll || data.rollNo || '',
          deptId: data.deptId || '',
          department: data.department || (data.deptId ? data.deptId.toUpperCase() : 'General'),
          division: data.division || 'A',
          year: data.year || 'First',
          batch: data.batch || '',
          phone: data.phone || '',
          address: data.address || '',
          bio: data.bio || '',
          skills: Array.isArray(data.skills)
            ? data.skills.map((s: any) => (typeof s === 'string' ? s : s.name)).filter(Boolean)
            : [],
          experience: Array.isArray(data.experience) ? data.experience : [],
          links: data.links || {},
        });
      });

      setResults(studentDocs);
      if (studentDocs.length === 0) {
        toast.info('No students found possessing the selected skills.');
      } else {
        toast.success(`Found ${studentDocs.length} matching candidate${studentDocs.length === 1 ? '' : 's'}!`);
      }
    } catch (err: any) {
      console.error('Talent query failed:', err);
      toast.error('Search failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSearch(selectedSkills);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h1 className="page-title flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
            <Sparkles className="h-6 w-6" />
          </span>
          Search Talent &amp; Skills
        </h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Discover students possessing specific technical capabilities, software proficiencies, and leadership skills.
        </p>
      </div>

      {/* Search Filter Card */}
      <div className="card shadow-sm border border-slate-200 space-y-4">
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-indigo-600" />
              <label className="text-sm font-bold text-slate-700">
                Filter by Standardized Skills (Technical &amp; Soft Skills)
              </label>
            </div>
            {selectedSkills.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="text-xs text-rose-600 hover:text-rose-800 font-medium flex items-center gap-1"
              >
                <X className="h-3 w-3" />
                Clear All
              </button>
            )}
          </div>

          {/* Categorized Multi-Select Dropdown with Type-to-Search Autocomplete */}
          <StandardizedSkillsDropdown
            selectedSkills={selectedSkills}
            onToggleSkill={handleToggleSkill}
            onRemoveSkill={handleRemoveSkill}
          />

          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-[--text-muted]">
              {selectedSkills.length === 0
                ? 'Select one or more skills from the dropdown above to filter student talent.'
                : `${selectedSkills.length} skill${selectedSkills.length === 1 ? '' : 's'} selected for matching.`}
            </p>

            <button
              type="submit"
              disabled={loading || selectedSkills.length === 0}
              className="btn-primary flex items-center gap-2 py-2 px-6 text-sm font-semibold shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4" />
                  Search Students
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Results Section */}
      {hasSearched && (
        <div className="space-y-4 mt-8 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="section-title text-base">
              Matching Candidates ({results.length})
            </h2>
            <span className="text-xs text-[--text-muted]">
              Filter: {selectedSkills.join(', ')}
            </span>
          </div>

          {results.length === 0 ? (
            <div className="text-center p-12 text-[--text-muted] bg-white rounded-xl border border-dashed border-slate-200">
              <User className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-600">No students found matching selected skills.</p>
              <p className="text-xs text-slate-400 mt-1">
                Try selecting different skills or broadening your search criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {results.map((student) => {
                const rollDisplay = student.rollNo || student.roll || student.id;
                const deptDisplay = student.department || student.deptId?.toUpperCase() || 'CS';

                return (
                  <div
                    key={student.id}
                    className="card hover:shadow-md transition-all duration-200 border border-slate-200 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 text-white font-bold flex items-center justify-center text-sm shadow-sm flex-shrink-0">
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-[--text] leading-snug group-hover:text-[--primary] transition-colors">
                              {student.name}
                            </h3>
                            <p className="text-xs text-[--text-muted] font-medium mt-0.5">
                              Roll: <span className="font-semibold text-slate-700">{rollDisplay}</span> • {deptDisplay} • Div {student.division}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {student.year} Year
                        </span>
                      </div>

                      {/* Bio */}
                      <p className="text-xs text-slate-600 mb-3 line-clamp-2">
                        {student.bio || 'No professional bio provided by student.'}
                      </p>

                      {/* Skills Badges */}
                      <div className="mb-4">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                          Verified Skills:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {student.skills && student.skills.length > 0 ? (
                            student.skills.map((skill, idx) => {
                              const isMatched = selectedSkills.includes(skill);
                              return (
                                <span
                                  key={idx}
                                  className={`text-xs px-2.5 py-0.5 rounded-md font-semibold border transition-all ${
                                    isMatched
                                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-1 ring-indigo-300'
                                      : 'bg-slate-50 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  {skill}
                                </span>
                              );
                            })
                          ) : (
                            <span className="text-xs text-slate-400 italic">No skills listed yet</span>
                          )}
                        </div>
                      </div>

                      {/* Experience summary */}
                      {student.experience && student.experience.length > 0 && (
                        <div className="mb-3 p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-center gap-1.5">
                          <Briefcase className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                          <span className="font-medium truncate">
                            {student.experience[0].title} at {student.experience[0].company}
                            {student.experience.length > 1 && ` (+${student.experience.length - 1} more)`}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs">
                      <div className="flex items-center gap-1 text-[--text-muted]">
                        {student.phone ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {student.phone}
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <BookOpen className="h-3 w-3" />
                            {student.batch || 'Enrolled Student'}
                          </span>
                        )}
                      </div>

                      {/* View Read-Only Profile Link (Feature 17) */}
                      <button
                        type="button"
                        onClick={() => navigate(`/app/student-profile/${student.id}`)}
                        className="btn-secondary text-xs font-semibold py-1 px-2.5 flex items-center gap-1 text-indigo-600 hover:text-indigo-800"
                      >
                        <span>View Profile</span>
                        <ExternalLink className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
