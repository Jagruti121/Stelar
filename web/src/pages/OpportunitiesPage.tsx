/**
 * STELLAR — Job & Internship Opportunity Portal (Feature 12)
 *
 * Faculty / HOD:
 * - Post new opportunities (Company Name, Job Role, Job Description, Type: Job/Internship, Duration, Compensation: Paid/Unpaid, conditional Salary/Stipend)
 * - Manage active opportunities and view applicants per posting
 *
 * Student:
 * - Professional job portal card grid
 * - Prominent Company, Role, Type badge, Compensation badge, Duration
 * - "Apply" button registering student UID to `opportunities/{id}/applicants/{uid}` preventing duplicate applications
 * - Application confirmation modal with profile snapshot and optional resume upload
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import {
  collection,
  doc,
  setDoc,
  addDoc,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  Briefcase,
  Building2,
  Clock,
  DollarSign,
  Plus,
  Search,
  Users,
  CheckCircle2,
  Loader2,
  ChevronRight,
  FileText,
  UploadCloud,
  X,
  BadgeCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/utils/cn';
import { studentDoc } from '@/lib/firestore';
import type { Opportunity, OpportunityType, SalaryType, OpportunityApplicant } from '@/types/firestore';

export default function OpportunitiesPage(): React.ReactElement {
  const { user, claims } = useAuth();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');
  const isHOD = claims?.roles.includes('HOD');

  // Navigation tab for Faculty: 'board' (browse all), 'create' (post), 'manage' (view applicants)
  const [activeTab, setActiveTab] = useState<'board' | 'create' | 'manage'>('board');

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[--border] pb-5">
        <div>
          <h1 className="page-title flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <Briefcase className="h-6 w-6" />
            </span>
            Opportunities Portal
          </h1>
          <p className="text-sm text-[--text-muted] mt-1">
            Discover internships, full-time jobs, and career placements curated by college faculty.
          </p>
        </div>

        {/* Tab switchers for Faculty / HOD */}
        {isFaculty && (
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
            <button
              onClick={() => setActiveTab('board')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
                activeTab === 'board'
                  ? 'bg-white text-[--text] shadow-sm'
                  : 'text-[--text-muted] hover:text-[--text]'
              )}
            >
              Job Board
            </button>
            <button
              onClick={() => setActiveTab('create')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5',
                activeTab === 'create'
                  ? 'bg-[--primary] text-white shadow-sm'
                  : 'text-[--text-muted] hover:text-[--text]'
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Post Opportunity
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={cn(
                'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5',
                activeTab === 'manage'
                  ? 'bg-white text-[--text] shadow-sm'
                  : 'text-[--text-muted] hover:text-[--text]'
              )}
            >
              <Users className="h-3.5 w-3.5" />
              Manage Postings
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {isFaculty && activeTab === 'create' && (
        <CreateOpportunityForm
          onSuccess={() => setActiveTab('manage')}
          isHOD={isHOD || false}
        />
      )}

      {isFaculty && activeTab === 'manage' && (
        <FacultyManageOpportunities onNewClick={() => setActiveTab('create')} />
      )}

      {(activeTab === 'board' || !isFaculty) && (
        <StudentJobBoard userUid={user?.uid || ''} isFaculty={isFaculty || false} />
      )}
    </div>
  );
}

// ── Faculty / HOD: Create Opportunity Form Component ──────────────────────────

interface CreateOpportunityFormProps {
  onSuccess: () => void;
  isHOD: boolean;
}

function CreateOpportunityForm({ onSuccess, isHOD }: CreateOpportunityFormProps): React.ReactElement {
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);

  // Mandatory Form States
  const [companyName, setCompanyName] = useState('');
  const [jobRole, setJobRole] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [opportunityType, setOpportunityType] = useState<OpportunityType>('Internship');
  const [duration, setDuration] = useState('');
  const [salaryType, setSalaryType] = useState<SalaryType>('Paid');
  const [stipend, setStipend] = useState('');

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast.error('Company Name is required');
      return;
    }
    if (!jobRole.trim()) {
      toast.error('Job Role is required');
      return;
    }
    if (!jobDescription.trim()) {
      toast.error('Job Description is required');
      return;
    }
    if (!duration.trim()) {
      toast.error('Duration is required (e.g., 6 months, Permanent)');
      return;
    }
    if (salaryType === 'Paid' && !stipend.trim()) {
      toast.error('Please specify the Salary Amount / Stipend for paid roles');
      return;
    }

    setSubmitting(true);
    try {
      const payload: Partial<Opportunity> & Record<string, any> = {
        companyName: companyName.trim(),
        jobRole: jobRole.trim(),
        jobDescription: jobDescription.trim(),
        title: jobRole.trim(),
        description: jobDescription.trim(),
        opportunityType,
        duration: duration.trim(),
        salaryType,
        stipend: salaryType === 'Paid' ? stipend.trim() : 'Unpaid',
        postedBy: user?.uid || '',
        createdBy: user?.uid || '',
        postedByName: user?.displayName || (isHOD ? 'Department HOD' : 'Faculty Member'),
        postedByRole: isHOD ? 'HOD' : 'Faculty',
        createdAt: serverTimestamp() as any,
        updatedAt: serverTimestamp() as any,
      };

      await addDoc(collection(db, 'opportunities'), payload);

      toast.success('Opportunity posted successfully!');
      // Reset form
      setCompanyName('');
      setJobRole('');
      setJobDescription('');
      setDuration('');
      setStipend('');
      setSalaryType('Paid');
      setOpportunityType('Internship');

      onSuccess();
    } catch (err: any) {
      console.error('Error creating opportunity:', err);
      toast.error('Failed to post opportunity: ' + (err.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card max-w-2xl mx-auto shadow-sm border border-slate-200">
      <div className="border-b border-[--border] pb-4 mb-6">
        <h2 className="text-lg font-bold text-[--text] flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-[--primary]" />
          Post New Career Opportunity
        </h2>
        <p className="text-xs text-[--text-muted] mt-1">
          Publish an internship or job opening to all eligible students on the job board.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Company Name */}
        <div>
          <label className="label">
            Company Name <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="e.g. Google, Microsoft, Infosys, Tata Consultancy Services"
              className="input pl-9"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
          </div>
        </div>

        {/* Job Role */}
        <div>
          <label className="label">
            Job Role <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="e.g. Software Development Intern, Associate Cloud Engineer"
              className="input pl-9"
              value={jobRole}
              onChange={(e) => setJobRole(e.target.value)}
            />
            <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
          </div>
        </div>

        {/* Opportunity Type & Duration */}
        <div>
          <label className="label">
            Opportunity Type <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-1">
            <label
              className={cn(
                'flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                opportunityType === 'Internship'
                  ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-300'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="opportunityType"
                value="Internship"
                checked={opportunityType === 'Internship'}
                onChange={() => setOpportunityType('Internship')}
                className="sr-only"
              />
              Internship
            </label>

            <label
              className={cn(
                'flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                opportunityType === 'Job'
                  ? 'bg-blue-50 border-blue-500 text-blue-800 ring-2 ring-blue-300'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="opportunityType"
                value="Job"
                checked={opportunityType === 'Job'}
                onChange={() => setOpportunityType('Job')}
                className="sr-only"
              />
              Job
            </label>

            <label
              className={cn(
                'flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                opportunityType === 'Hackathon'
                  ? 'bg-purple-50 border-purple-500 text-purple-800 ring-2 ring-purple-300'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="opportunityType"
                value="Hackathon"
                checked={opportunityType === 'Hackathon'}
                onChange={() => setOpportunityType('Hackathon')}
                className="sr-only"
              />
              Hackathon
            </label>

            <label
              className={cn(
                'flex items-center justify-center gap-1.5 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all',
                opportunityType === 'Challenge'
                  ? 'bg-amber-50 border-amber-500 text-amber-800 ring-2 ring-amber-300'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              )}
            >
              <input
                type="radio"
                name="opportunityType"
                value="Challenge"
                checked={opportunityType === 'Challenge'}
                onChange={() => setOpportunityType('Challenge')}
                className="sr-only"
              />
              Challenge
            </label>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="label">
            Duration <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              required
              placeholder="e.g. 6 months, 3 days, 48 hours, Permanent"
              className="input pl-9"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
          </div>
        </div>

        {/* Compensation Logic */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Salary Type Dropdown */}
          <div>
            <label className="label">
              Compensation Type <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                className="input pl-9 pr-8 appearance-none font-medium"
                value={salaryType}
                onChange={(e) => setSalaryType(e.target.value as SalaryType)}
              >
                <option value="Paid">Paid</option>
                <option value="Unpaid">Unpaid</option>
              </select>
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
            </div>
          </div>

          {/* Conditional Rendering: If Paid, dynamically render Salary Amount / Stipend */}
          {salaryType === 'Paid' ? (
            <div className="animate-fade-in">
              <label className="label">
                Salary Amount / Stipend <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. ₹25,000 / month, ₹6.5 LPA"
                  className="input pl-9"
                  value={stipend}
                  onChange={(e) => setStipend(e.target.value)}
                />
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-600" />
              </div>
            </div>
          ) : (
            <div className="flex items-center text-xs text-[--text-muted] italic pt-6 sm:pt-7">
              <span>This role is marked as an unpaid learning/experience opportunity.</span>
            </div>
          )}
        </div>

        {/* Job Description */}
        <div>
          <label className="label">
            Job Description <span className="text-red-500">*</span>
          </label>
          <textarea
            required
            rows={5}
            placeholder="Detailed description of responsibilities, requirements, eligibility criteria, and key qualifications..."
            className="input min-h-[120px] py-2"
            value={jobDescription}
            onChange={(e) => setJobDescription(e.target.value)}
          />
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full flex items-center justify-center gap-2 py-2.5 font-semibold"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing Opportunity...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                Publish Opportunity to Students
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Student Side: Job Board UI Component ──────────────────────────────────────

interface StudentJobBoardProps {
  userUid: string;
  isFaculty: boolean;
}

function StudentJobBoard({ userUid, isFaculty }: StudentJobBoardProps): React.ReactElement {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);

  // Set of opportunity IDs where current user has applied
  const [appliedMap, setAppliedMap] = useState<Record<string, boolean>>({});

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | OpportunityType>('All');
  const [compFilter, setCompFilter] = useState<'All' | 'Paid' | 'Unpaid'>('All');

  // Application Modal state
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null);

  // 1. Real-time listener on `opportunities` collection
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'opportunities'), orderBy('createdAt', 'desc'));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })) as Opportunity[];
        setOpportunities(items);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load opportunities:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  // 2. Check which opportunities the student has already applied to
  useEffect(() => {
    if (!userUid || isFaculty || opportunities.length === 0) return;

    const checkApplications = async () => {
      const map: Record<string, boolean> = {};
      await Promise.all(
        opportunities.map(async (opp) => {
          try {
            const appDoc = await getDoc(doc(db, 'opportunities', opp.id, 'applicants', userUid));
            if (appDoc.exists()) {
              map[opp.id] = true;
            }
          } catch (e) {
            // Ignore individual fetch errors
          }
        })
      );
      setAppliedMap(map);
    };

    checkApplications();
  }, [userUid, opportunities, isFaculty]);

  // Filtered list
  const filtered = opportunities.filter((opp) => {
    const matchesSearch =
      !searchQuery.trim() ||
      opp.companyName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.jobRole?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      opp.jobDescription?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType =
      typeFilter === 'All' || opp.opportunityType === typeFilter;

    const matchesComp =
      compFilter === 'All' || opp.salaryType === compFilter;

    return matchesSearch && matchesType && matchesComp;
  });

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="card p-4 shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Keyword Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[--text-muted]" />
            <input
              type="text"
              placeholder="Search by company, role, or keywords..."
              className="input pl-9 h-10 text-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {(['All', 'Internship', 'Job', 'Hackathon', 'Challenge'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  typeFilter === t
                    ? 'bg-white text-[--text] shadow-sm'
                    : 'text-[--text-muted] hover:text-[--text]'
                )}
              >
                {t === 'All' ? 'All Roles' : t}
              </button>
            ))}
          </div>

          {/* Compensation Filter Buttons */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
            {(['All', 'Paid', 'Unpaid'] as const).map((c) => (
              <button
                key={c}
                onClick={() => setCompFilter(c)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-md transition-all',
                  compFilter === c
                    ? 'bg-white text-[--text] shadow-sm'
                    : 'text-[--text-muted] hover:text-[--text]'
                )}
              >
                {c === 'All' ? 'All Pay' : c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Opportunity Cards */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-16">
          <Loader2 className="h-8 w-8 animate-spin text-[--primary] mb-2" />
          <p className="text-xs text-[--text-muted]">Loading opportunities board...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16 px-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
            <Briefcase className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-slate-700">No opportunities match your criteria</h3>
          <p className="text-xs text-[--text-muted] mt-1 max-w-sm mx-auto">
            Try adjusting your search terms or filter selections. New openings are posted regularly.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((opp) => {
            const hasApplied = appliedMap[opp.id] || false;

            return (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                hasApplied={hasApplied}
                isFaculty={isFaculty}
                onApplyClick={() => setSelectedOpp(opp)}
              />
            );
          })}
        </div>
      )}

      {/* Application Modal */}
      {selectedOpp && (
        <ApplicationModal
          opportunity={selectedOpp}
          userUid={userUid}
          onClose={() => setSelectedOpp(null)}
          onSuccess={() => {
            setAppliedMap((prev) => ({ ...prev, [selectedOpp.id]: true }));
            setSelectedOpp(null);
          }}
        />
      )}
    </div>
  );
}

// ── Opportunity Card Component ────────────────────────────────────────────────

interface OpportunityCardProps {
  opportunity: Opportunity;
  hasApplied: boolean;
  isFaculty: boolean;
  onApplyClick: () => void;
}

function OpportunityCard({
  opportunity,
  hasApplied,
  isFaculty,
  onApplyClick,
}: OpportunityCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  const isPaid = opportunity.salaryType === 'Paid';

  return (
    <div className="card hover:shadow-md transition-all duration-200 flex flex-col justify-between border border-slate-200 h-full group">
      <div>
        {/* Top Header: Company & Badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 border border-slate-300 flex items-center justify-center text-slate-700 font-bold text-sm shadow-xs flex-shrink-0">
              {opportunity.companyName ? opportunity.companyName.charAt(0).toUpperCase() : 'C'}
            </div>
            <div className="min-w-0">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">
                {opportunity.companyName}
              </h4>
              <h3 className="text-base font-bold text-[--text] leading-snug group-hover:text-[--primary] transition-colors line-clamp-1">
                {opportunity.jobRole}
              </h3>
            </div>
          </div>
        </div>

        {/* Badges Bar: Type, Compensation, Duration */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3.5">
          {/* Opportunity Type Badge */}
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1',
              opportunity.opportunityType === 'Internship' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
              opportunity.opportunityType === 'Job' && 'bg-blue-50 text-blue-700 border-blue-200',
              opportunity.opportunityType === 'Hackathon' && 'bg-purple-50 text-purple-700 border-purple-200',
              opportunity.opportunityType === 'Challenge' && 'bg-amber-50 text-amber-700 border-amber-200'
            )}
          >
            {opportunity.opportunityType}
          </span>

          {/* Compensation Badge */}
          <span
            className={cn(
              'px-2.5 py-0.5 rounded-full text-[11px] font-semibold border flex items-center gap-1',
              isPaid
                ? 'bg-amber-50 text-amber-800 border-amber-200 font-bold'
                : 'bg-gray-100 text-gray-600 border-gray-200'
            )}
          >
            <DollarSign className="h-3 w-3 -mr-0.5 text-amber-600" />
            {isPaid ? (opportunity.stipend || 'Paid') : 'Unpaid'}
          </span>

          {/* Duration Badge */}
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1">
            <Clock className="h-3 w-3 text-slate-400" />
            {opportunity.duration}
          </span>
        </div>

        {/* Job Description with expandable toggle */}
        <div className="text-xs text-[--text-muted] leading-relaxed mb-4">
          <p className={cn(!expanded && 'line-clamp-3')}>
            {opportunity.jobDescription}
          </p>
          {opportunity.jobDescription && opportunity.jobDescription.length > 140 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[11px] font-semibold text-[--primary] mt-1 hover:underline"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      </div>

      {/* Card Footer: Metadata & Apply Action */}
      <div className="pt-3 border-t border-slate-100 mt-2 flex items-center justify-between gap-3">
        <span className="text-[11px] text-[--text-muted]">
          {opportunity.postedByName ? `By ${opportunity.postedByName}` : 'Active Posting'}
        </span>

        {isFaculty ? (
          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-1 rounded">
            Faculty View
          </span>
        ) : hasApplied ? (
          <button
            disabled
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default"
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Applied ✓
          </button>
        ) : (
          <button
            onClick={onApplyClick}
            className="btn-primary py-1.5 px-3.5 text-xs font-semibold flex items-center gap-1"
          >
            Apply Now
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Application Modal (Prompt with Profile Snapshot & Optional Resume) ─────────

interface ApplicationModalProps {
  opportunity: Opportunity;
  userUid: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ApplicationModal({
  opportunity,
  userUid,
  onClose,
  onSuccess,
}: ApplicationModalProps): React.ReactElement {
  const { user, claims } = useAuth();
  const [applying, setApplying] = useState(false);
  const [studentInfo, setStudentInfo] = useState<{
    name: string;
    email: string;
    studentId: string;
    department: string;
    cgpa?: number;
  }>({
    name: user?.displayName || '',
    email: user?.email || '',
    studentId: (claims?.studentId as string) || '',
    department: ((claims as any)?.department as string) || (claims?.deptId as string) || 'Computer Science',
  });

  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // Fetch full student document for snapshot
  useEffect(() => {
    const fetchStudentProfile = async () => {
      if (!claims?.studentId) return;
      try {
        const snap = await getDoc(studentDoc(claims.studentId as string));
        if (snap.exists()) {
          const data = snap.data() as any;
          setStudentInfo({
            name: data.name || user?.displayName || '',
            email: data.email || user?.email || '',
            studentId: data.id || (claims.studentId as string),
            department: data.department || (claims.deptId as string) || 'Computer Science',
            cgpa: data.cgpa,
          });
        }
      } catch (err) {
        console.warn('Could not load student profile snapshot:', err);
      }
    };

    fetchStudentProfile();
  }, [claims, user]);

  const handleApply = async (): Promise<void> => {
    if (!userUid) return;

    setApplying(true);
    try {
      let uploadedResumeUrl = '';

      // Optional resume file upload to Cloud Storage
      if (resumeFile) {
        const fileRef = ref(storage, `resumes/${userUid}/${Date.now()}_${resumeFile.name}`);
        const snap = await uploadBytes(fileRef, resumeFile);
        uploadedResumeUrl = await getDownloadURL(snap.ref);
      }

      // Save application document to sub-collection `opportunities/{id}/applicants/{uid}`
      // Using userUid as the document ID guarantees no duplicate applications!
      const applicantRef = doc(db, 'opportunities', opportunity.id, 'applicants', userUid);

      const applicantPayload: OpportunityApplicant = {
        id: userUid,
        studentUid: userUid,
        studentId: studentInfo.studentId || userUid,
        studentName: studentInfo.name,
        studentEmail: studentInfo.email,
        department: studentInfo.department,
        cgpa: studentInfo.cgpa,
        resumeUrl: uploadedResumeUrl || undefined,
        appliedAt: serverTimestamp() as any,
      };

      await setDoc(applicantRef, applicantPayload);

      toast.success(`Application sent to ${opportunity.companyName}!`);
      onSuccess();
    } catch (err: any) {
      console.error('Application failed:', err);
      toast.error('Failed to submit application: ' + (err.message || 'Error'));
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="card max-w-lg w-full shadow-xl border border-slate-200 bg-white p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded-lg"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="mb-4">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[--primary]">
            Opportunity Application
          </span>
          <h2 className="text-lg font-bold text-[--text] mt-0.5">
            Apply to {opportunity.companyName}
          </h2>
          <p className="text-xs text-[--text-muted]">
            Role: <span className="font-semibold text-slate-700">{opportunity.jobRole}</span> ({opportunity.opportunityType} • {opportunity.duration})
          </p>
        </div>

        {/* Student Profile Snapshot Card */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 mb-4 space-y-2 text-xs">
          <p className="font-semibold text-slate-700 flex items-center gap-1.5">
            <BadgeCheck className="h-4 w-4 text-blue-600" />
            Verified Student Profile Information
          </p>
          <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600 pt-1">
            <div>
              <span className="text-slate-400 block">Full Name</span>
              <span className="font-medium text-slate-800">{studentInfo.name || 'Student'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Roll / Student ID</span>
              <span className="font-medium text-slate-800">{studentInfo.studentId || '—'}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Department</span>
              <span className="font-medium text-slate-800">{studentInfo.department}</span>
            </div>
            <div>
              <span className="text-slate-400 block">Latest CGPA</span>
              <span className="font-medium text-slate-800">{studentInfo.cgpa ? studentInfo.cgpa.toFixed(2) : '—'}</span>
            </div>
          </div>
        </div>

        {/* Optional Resume Upload */}
        <div className="mb-5">
          <label className="label flex items-center justify-between">
            <span>Resume / CV (Optional)</span>
            <span className="text-[10px] text-[--text-muted]">PDF, DOCX up to 10MB</span>
          </label>
          <div className="mt-1 flex items-center justify-center border-2 border-dashed border-slate-200 hover:border-[--primary] rounded-xl p-4 transition-colors cursor-pointer relative bg-slate-50/50">
            <input
              type="file"
              accept=".pdf,.docx,.doc"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setResumeFile(e.target.files[0]);
                }
              }}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center text-center">
              <UploadCloud className="h-6 w-6 text-slate-400 mb-1" />
              {resumeFile ? (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 font-medium">
                  <FileText className="h-3.5 w-3.5" />
                  {resumeFile.name}
                </div>
              ) : (
                <p className="text-xs text-slate-500">
                  <span className="text-[--primary] font-semibold">Click to upload</span> or drag and drop
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="btn-secondary text-xs px-4 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="btn-primary text-xs px-5 py-2 flex items-center gap-1.5 font-semibold"
          >
            {applying ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Submitting Application...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                Confirm Application
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Faculty / HOD: Manage Postings & View Applicants ──────────────────────────

interface FacultyManageProps {
  onNewClick: () => void;
}

function FacultyManageOpportunities({ onNewClick }: FacultyManageProps): React.ReactElement {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOppId, setSelectedOppId] = useState<string | null>(null);
  const [applicants, setApplicants] = useState<OpportunityApplicant[]>([]);
  const [loadingApplicants, setLoadingApplicants] = useState(false);

  // Load all opportunities
  useEffect(() => {
    const q = query(collection(db, 'opportunities'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setOpportunities(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as Opportunity[]);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // When an opportunity is selected, load its applicants sub-collection
  useEffect(() => {
    if (!selectedOppId) {
      setApplicants([]);
      return;
    }

    setLoadingApplicants(true);
    const applicantsQuery = query(
      collection(db, 'opportunities', selectedOppId, 'applicants'),
      orderBy('appliedAt', 'desc')
    );

    const unsub = onSnapshot(
      applicantsQuery,
      (snap) => {
        setApplicants(snap.docs.map((d) => ({ ...d.data(), id: d.id })) as OpportunityApplicant[]);
        setLoadingApplicants(false);
      },
      (err) => {
        console.error('Failed to load applicants:', err);
        setLoadingApplicants(false);
      }
    );

    return () => unsub();
  }, [selectedOppId]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[--text]">Posted Opportunities Management</h2>
          <p className="text-xs text-[--text-muted]">
            View candidate applications submitted by students for each opening.
          </p>
        </div>
        <button
          onClick={onNewClick}
          className="btn-primary text-xs flex items-center gap-1.5 py-1.5 px-3 font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          Create New Posting
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-[--primary]" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="card text-center py-12">
          <Briefcase className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-600">No opportunities posted yet</p>
          <p className="text-xs text-[--text-muted] mt-1">
            Click "Create New Posting" to publish your first career opening.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Opportunities List */}
          <div className="space-y-3 lg:col-span-1">
            {opportunities.map((opp) => {
              const isSelected = selectedOppId === opp.id;
              return (
                <div
                  key={opp.id}
                  onClick={() => setSelectedOppId(opp.id)}
                  className={cn(
                    'card p-4 cursor-pointer transition-all border',
                    isSelected
                      ? 'border-[--primary] ring-2 ring-blue-100 bg-blue-50/20'
                      : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                        {opp.companyName}
                      </span>
                      <h4 className="text-sm font-bold text-[--text] truncate">{opp.jobRole}</h4>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 border',
                        opp.opportunityType === 'Internship' && 'bg-emerald-50 text-emerald-700 border-emerald-200',
                        opp.opportunityType === 'Job' && 'bg-blue-50 text-blue-700 border-blue-200',
                        opp.opportunityType === 'Hackathon' && 'bg-purple-50 text-purple-700 border-purple-200',
                        opp.opportunityType === 'Challenge' && 'bg-amber-50 text-amber-700 border-amber-200'
                      )}
                    >
                      {opp.opportunityType}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-500">
                    <span>{opp.duration}</span>
                    <span>•</span>
                    <span>{opp.salaryType === 'Paid' ? (opp.stipend || 'Paid') : 'Unpaid'}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Opportunity Applicants Viewer */}
          <div className="card p-5 lg:col-span-2 border border-slate-200">
            {selectedOppId ? (
              <div className="space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-[--text] flex items-center gap-2">
                    <Users className="h-4 w-4 text-[--primary]" />
                    Registered Applicants ({applicants.length})
                  </h3>
                  <p className="text-xs text-[--text-muted]">
                    Candidate applications for{' '}
                    <span className="font-semibold text-slate-700">
                      {opportunities.find((o) => o.id === selectedOppId)?.jobRole}
                    </span>{' '}
                    at{' '}
                    <span className="font-semibold text-slate-700">
                      {opportunities.find((o) => o.id === selectedOppId)?.companyName}
                    </span>
                  </p>
                </div>

                {loadingApplicants ? (
                  <div className="flex justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin text-[--primary]" />
                  </div>
                ) : applicants.length === 0 ? (
                  <div className="text-center py-10 text-xs text-[--text-muted]">
                    No students have applied to this posting yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {applicants.map((app) => (
                      <div key={app.id} className="py-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[--text]">{app.studentName || 'Student Candidate'}</p>
                          <p className="text-[11px] text-slate-500">
                            {app.studentEmail} • ID: {app.studentId || '—'} • {app.department || 'Computer Science'}
                            {app.cgpa !== undefined && ` • CGPA: ${app.cgpa.toFixed(2)}`}
                          </p>
                        </div>
                        {app.resumeUrl && (
                          <a
                            href={app.resumeUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn-secondary text-[11px] px-2.5 py-1 flex items-center gap-1 font-semibold flex-shrink-0"
                          >
                            <FileText className="h-3 w-3" />
                            Resume
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 text-xs text-[--text-muted]">
                Select an opportunity on the left to view registered student applicants.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
