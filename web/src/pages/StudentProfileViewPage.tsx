/**
 * STELLAR — Student Profile Read-Only View (Feature 17)
 *
 * Strictly read-only digital resume view for Faculty and HODs.
 * Accessible via `/app/student-profile/:uid` or `/student-profile/:uid`.
 *
 * Displays comprehensive student data:
 * - Full Name, Phone Number, Home Address, Bio / Summary
 * - Experience & Internships (title, company, duration, description)
 * - Standardized Skills (categorized technical and soft skills)
 * - Academic details (Roll No, Department, Division, Year, Batch)
 * - Professional Links (GitHub, LinkedIn, Portfolio)
 *
 * Constraint: Strictly read-only. No edit controls, buttons, or mutation forms.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Briefcase,
  Sparkles,
  Link as LinkIcon,
  Calendar,
  Lock,
  ExternalLink,
  Loader2,
  FileText,
  Building2,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { STANDARDIZED_SKILLS } from '@/pages/ProfilePage';
import type { StudentExperience } from '@/types/firestore';

interface StudentProfileViewData {
  id: string;
  name: string;
  rollNo?: string;
  roll?: string;
  department?: string;
  deptId?: string;
  division?: string;
  year?: string;
  batch?: string;
  phone?: string;
  address?: string;
  bio?: string;
  experience?: StudentExperience[];
  skills?: string[];
  links?: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
  };
  placementInterest?: string;
}

export default function StudentProfileViewPage(): React.ReactElement {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  const [student, setStudent] = useState<StudentProfileViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!uid) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const fetchStudentProfile = async () => {
      setLoading(true);
      setNotFound(false);

      try {
        let studentData: any = null;
        let resolvedId = uid;

        // 1. Try direct fetch from `students/{uid}`
        const studentRef = doc(db, 'students', uid);
        const studentSnap = await getDoc(studentRef);

        if (studentSnap.exists()) {
          studentData = studentSnap.data();
          resolvedId = studentSnap.id;
        } else {
          // Fallback: search by rollNo or roll or authUid
          const qRoll = query(collection(db, 'students'), where('rollNo', '==', uid));
          const snapRoll = await getDocs(qRoll);

          if (!snapRoll.empty) {
            studentData = snapRoll.docs[0].data();
            resolvedId = snapRoll.docs[0].id;
          } else {
            const qAuth = query(collection(db, 'students'), where('authUid', '==', uid));
            const snapAuth = await getDocs(qAuth);
            if (!snapAuth.empty) {
              studentData = snapAuth.docs[0].data();
              resolvedId = snapAuth.docs[0].id;
            }
          }
        }

        if (!studentData) {
          setNotFound(true);
          setLoading(false);
          return;
        }

        // 2. Fetch companion `studentProfiles/{resolvedId}` to merge any extra links or interests
        let profileData: any = {};
        try {
          const profileSnap = await getDoc(doc(db, 'studentProfiles', resolvedId));
          if (profileSnap.exists()) {
            profileData = profileSnap.data();
          }
        } catch (e) {
          console.warn('Profile doc fetch note:', e);
        }

        // 3. Normalize skills
        const rawSkills = studentData.skills || profileData.skills || [];
        const normalizedSkills: string[] = Array.isArray(rawSkills)
          ? rawSkills.map((s: any) => (typeof s === 'string' ? s : s.name)).filter(Boolean)
          : [];

        // 4. Normalize experience
        let normalizedExp: StudentExperience[] = [];
        const rawExp = studentData.experience || profileData.experience;
        if (Array.isArray(rawExp)) {
          normalizedExp = rawExp;
        } else if (typeof rawExp === 'string' && rawExp.trim()) {
          normalizedExp = [
            {
              id: 'exp_1',
              title: 'Work / Project Experience',
              company: 'Details',
              description: rawExp,
            },
          ];
        }

        setStudent({
          id: resolvedId,
          name: studentData.name || profileData.name || 'Unnamed Student',
          rollNo: studentData.rollNo || studentData.roll || '',
          roll: studentData.roll || studentData.rollNo || '',
          department: studentData.department || (studentData.deptId ? studentData.deptId.toUpperCase() : 'CS'),
          deptId: studentData.deptId || '',
          division: studentData.division || 'A',
          year: studentData.year || 'First',
          batch: studentData.batch || '',
          phone: studentData.phone || profileData.phone || '',
          address: studentData.address || profileData.address || '',
          bio: studentData.bio || profileData.bio || '',
          experience: normalizedExp,
          skills: normalizedSkills,
          links: profileData.links || studentData.links || {},
          placementInterest: profileData.placementInterest || studentData.placementInterest || '',
        });
      } catch (err: any) {
        console.error('Error fetching student profile:', err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    fetchStudentProfile();
  }, [uid]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[360px] gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[--primary]" />
        <p className="text-xs text-[--text-muted]">Loading student digital resume...</p>
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="max-w-2xl mx-auto p-8 card text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
          <User className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">Student Profile Not Found</h2>
        <p className="text-xs text-slate-500">
          The requested student record with ID <span className="font-mono font-semibold">{uid}</span> could not be located in the database.
        </p>
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </button>
      </div>
    );
  }

  // Split skills into Technical and Soft Skills categories
  const technicalList: string[] = [];
  const softList: string[] = [];
  const techRef = STANDARDIZED_SKILLS.find((c) => c.category === 'Technical Skills')?.skills || [];
  const softRef = STANDARDIZED_SKILLS.find((c) => c.category === 'Non-Technical / Soft Skills')?.skills || [];

  (student.skills || []).forEach((sk) => {
    if (techRef.includes(sk)) {
      technicalList.push(sk);
    } else if (softRef.includes(sk)) {
      softList.push(sk);
    } else {
      technicalList.push(sk);
    }
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Top Navigation & Status Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="btn-secondary text-xs inline-flex items-center gap-1.5 py-1.5 px-3 font-semibold"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Verified Student Resume
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold border border-slate-200">
            <Lock className="h-3 w-3" />
            Read-Only View
          </span>
        </div>
      </div>

      {/* Main Student Header Card */}
      <div className="card shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-center font-bold text-3xl shadow-sm flex-shrink-0">
            {student.name.charAt(0).toUpperCase()}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-[--text] leading-tight truncate">
                {student.name}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {student.year} Year
              </span>
            </div>

            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Department of {student.department} • Division {student.division} • Roll: {student.rollNo || student.roll || '—'}
            </p>

            {/* Quick Contact & Info Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs text-slate-600">
              {student.phone && (
                <div className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                  <a href={`tel:${student.phone}`} className="hover:underline font-medium">
                    {student.phone}
                  </a>
                </div>
              )}

              {student.address && (
                <div className="flex items-center gap-1.5 col-span-1 sm:col-span-2">
                  <MapPin className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                  <span className="truncate">{student.address}</span>
                </div>
              )}

              {student.batch && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-amber-500 flex-shrink-0" />
                  <span>Batch: {student.batch}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2-Column Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Bio, Experience */}
        <div className="lg:col-span-2 space-y-6">
          {/* Bio / Professional Summary */}
          <div className="card shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-4 w-4 text-[--primary]" />
              Bio / Professional Summary
            </h2>
            {student.bio ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                {student.bio}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">No bio provided by student.</p>
            )}
          </div>

          {/* Experience & Internships */}
          <div className="card shadow-sm border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                Experience &amp; Internships
              </h2>
              <span className="text-xs font-semibold text-slate-500">
                {student.experience?.length || 0} Listed
              </span>
            </div>

            {!student.experience || student.experience.length === 0 ? (
              <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <Briefcase className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs text-slate-500 font-medium">No experience records added.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {student.experience.map((exp, idx) => (
                  <div
                    key={exp.id || idx}
                    className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-800">{exp.title}</h3>
                        <p className="text-xs font-semibold text-blue-700 flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3 w-3" />
                          {exp.company}
                        </p>
                      </div>
                      {exp.duration && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {exp.duration}
                        </span>
                      )}
                    </div>
                    {exp.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap pt-1 border-t border-slate-100">
                        {exp.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Skills & Links */}
        <div className="space-y-6">
          {/* Standardized Skills Card */}
          <div className="card shadow-sm border border-slate-200 p-5 space-y-4">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Standardized Skills
            </h2>

            {student.skills && student.skills.length > 0 ? (
              <div className="space-y-3">
                {technicalList.length > 0 && (
                  <div>
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Technical Skills ({technicalList.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {technicalList.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 border border-indigo-200 font-semibold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {softList.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                      Soft &amp; Professional Skills ({softList.length})
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      {softList.map((skill, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-semibold"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No skills cataloged on this profile.</p>
            )}
          </div>

          {/* Links & Socials Card */}
          <div className="card shadow-sm border border-slate-200 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-slate-600" />
              Online Presence &amp; Portfolios
            </h2>

            <div className="space-y-2 text-xs">
              {student.links?.github ? (
                <a
                  href={student.links.github}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors font-medium"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                    GitHub Profile
                  </span>
                  <span className="text-[10px] text-blue-600">Open</span>
                </a>
              ) : null}

              {student.links?.linkedin ? (
                <a
                  href={student.links.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-blue-50/50 hover:bg-blue-50 border border-blue-200 text-blue-800 transition-colors font-medium"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 text-blue-600" />
                    LinkedIn Profile
                  </span>
                  <span className="text-[10px] text-blue-600">Open</span>
                </a>
              ) : null}

              {student.links?.portfolio ? (
                <a
                  href={student.links.portfolio}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between p-2 rounded-lg bg-purple-50/50 hover:bg-purple-50 border border-purple-200 text-purple-800 transition-colors font-medium"
                >
                  <span className="flex items-center gap-2">
                    <ExternalLink className="h-3.5 w-3.5 text-purple-600" />
                    Portfolio Website
                  </span>
                  <span className="text-[10px] text-purple-600">Open</span>
                </a>
              ) : null}

              {!student.links?.github && !student.links?.linkedin && !student.links?.portfolio && (
                <p className="text-xs text-slate-400 italic">No external links provided.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
