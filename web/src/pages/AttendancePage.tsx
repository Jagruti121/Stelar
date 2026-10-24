import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, query, where, getDocs, doc, setDoc, 
  serverTimestamp, onSnapshot, writeBatch, orderBy 
} from 'firebase/firestore';
import { attendanceSummaryDoc } from '@/lib/firestore';
import { read, utils } from 'xlsx';
import { toast } from 'sonner';
import { 
  Loader2, CheckCircle2, UserX, Clock, 
  BookOpen, Layers, Users, Calendar, Sparkles, CheckCheck, 
  RotateCcw, Upload, FileSpreadsheet, Search, Check, History,
  ChevronDown, Filter
} from 'lucide-react';
import type { AttendanceSummary } from '@/types/firestore';

interface StudentRecord {
  id: string;
  name: string;
  rollNo: string;
  division: string;
  semester?: number;
  deptId?: string;
}

const COMMON_SUBJECTS = [
  'Data Structures & Algorithms',
  'Database Management Systems',
  'Operating Systems',
  'Computer Networks',
  'Web Development & Frameworks',
  'Artificial Intelligence & ML',
  'Software Engineering',
  'Cloud Computing',
  'Cyber Security',
  'Discrete Mathematics'
];

export default function AttendancePage(): React.ReactElement {
  const { claims, user, isFaculty, isHOD, isStudent } = useAuth();
  const canMarkAttendance = isFaculty || isHOD || claims?.roles?.includes('FACULTY') || claims?.roles?.includes('HOD');
  const isStudentRecord = (isStudent || claims?.roles?.includes('STUDENT')) && !canMarkAttendance;

  if (isStudentRecord) {
    return <StudentAttendanceView studentId={claims?.studentId as string} />;
  }

  if (canMarkAttendance) {
    return (
      <FacultyAttendancePortal 
        facultyId={user?.uid as string} 
        facultyName={user?.displayName || 'Faculty Member'} 
        deptId={claims?.deptId || 'cse'} 
      />
    );
  }

  return (
    <div className="p-8 text-center text-[--text-muted]">
      Unauthorized access. Please log in as a student, faculty member, or HOD.
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDENT VIEW
// ─────────────────────────────────────────────────────────────────────────────
function StudentAttendanceView({ studentId }: { studentId: string }) {
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setLoading(false);
      return;
    }
    const unsub = onSnapshot(
      attendanceSummaryDoc(studentId),
      (snap) => {
        if (snap.exists()) setSummary(snap.data());
        setLoading(false);
      },
      (err) => {
        console.warn('Attendance summary listener error:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [studentId]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[--primary]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div>
        <h1 className="page-title">My Attendance Record</h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Real-time record of your session attendance across enrolled subjects.
        </p>
      </div>

      {!summary || !summary.bySubject || Object.keys(summary.bySubject).length === 0 ? (
        <div className="card text-center py-12 text-[--text-muted]">
          <BookOpen className="h-10 w-10 mx-auto text-gray-300 mb-3" />
          <p className="font-medium text-gray-600">No attendance records logged yet</p>
          <p className="text-xs text-gray-400 mt-1">
            Attendance marked by your teachers will automatically appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Object.entries(summary.bySubject).map(([subjectId, data]) => {
            const percentage = data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
            const isDanger = percentage < 75;
            return (
              <div key={subjectId} className="card flex items-center justify-between border-l-4 border-l-blue-600">
                <div>
                  <p className="font-semibold text-gray-900 capitalize">
                    {subjectId.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-[--text-muted] mt-1">
                    {data.present} of {data.total} Hours Attended
                  </p>
                </div>
                <div className="text-right">
                  <span className={`text-2xl font-bold ${isDanger ? 'text-red-500' : 'text-green-600'}`}>
                    {percentage}%
                  </span>
                  <p className="text-[10px] text-gray-400">{isDanger ? 'Below 75%' : 'Good Standing'}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FACULTY / HOD ATTENDANCE MARKING PORTAL
// ─────────────────────────────────────────────────────────────────────────────
function FacultyAttendancePortal({ 
  facultyId, 
  facultyName, 
  deptId 
}: { 
  facultyId: string; 
  facultyName: string; 
  deptId: string; 
}) {
  // Tab state: 'mark' | 'history'
  const [activeTab, setActiveTab] = useState<'mark' | 'history'>('mark');

  // Session Configuration Form
  const [subjectName, setSubjectName] = useState('');
  const [semester, setSemester] = useState<number>(1);
  const [division, setDivision] = useState('A');
  const [lectureHours, setLectureHours] = useState<number>(1);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]);

  // Students & Positive Attendance State
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [fetchingStudents, setFetchingStudents] = useState(false);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadingExcel, setUploadingExcel] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-fetch students whenever Division or Semester changes
  useEffect(() => {
    fetchClassStudents();
  }, [semester, division]);

  const fetchClassStudents = async () => {
    setFetchingStudents(true);
    setPresentMap({});
    try {
      // 1. Query students matching selected Division (uppercase)
      let snap = await getDocs(query(
        collection(db, 'students'),
        where('division', '==', division.toUpperCase())
      ));

      // 2. Fallback to lowercase division if uppercase query returned empty
      if (snap.empty) {
        snap = await getDocs(query(
          collection(db, 'students'),
          where('division', '==', division.toLowerCase())
        ));
      }

      let fetched = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          name: data.name || 'Student',
          rollNo: String(data.rollNo || d.id.split('_').pop() || '').trim(),
          division: String(data.division || division).toUpperCase(),
          semester: data.semester !== undefined ? Number(data.semester) : undefined,
          deptId: data.deptId,
        } as StudentRecord;
      });

      // Filter by semester if semester is defined on students
      if (fetched.some(s => s.semester !== undefined)) {
        fetched = fetched.filter(s => s.semester === undefined || s.semester === semester);
      }

      // Sort numerically by Roll Number
      fetched.sort((a, b) => {
        const numA = parseInt(a.rollNo.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.rollNo.replace(/\D/g, ''), 10) || 0;
        return numA - numB;
      });

      setStudents(fetched);
    } catch (err) {
      console.error('Failed to fetch students:', err);
      toast.error('Could not load student list for this class.');
    } finally {
      setFetchingStudents(false);
    }
  };

  // Positive Attendance Toggle: Clicking marks present, default is absent
  const toggleStudent = (studentId: string) => {
    setPresentMap(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  // Select All Present
  const markAllPresent = () => {
    const all: Record<string, boolean> = {};
    students.forEach(s => { all[s.id] = true; });
    setPresentMap(all);
    toast.info(`Marked all ${students.length} students as present`);
  };

  // Clear All (Default all absent)
  const clearAll = () => {
    setPresentMap({});
    toast.info('Reset: all students defaulted to absent');
  };

  // Filtered students for quick in-class search
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.name.toLowerCase().includes(q) || 
      s.rollNo.toLowerCase().includes(q)
    );
  }, [students, searchQuery]);

  // Counts
  const presentCount = useMemo(() => {
    return Object.values(presentMap).filter(Boolean).length;
  }, [presentMap]);

  const absentCount = students.length - presentCount;

  // Submit Attendance Record
  const handleSubmitAttendance = async () => {
    if (!subjectName.trim()) {
      toast.error('Please enter or select a Subject Name first');
      return;
    }

    if (students.length === 0) {
      toast.error('No students available in this class to record attendance');
      return;
    }

    setSubmitting(true);
    try {
      const cleanSubject = subjectName.trim();
      const subjectKey = cleanSubject.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      
      const presentStudentIds: string[] = [];
      const absentStudentIds: string[] = [];
      const presentRolls: string[] = [];
      const absentRolls: string[] = [];

      students.forEach(s => {
        if (presentMap[s.id]) {
          presentStudentIds.push(s.id);
          presentRolls.push(s.rollNo);
        } else {
          absentStudentIds.push(s.id);
          absentRolls.push(s.rollNo);
        }
      });

      const uniqueTimestamp = Date.now();
      const sessionId = `${deptId}_sem${semester}_div${division}_${subjectKey}_${sessionDate}_${uniqueTimestamp}`;

      // Save complete AttendanceSession document
      await setDoc(doc(db, 'attendanceSessions', sessionId), {
        id: sessionId,
        subjectName: cleanSubject,
        subjectId: subjectKey,
        deptId: deptId.toLowerCase(),
        semester: Number(semester),
        division: division.toUpperCase(),
        date: sessionDate,
        lectureHours: Number(lectureHours),
        facultyId,
        facultyName,
        presentIds: presentStudentIds,
        absentIds: absentStudentIds,
        presentRolls,
        absentRolls,
        presentCount: presentStudentIds.length,
        absentCount: absentStudentIds.length,
        totalCount: students.length,
        timestamp: serverTimestamp(),
        createdAt: serverTimestamp(),
      });

      toast.success(
        `Attendance Saved! ${presentStudentIds.length} Present, ${absentStudentIds.length} Absent for ${lectureHours} hr (${cleanSubject}).`
      );

      // Reset selection for next session while preserving class settings
      setPresentMap({});
    } catch (err: any) {
      console.error('Error saving attendance:', err);
      toast.error(err.message || 'Failed to submit attendance');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Direct Excel Upload from Attendance View
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingExcel(true);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = read(buffer);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows: any[] = utils.sheet_to_json(sheet);

      if (rows.length === 0) {
        toast.error('The uploaded Excel sheet contains no rows.');
        return;
      }

      const batch = writeBatch(db);
      let count = 0;

      rows.forEach((row, idx) => {
        // Resolve roll number from common header names
        const rollRaw = row['Roll'] ?? row['Roll No'] ?? row['RollNo'] ?? row['Roll Number'] ?? row['Sr No'] ?? row['Sr. No.'] ?? (idx + 1);
        const nameRaw = row['Name'] ?? row['Student Name'] ?? row['StudentName'] ?? row['Full Name'] ?? `Student ${rollRaw}`;
        const divRaw = row['Division'] ?? row['Div'] ?? row['Section'] ?? division;
        const semRaw = row['Semester'] ?? row['Sem'] ?? semester;
        const deptRaw = row['Dept'] ?? row['Department'] ?? deptId;

        const cleanRoll = String(rollRaw).trim();
        const cleanName = String(nameRaw).trim();
        const cleanDiv = String(divRaw).trim().toUpperCase();
        const cleanSem = Number(semRaw) || semester;
        const cleanDept = String(deptRaw).trim().toLowerCase();

        const studentId = `${cleanDept}_sem${cleanSem}_div${cleanDiv}_${cleanRoll}`;
        const studentRef = doc(db, 'students', studentId);

        batch.set(studentRef, {
          id: studentId,
          rollNo: cleanRoll,
          name: cleanName,
          division: cleanDiv,
          semester: cleanSem,
          deptId: cleanDept,
          batch: new Date().getFullYear().toString(),
          isActive: false,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });

        count++;
      });

      await batch.commit();
      toast.success(`Successfully loaded ${count} students from Excel sheet!`);
      await fetchClassStudents();
    } catch (err: any) {
      console.error('Excel parse/upload error:', err);
      toast.error(err.message || 'Failed to process Excel file.');
    } finally {
      setUploadingExcel(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Generate Sample 61-Student Class for Quick Testing
  const handleGenerateSampleClass = async () => {
    setUploadingExcel(true);
    try {
      const batch = writeBatch(db);
      const firstNames = [
        'Aarav', 'Vivaan', 'Aditya', 'Vihaan', 'Arjun', 'Sai', 'Reyansh', 'Ayaan', 'Krishna', 'Ishaan',
        'Shaurya', 'Atharv', 'Advik', 'Pranav', 'Advaith', 'Kabir', 'Ananya', 'Diya', 'Gauri', 'Aadhya',
        'Saanvi', 'Kiara', 'Myra', 'Ira', 'Pari', 'Riya', 'Anushka', 'Navya', 'Avani', 'Sara',
        'Rohan', 'Dhruv', 'Siddharth', 'Tanmay', 'Kunal', 'Omkar', 'Yash', 'Varun', 'Tejas', 'Shubham',
        'Nikhil', 'Manish', 'Harsh', 'Mayur', 'Sameer', 'Pooja', 'Sneha', 'Sakshi', 'Neha', 'Priya',
        'Swati', 'Kavita', 'Shruti', 'Megha', 'Akanksha', 'Roshni', 'Bhavna', 'Komal', 'Deepak', 'Rahul', 'Chetan'
      ];

      for (let i = 1; i <= 61; i++) {
        const rollStr = String(i);
        const name = `${firstNames[(i - 1) % firstNames.length]} Sharma`;
        const studentId = `${deptId.toLowerCase()}_sem${semester}_div${division}_${rollStr}`;
        const ref = doc(db, 'students', studentId);

        batch.set(ref, {
          id: studentId,
          rollNo: rollStr,
          name: name,
          division: division.toUpperCase(),
          semester: Number(semester),
          deptId: deptId.toLowerCase(),
          batch: '2026',
          isActive: false,
          updatedAt: serverTimestamp(),
          createdAt: serverTimestamp(),
        }, { merge: true });
      }

      await batch.commit();
      toast.success(`Generated 61 students for Semester ${semester}, Division ${division}!`);
      await fetchClassStudents();
    } catch (err: any) {
      console.error('Sample class error:', err);
      toast.error('Could not generate sample class.');
    } finally {
      setUploadingExcel(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Session Attendance</h1>
          <p className="text-sm text-[--text-muted] mt-1">
            Choose class, duration, and mark attending students using Positive Attendance.
          </p>
        </div>

        {/* Hidden Excel File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept=".xlsx, .xls, .csv" 
          className="hidden" 
          onChange={handleExcelUpload} 
        />

        {/* Upload Excel Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingExcel}
            className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-2 font-medium shadow-sm hover:border-blue-400"
          >
            {uploadingExcel ? (
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            ) : (
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            )}
            Upload Excel Roster
          </button>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('mark')}
          className={`flex items-center gap-1.5 py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'mark'
              ? 'bg-white text-[--primary] shadow-sm border border-gray-200/80'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Mark Attendance
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 py-1.5 px-4 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'history'
              ? 'bg-white text-[--primary] shadow-sm border border-gray-200/80'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <History className="h-3.5 w-3.5" />
          View History
        </button>
      </div>

      {/* ── History Tab ──────────────────────────────────────── */}
      {activeTab === 'history' && (
        <AttendanceHistoryView deptId={deptId} />
      )}

      {activeTab === 'mark' && (
        <div className="space-y-4">

      {/* Control Panel / Filter Configuration */}
      <div className="card shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Subject Name / Selection */}
          <div className="lg:col-span-2">
            <label className="label flex items-center gap-1.5 font-medium">
              <BookOpen className="h-3.5 w-3.5 text-blue-600" />
              Subject Name <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                className="input font-medium"
                placeholder="Type or select subject..."
                value={subjectName}
                onChange={(e) => setSubjectName(e.target.value)}
                list="subject-suggestions"
                required
              />
              <datalist id="subject-suggestions">
                {COMMON_SUBJECTS.map((s, idx) => (
                  <option key={idx} value={s} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Semester (1 to 6) */}
          <div>
            <label className="label flex items-center gap-1.5 font-medium">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              Semester
            </label>
            <select
              className="input font-medium cursor-pointer"
              value={semester}
              onChange={(e) => setSemester(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5, 6].map((sem) => (
                <option key={sem} value={sem}>
                  Semester {sem}
                </option>
              ))}
            </select>
          </div>

          {/* Division (A, B, C, D) */}
          <div>
            <label className="label flex items-center gap-1.5 font-medium">
              <Users className="h-3.5 w-3.5 text-blue-600" />
              Division
            </label>
            <select
              className="input font-medium cursor-pointer"
              value={division}
              onChange={(e) => setDivision(e.target.value)}
            >
              {['A', 'B', 'C', 'D'].map((div) => (
                <option key={div} value={div}>
                  Division {div}
                </option>
              ))}
            </select>
          </div>

          {/* Lecture Hours Taken */}
          <div>
            <label className="label flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5 text-blue-600" />
              Lecture Hours
            </label>
            <select
              className="input font-medium cursor-pointer"
              value={lectureHours}
              onChange={(e) => setLectureHours(Number(e.target.value))}
            >
              <option value={1}>1 Hour</option>
              <option value={2}>2 Hours</option>
              <option value={3}>3 Hours</option>
              <option value={4}>4 Hours</option>
            </select>
          </div>
        </div>

        {/* Date Selector Row */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <span className="text-xs font-semibold text-gray-700">Session Date:</span>
            <input
              type="date"
              className="input py-1 px-2.5 text-xs w-auto cursor-pointer"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          <div className="text-xs text-[--text-muted]">
            Logged by: <span className="font-semibold text-gray-800">{facultyName}</span> ({deptId.toUpperCase()})
          </div>
        </div>
      </div>

      {/* Attendance Workspace */}
      <div className="space-y-4">
        {/* Attendance Statistics & Batch Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-xs uppercase tracking-wider text-gray-500 font-semibold block">Total Enrolled</span>
              <span className="text-xl font-bold text-gray-900">{students.length}</span>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <span className="text-xs uppercase tracking-wider text-green-700 font-semibold block">Present</span>
              <span className="text-xl font-bold text-green-600">{presentCount}</span>
            </div>
            <div className="h-8 w-px bg-gray-200" />
            <div>
              <span className="text-xs uppercase tracking-wider text-red-600 font-semibold block">Absent</span>
              <span className="text-xl font-bold text-red-500">{absentCount}</span>
            </div>
          </div>

          {/* Search & Quick Toggles */}
          {students.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter name or roll..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input py-1.5 pl-8 pr-3 text-xs w-44"
                />
              </div>

              <button
                type="button"
                onClick={markAllPresent}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-green-700 hover:bg-green-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Select All
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-gray-600 hover:bg-gray-100"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Clear All
              </button>
            </div>
          )}
        </div>

        {/* Instructions banner */}
        <div className="text-xs text-gray-500 bg-blue-50/70 border border-blue-200/80 rounded-lg p-2.5 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span>
            <strong>Positive Attendance Active:</strong> Simply click on the students who are <strong>Present</strong> (e.g., clicking 41 out of 61 marks 41 present and 20 absent). All unselected students default to <strong>Absent</strong>.
          </span>
        </div>

        {/* Student Cards Grid */}
        {fetchingStudents ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-xl border border-gray-100">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-sm font-medium text-gray-600">Auto-fetching student roster from database...</p>
          </div>
        ) : students.length === 0 ? (
          <div className="card text-center py-14 space-y-4">
            <UserX className="h-10 w-10 mx-auto text-gray-300" />
            <div>
              <p className="font-semibold text-gray-700">No Student Roster Found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                No student records exist for <strong>Semester {semester}, Division {division}</strong> in your department. 
                Upload an Excel sheet or load a sample class to begin.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingExcel}
                className="btn-primary py-2 px-4 text-xs flex items-center gap-2"
              >
                <Upload className="h-3.5 w-3.5" />
                Upload Excel Sheet (.xlsx)
              </button>

              <button
                type="button"
                onClick={handleGenerateSampleClass}
                disabled={uploadingExcel}
                className="btn-secondary py-2 px-4 text-xs flex items-center gap-2 text-blue-700 hover:bg-blue-50 border-blue-200"
              >
                <Users className="h-3.5 w-3.5 text-blue-600" />
                Load Sample Class (61 Students)
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {filteredStudents.map((student) => {
              const isPresent = !!presentMap[student.id];
              return (
                <div
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  className={`cursor-pointer select-none rounded-xl p-3 border transition-all duration-150 relative flex flex-col justify-between ${
                    isPresent
                      ? 'bg-emerald-50/90 border-emerald-500 shadow-sm ring-2 ring-emerald-500/25'
                      : 'bg-white border-gray-200 hover:border-gray-300 hover:bg-gray-50/60 opacity-80'
                  }`}
                >
                  {/* Top Badge: Roll & Status Icon */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${
                        isPresent
                          ? 'bg-emerald-200 text-emerald-900'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      #{student.rollNo}
                    </span>
                    {isPresent ? (
                      <div className="h-5 w-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="h-3 w-3 stroke-[3]" />
                      </div>
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-gray-300" />
                    )}
                  </div>

                  {/* Student Name */}
                  <p
                    className={`text-xs font-semibold line-clamp-2 leading-tight ${
                      isPresent ? 'text-emerald-950 font-bold' : 'text-gray-700'
                    }`}
                  >
                    {student.name}
                  </p>

                  {/* Bottom Indicator */}
                  <div className="mt-2.5 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isPresent ? 'text-emerald-700' : 'text-gray-400'
                      }`}
                    >
                      {isPresent ? 'Present' : 'Absent'}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      Div {student.division}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Submission Sticky Action Footer */}
        {students.length > 0 && (
          <div className="sticky bottom-4 z-20 flex items-center justify-between bg-white/95 backdrop-blur-md p-4 rounded-xl border border-gray-300 shadow-xl">
            <div className="text-xs">
              <span className="text-gray-500">Ready to submit:</span>{' '}
              <strong className="text-emerald-700 font-bold text-sm">{presentCount} Present</strong>,{' '}
              <strong className="text-rose-600 font-bold text-sm">{absentCount} Absent</strong>{' '}
              <span className="text-gray-500">({lectureHours} hr duration)</span>
            </div>

            <button
              type="button"
              onClick={handleSubmitAttendance}
              disabled={submitting || !subjectName.trim()}
              className="btn-primary py-2.5 px-6 font-semibold flex items-center gap-2 shadow-md hover:shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  Done
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )} {/* end activeTab === 'mark' */}
</div>
);
}

// ────────────────────────────────────────────────────────────────────────────────
// ATTENDANCE HISTORY VIEW (Faculty/HOD) — filterable by dept, class, date
// ────────────────────────────────────────────────────────────────────────────────
interface AttendanceSessionRecord {
  id: string;
  subjectName: string;
  subjectId: string;
  deptId: string;
  semester: number;
  division: string;
  date: string;
  lectureHours: number;
  facultyName: string;
  presentIds: string[];
  absentIds: string[];
  presentRolls: string[];
  absentRolls: string[];
  presentCount: number;
  absentCount: number;
  totalCount: number;
  createdAt: any;
}

function AttendanceHistoryView({ deptId }: { deptId: string }) {
  const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [filterDivision, setFilterDivision] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [filterSubject, setFilterSubject] = useState('');

  useEffect(() => {
    setLoading(true);
    // Load all sessions ordered by date desc
    const q = query(
      collection(db, 'attendanceSessions'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const records: AttendanceSessionRecord[] = snap.docs.map(d => {
        const data = d.data() as any;
        return {
          id: d.id,
          subjectName: data.subjectName || data.subjectId || '—',
          subjectId: data.subjectId || '',
          deptId: data.deptId || '',
          semester: data.semester || 0,
          division: data.division || '',
          date: data.date || '',
          lectureHours: data.lectureHours || 1,
          facultyName: data.facultyName || 'Faculty',
          presentIds: data.presentIds || [],
          absentIds: data.absentIds || [],
          presentRolls: data.presentRolls || [],
          absentRolls: data.absentRolls || [],
          presentCount: data.presentCount || 0,
          absentCount: data.absentCount || 0,
          totalCount: data.totalCount || 0,
          createdAt: data.createdAt,
        };
      });
      setSessions(records);
      setLoading(false);
    }, (err) => {
      console.warn('Attendance history listener:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [deptId]);

  const filtered = useMemo(() => {
    return sessions.filter(s => {
      const divMatch = filterDivision === 'ALL' || s.division.toUpperCase() === filterDivision;
      const semMatch = filterSemester === 'ALL' || String(s.semester) === filterSemester;
      const dateMatch = !filterDate || s.date === filterDate;
      const subjMatch = !filterSubject.trim() || s.subjectName.toLowerCase().includes(filterSubject.toLowerCase());
      return divMatch && semMatch && dateMatch && subjMatch;
    });
  }, [sessions, filterDivision, filterSemester, filterDate, filterSubject]);

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="card shadow-sm border border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-[--primary]" />
          <h3 className="font-semibold text-sm text-[--text]">Filter Attendance Records</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Division Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Division</label>
            <select
              className="input py-1.5 text-xs font-medium"
              value={filterDivision}
              onChange={e => setFilterDivision(e.target.value)}
            >
              <option value="ALL">All Divisions</option>
              {['A', 'B', 'C', 'D'].map(div => (
                <option key={div} value={div}>Division {div}</option>
              ))}
            </select>
          </div>

          {/* Semester Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Semester</label>
            <select
              className="input py-1.5 text-xs font-medium"
              value={filterSemester}
              onChange={e => setFilterSemester(e.target.value)}
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6].map(sem => (
                <option key={sem} value={String(sem)}>Semester {sem}</option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Date</label>
            <input
              type="date"
              className="input py-1.5 text-xs"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
            />
          </div>

          {/* Subject Filter */}
          <div>
            <label className="text-[10px] font-bold uppercase text-gray-500 mb-1 block">Subject</label>
            <input
              type="text"
              className="input py-1.5 text-xs"
              placeholder="Search subject..."
              value={filterSubject}
              onChange={e => setFilterSubject(e.target.value)}
            />
          </div>
        </div>

        {(filterDivision !== 'ALL' || filterSemester !== 'ALL' || filterDate || filterSubject) && (
          <button
            type="button"
            onClick={() => { setFilterDivision('ALL'); setFilterSemester('ALL'); setFilterDate(''); setFilterSubject(''); }}
            className="mt-3 text-xs text-[--primary] font-semibold hover:underline flex items-center gap-1"
          >
            <RotateCcw className="h-3 w-3" /> Clear Filters
          </button>
        )}
      </div>

      {/* Result count */}
      <p className="text-xs text-[--text-muted] font-medium">
        Showing <span className="font-bold text-[--text]">{filtered.length}</span> of {sessions.length} attendance sessions
      </p>

      {/* Session List */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-[--primary]" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-14">
          <Calendar className="h-10 w-10 text-gray-300 mx-auto mb-2" />
          <p className="font-semibold text-gray-600">No attendance sessions found</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting your filters or mark attendance for a class first.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(session => {
            const pct = session.totalCount > 0 ? Math.round((session.presentCount / session.totalCount) * 100) : 0;
            const isExpanded = expandedId === session.id;
            return (
              <div key={session.id} className="card border border-gray-200 shadow-sm overflow-hidden">
                {/* Session Header */}
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : session.id)}
                  className="w-full text-left"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-50 rounded-lg">
                        <Calendar className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-[--text]">{session.subjectName}</p>
                        <p className="text-xs text-[--text-muted]">
                          Sem {session.semester} · Div {session.division} · {session.lectureHours}hr
                          {session.facultyName ? ` · ${session.facultyName}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                          {session.date}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          {session.presentCount}✓ Present
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                          {session.absentCount}✗ Absent
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          pct >= 75 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {pct}%
                        </span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </button>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Present Students */}
                    <div>
                      <h4 className="text-xs font-bold text-green-700 mb-2 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Present ({session.presentCount})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {session.presentRolls.length > 0 ? session.presentRolls.map((roll, i) => (
                          <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 rounded-full">
                            #{roll}
                          </span>
                        )) : (
                          <span className="text-xs text-gray-400">No data available</span>
                        )}
                      </div>
                    </div>

                    {/* Absent Students */}
                    <div>
                      <h4 className="text-xs font-bold text-red-600 mb-2 flex items-center gap-1.5">
                        <UserX className="h-3.5 w-3.5" />
                        Absent ({session.absentCount})
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {session.absentRolls.length > 0 ? session.absentRolls.map((roll, i) => (
                          <span key={i} className="text-[10px] font-mono px-2 py-0.5 bg-red-50 text-red-700 border border-red-200 rounded-full">
                            #{roll}
                          </span>
                        )) : (
                          <span className="text-xs text-gray-400">All present or no data</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
