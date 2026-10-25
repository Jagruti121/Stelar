import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Loader2, Award, BookOpen, Search, UserCheck, GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';
import type { Result } from '@/types/firestore';
import { normalizeDepartment } from '@/pages/NotificationsPage';

export default function ResultsPage(): React.ReactElement {
  const { user, claims } = useAuth();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');
  const isStudent = claims?.roles.includes('STUDENT');

  const [studentInfo, setStudentInfo] = useState<{ name?: string; rollNo?: string; department?: string; year?: string } | null>(null);
  const [rollInput, setRollInput] = useState<string>('');
  const [activeRoll, setActiveRoll] = useState<string>('');
  // FIX 2: Track selected semester independently — never force-override it
  const [semester, setSemester] = useState<number>(1);
  const [availableSemesters, setAvailableSemesters] = useState<number[]>([]);
  const [resultsMap, setResultsMap] = useState<Record<number, Result>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  // 1. Initial resolution of student's roll number or default roll number
  useEffect(() => {
    let isMounted = true;

    async function initStudent() {
      setLoading(true);
      let resolvedRoll = (claims as any)?.rollNo || '';
      let resolvedName = (claims as any)?.name || user?.displayName || '';
      let resolvedDept = claims?.deptId || 'Computer Science';
      let resolvedSem = 1;

      if (user?.uid) {
        // Try fetching student record by authUid
        try {
          const q = query(collection(db, 'students'), where('authUid', '==', user.uid));
          const snap = await getDocs(q);
          if (!snap.empty) {
            const data = snap.docs[0].data();
            resolvedRoll = data.rollNo || resolvedRoll;
            resolvedName = data.name || resolvedName;
            resolvedDept = data.department || data.deptId || resolvedDept;
            resolvedSem = Number(data.semester || data.sem) || resolvedSem;
            if (isMounted) {
              setStudentInfo({
                name: resolvedName,
                rollNo: resolvedRoll,
                department: resolvedDept,
                year: data.year ? `${data.year} Year` : undefined
              });
            }
          } else if (claims?.studentId) {
            const sDoc = await getDoc(doc(db, 'students', claims.studentId));
            if (sDoc.exists()) {
              const data = sDoc.data();
              resolvedRoll = data.rollNo || resolvedRoll;
              resolvedName = data.name || resolvedName;
              resolvedDept = data.department || data.deptId || resolvedDept;
              resolvedSem = Number(data.semester || data.sem) || resolvedSem;
              if (isMounted) {
                setStudentInfo({
                  name: resolvedName,
                  rollNo: resolvedRoll,
                  department: resolvedDept,
                  year: data.year ? `${data.year} Year` : undefined
                });
              }
            }
          }
        } catch (e) {
          console.warn('Error fetching student document:', e);
        }
      }

      // If rollNo still not found, check studentId claim (e.g. student_CS1001 -> CS1001)
      if (!resolvedRoll && claims?.studentId) {
        resolvedRoll = claims.studentId.replace(/^student_/i, '');
      }

      // If user is faculty and no roll found, default to CS1001
      if (!resolvedRoll && isFaculty) {
        resolvedRoll = 'CS1001';
      }

      if (isMounted) {
        if (resolvedSem > 1) {
          setSemester(resolvedSem);
        }
        setRollInput(resolvedRoll || 'CS1001');
        setActiveRoll(resolvedRoll || 'CS1001');
        setLoading(false);
      }
    }

    initStudent();

    return () => {
      isMounted = false;
    };
  }, [user?.uid, claims, isFaculty]);

  // 2. Fetch all academic results for activeRoll in one parallel operation
  useEffect(() => {
    if (!activeRoll) return;

    let isMounted = true;
    setSearching(true);
    setStudentInfo(null);

    async function loadResults() {
      const rollClean = activeRoll.trim();
      const rollUpper = rollClean.toUpperCase();
      const rollLower = rollClean.toLowerCase();

      try {
        // Resolve student name / info if not already resolved
        try {
          const qRoll = query(collection(db, 'students'), where('rollNo', '==', rollClean));
          const qUpper = query(collection(db, 'students'), where('rollNo', '==', rollUpper));
          const [sSnap1, sSnap2] = await Promise.all([
            getDocs(qRoll).catch(() => null),
            getDocs(qUpper).catch(() => null)
          ]);
          const docSnap = (sSnap1 && !sSnap1.empty) ? sSnap1.docs[0] : (sSnap2 && !sSnap2.empty ? sSnap2.docs[0] : null);

          if (docSnap && isMounted) {
            const data = docSnap.data();
            setStudentInfo({
              name: data.name || undefined,
              rollNo: data.rollNo || rollClean,
              department: data.department ? normalizeDepartment(data.department) : (data.deptId ? normalizeDepartment(data.deptId) : undefined),
              year: data.year ? `${data.year} Year` : undefined,
            });
          } else {
            const studentDocCandidates = [
              `student_${rollUpper}`,
              `student_${rollLower}`,
              rollUpper,
              rollLower
            ];
            if (claims?.studentId) studentDocCandidates.unshift(claims.studentId);

            for (const sId of studentDocCandidates) {
              const sSnap = await getDoc(doc(db, 'students', sId)).catch(() => null);
              if (sSnap && sSnap.exists() && isMounted) {
                const data = sSnap.data();
                setStudentInfo({
                  name: data.name || undefined,
                  rollNo: data.rollNo || rollClean,
                  department: data.department ? normalizeDepartment(data.department) : (data.deptId ? normalizeDepartment(data.deptId) : undefined),
                  year: data.year ? `${data.year} Year` : undefined,
                });
                break;
              }
            }
          }
        } catch (e) {
          console.warn('Student profile lookup failed:', e);
        }

        // Parallel fetch for all results belonging to this student
        const bySemester: Record<number, Result> = {};

        const addResult = (data: any, docId: string) => {
          if (!data || !data.subjectMarks || !Array.isArray(data.subjectMarks)) return;
          const s = Number(data.semester);
          if (!s || s < 1 || s > 8) return;
          bySemester[s] = {
            id: docId,
            studentId: data.studentId || docId,
            semester: s,
            sgpa: typeof data.sgpa === 'number' ? data.sgpa : (Number(data.sgpa) || 0),
            subjectMarks: data.subjectMarks,
            uploadedBy: data.uploadedBy || '',
            uploadedAt: data.uploadedAt || null,
          } as Result;
        };

        const resultsRef = collection(db, 'results');

        // Build list of specific doc IDs across all semesters
        const directDocIds: string[] = [];
        const baseIds = [
          rollUpper,
          rollLower,
          `student_${rollUpper}`,
          `student_${rollLower}`,
        ];
        if (claims?.studentId) baseIds.push(claims.studentId);

        const depts = [(claims?.deptId || 'cs'), 'cs', 'cse', 'it', 'ds'].map(d => d.toLowerCase());
        for (let s = 1; s <= 8; s++) {
          for (const b of baseIds) {
            directDocIds.push(`${b}_${s}`);
          }
          for (const d of depts) {
            directDocIds.push(`${d}_sem${s}_diva_${rollLower}_${s}`);
            directDocIds.push(`${d}_sem${s}_divb_${rollLower}_${s}`);
            directDocIds.push(`${d}_sem${s}_diva_${rollLower}`);
            directDocIds.push(`${d}_sem${s}_divb_${rollLower}`);
          }
        }

        // Execute all queries and direct doc lookups simultaneously
        const [
          qRollSnap,
          qUpperSnap,
          qSidSnap,
          allDocsSnap,
          ...directSnaps
        ] = await Promise.all([
          getDocs(query(resultsRef, where('rollNo', '==', rollClean))).catch(() => null),
          getDocs(query(resultsRef, where('rollNo', '==', rollUpper))).catch(() => null),
          getDocs(query(resultsRef, where('studentId', '==', `student_${rollUpper}`))).catch(() => null),
          getDocs(resultsRef).catch(() => null),
          ...directDocIds.map(id => getDoc(doc(db, 'results', id)).catch(() => null))
        ]);

        // 1. Process query results
        [qRollSnap, qUpperSnap, qSidSnap].forEach(snap => {
          if (snap && !snap.empty) {
            snap.docs.forEach(d => addResult(d.data(), d.id));
          }
        });

        // 2. Process direct doc lookups
        directSnaps.forEach(snap => {
          if (snap && snap.exists && snap.exists()) {
            addResult(snap.data(), snap.id);
          }
        });

        // 3. Process entire collection snapshot as fallback matching
        if (allDocsSnap && !allDocsSnap.empty) {
          allDocsSnap.docs.forEach(d => {
            const data = d.data();
            const dRoll = String(data.rollNo || '').trim().toUpperCase();
            const dSid = String(data.studentId || '').trim().toUpperCase();
            const idUpper = d.id.toUpperCase();

            const isMatch =
              dRoll === rollUpper ||
              dSid === rollUpper ||
              dSid === `STUDENT_${rollUpper}` ||
              idUpper.startsWith(`${rollUpper}_`) ||
              idUpper.startsWith(`STUDENT_${rollUpper}_`) ||
              idUpper.includes(`_${rollUpper}_`) ||
              idUpper.includes(`_${rollLower}_`);

            if (isMatch) {
              addResult(data, d.id);
            }
          });
        }

        if (isMounted) {
          setResultsMap(bySemester);
          const published = Object.keys(bySemester).map(Number).sort((a, b) => a - b);
          setAvailableSemesters(published);
          setResult(bySemester[semester] || null);
        }
      } catch (err) {
        console.error('Error loading results:', err);
      } finally {
        if (isMounted) {
          setSearching(false);
          setLoading(false);
        }
      }
    }

    loadResults();

    return () => {
      isMounted = false;
    };
  }, [activeRoll]);

  // 3. Instant local semester switch
  useEffect(() => {
    setResult(resultsMap[semester] || null);
  }, [semester, resultsMap]);

  const handleSearchRoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (rollInput.trim()) {
      // FIX 1: Changing activeRoll triggers the main useEffect which re-resolves student name
      setActiveRoll(rollInput.trim());
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <GraduationCap className="h-7 w-7 text-[--primary]" />
            Academic Results
          </h1>
          <p className="text-sm text-[--text-muted] mt-1">
            {isStudent 
              ? 'View your semester grades, marks, and SGPA.' 
              : 'Search and inspect student performance by roll number.'}
          </p>
        </div>

        {/* Semester Selector — FIX 2: onChange only sets semester state, never redirects */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[--text-muted]">Semester:</label>
          <select 
            className="input w-44 font-semibold text-sm"
            value={semester}
            onChange={(e) => setSemester(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8].map(s => (
              <option key={s} value={s}>
                Semester {s} {availableSemesters.includes(s) ? '✓ (Published)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Student Profile / Roll Number Search Card */}
      <div className="card border-blue-100 bg-gradient-to-r from-blue-50/50 via-white to-blue-50/30">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
              {activeRoll ? activeRoll.substring(0, 4).toUpperCase() : 'ST'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                {/* FIX 1: studentInfo is cleared and re-fetched when activeRoll changes */}
                <h3 className="font-bold text-lg text-[--text]">
                  {studentInfo?.name || `Student (${activeRoll.toUpperCase()})`}
                </h3>
                <span className="badge-primary text-xs font-semibold">
                  Roll: {activeRoll.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-[--text-muted] mt-0.5">
                {studentInfo?.department || 'Computer Science Department'} 
                {studentInfo?.year ? ` • ${studentInfo.year}` : ''}
              </p>
            </div>
          </div>

          {/* Roll Number Lookup Form */}
          <form onSubmit={handleSearchRoll} className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Enter Roll No (e.g. CS1001)"
                value={rollInput}
                onChange={(e) => setRollInput(e.target.value)}
                className="input py-2 pl-3 pr-8 text-sm w-56 font-medium uppercase"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="btn-primary py-2 px-4 flex items-center gap-1.5 text-sm whitespace-nowrap"
            >
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Lookup
            </button>
          </form>
        </div>

        {/* Available Semesters Pills */}
        {availableSemesters.length > 0 && (
          <div className="mt-4 pt-3 border-t border-blue-100/60 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-[--text-muted]">Published Semesters:</span>
            {availableSemesters.map(s => (
              <button
                key={s}
                onClick={() => setSemester(s)}
                className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-all ${
                  semester === s
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-50'
                }`}
              >
                Semester {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Results Display */}
      {loading || searching ? (
        <div className="flex flex-col items-center justify-center p-16 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[--primary]" />
          <p className="text-xs text-[--text-muted] font-medium">Fetching academic records...</p>
        </div>
      ) : !result ? (
        // FIX 2: Render a clear "not published" fallback — no redirect
        <div className="card text-center p-12 border-dashed border-2 border-gray-200">
          <AlertCircle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold text-lg text-gray-800">No result published yet</h3>
          <p className="text-sm text-[--text-muted] mt-1 max-w-md mx-auto">
            No academic marks have been published for Roll Number{' '}
            <span className="font-bold text-[--text]">{activeRoll.toUpperCase()}</span>{' '}
            in Semester {semester}.
          </p>
          {availableSemesters.length > 0 && (
            <p className="text-xs text-blue-600 mt-3 font-medium">
              Tip: Click one of the published semester pills above to view available results.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Performance Overview KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="card bg-gradient-to-br from-blue-600 to-indigo-700 text-white flex items-center justify-between p-5 shadow-sm">
              <div>
                <p className="text-xs font-medium text-blue-100 uppercase tracking-wider">Semester SGPA</p>
                <div className="text-3xl font-extrabold mt-1">
                  {result.sgpa.toFixed(2)}
                </div>
                <p className="text-xs text-blue-200 mt-1">Semester {semester} Performance</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Award className="h-7 w-7 text-white" />
              </div>
            </div>

            <div className="card bg-white border border-gray-200 flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">Total Subjects</p>
                <div className="text-3xl font-bold text-[--text] mt-1">
                  {result.subjectMarks?.length || 0}
                </div>
                <p className="text-xs text-[--text-muted] mt-1">Courses Evaluated</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center">
                <BookOpen className="h-6 w-6 text-blue-600" />
              </div>
            </div>

            <div className="card bg-white border border-gray-200 flex items-center justify-between p-5">
              <div>
                <p className="text-xs font-semibold text-[--text-muted] uppercase tracking-wider">Result Status</p>
                <div className="text-2xl font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 className="h-6 w-6" />
                  Passed
                </div>
                <p className="text-xs text-[--text-muted] mt-1">Eligible for promotion</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                <UserCheck className="h-6 w-6 text-emerald-600" />
              </div>
            </div>
          </div>

          {/* Subject-wise Marks Table */}
          <div className="card p-0 overflow-hidden shadow-sm border border-gray-200">
            <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-gray-800 text-sm">Subject Breakdown &amp; Grades</h3>
              <span className="text-xs text-[--text-muted]">Semester {semester}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-white border-b border-gray-100 text-[--text-muted] font-semibold text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4">Subject Code</th>
                    <th className="px-6 py-4 text-center">Marks Obtained</th>
                    <th className="px-6 py-4 text-center">Max Marks</th>
                    <th className="px-6 py-4 text-center">Percentage</th>
                    <th className="px-6 py-4 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {result.subjectMarks?.map((mark, idx) => {
                    const pct = mark.maxMarks > 0 ? Math.round((mark.marks / mark.maxMarks) * 100) : 0;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <BookOpen className="h-4 w-4 text-blue-500" />
                            <span className="font-bold text-gray-900">{mark.subjectCode}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-gray-800">
                          {mark.marks}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-500 font-medium">
                          {mark.maxMarks}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-600 font-medium">
                          {pct}%
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-md text-xs font-bold ${
                            ['O', 'A+', 'A'].includes(mark.grade) ? 'bg-emerald-100 text-emerald-800' :
                            ['B+', 'B', 'C'].includes(mark.grade) ? 'bg-blue-100 text-blue-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {mark.grade}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
