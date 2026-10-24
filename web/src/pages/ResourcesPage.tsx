import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { db, storage } from '@/lib/firebase';
import {
  collection, addDoc, getDocs, getDoc, doc, onSnapshot, query,
  where, serverTimestamp, orderBy, limit
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { toast } from 'sonner';
import {
  Plus, FolderPlus, Upload, Folder, FolderOpen, FileText,
  ChevronRight, ArrowLeft, Loader2, BookOpen,
  X, LogIn, PlusCircle, CheckSquare, Square, AlertCircle
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Classroom {
  id: string;
  name?: string;
  classname: string;
  department: string;
  year: string;
  subject: string;
  division: string;
  createdBy: string;
  createdAt: any;
}

interface FolderNode {
  id: string;
  name: string;
  parentId: string | null;
  classroomId: string;
  createdAt: any;
}

interface FileNode {
  id: string;
  name: string;
  url: string;
  folderId: string | null;
  classroomId: string;
  uploadedAt: any;
}

export const DEPT_OPTIONS = ['Computer Science', 'Information Technology', 'Engineering', 'Other'];
export const YEAR_OPTIONS = ['First Year', 'Second Year', 'Third Year', 'Final Year'];
export const DIVISION_OPTIONS = ['A', 'B', 'C', 'D'];

export const normalizeDept = (raw: string): string => {
  const s = (raw || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['cs', 'cse', 'computerscience', 'compsci'].includes(s)) return 'Computer Science';
  if (['it', 'informationtechnology', 'infotech'].includes(s)) return 'Information Technology';
  if (['ds', 'datascience', 'datasci'].includes(s)) return 'Data Science';
  if (['eng', 'engineering'].includes(s)) return 'Engineering';
  return 'Other';
};

export const normalizeYear = (raw: string): string => {
  const s = (raw || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (['1', 'first', 'firstyear', 'fe', '1st', '1styear'].includes(s)) return 'First Year';
  if (['2', 'second', 'secondyear', 'se', '2nd', '2ndyear'].includes(s)) return 'Second Year';
  if (['3', 'third', 'thirdyear', 'te', '3rd', '3rdyear'].includes(s)) return 'Third Year';
  if (['4', 'final', 'fourth', 'finalyear', 'fourthyear', 'be', '4th', '4thyear'].includes(s)) return 'Final Year';
  return 'First Year';
};

// ── Root: role-aware entry point ──────────────────────────────────────────────

export function ResourcesPage(): React.ReactElement {
  const { claims } = useAuth();
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');
  const isStudent = claims?.roles.includes('STUDENT');

  if (isFaculty) return <FacultyResourcesPage />;
  if (isStudent) return <StudentResourcesPage />;
  return <div className="card p-8 text-center text-[--text-muted]">Unauthorized</div>;
}

// ── Student View: auto-joined classrooms ──────────────────────────────────────

function StudentResourcesPage() {
  const { user, claims } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [openClassroom, setOpenClassroom] = useState<Classroom | null>(null);
  const [studentTag, setStudentTag] = useState<{ dept: string; division: string; year: string } | null>(null);

  // Auto-join: query classrooms strictly matching student's department/division/year
  useEffect(() => {
    let isMounted = true;
    let unsubClassrooms: (() => void) | null = null;

    async function loadMatchingClassrooms() {
      try {
        let rawDept = claims?.deptId || (claims as any)?.department || '';
        let rawDiv = claims?.division || '';
        let rawYear = claims?.year || '';

        // 1. Authoritative check: fetch student document from Firestore
        let docData: any = null;
        if (claims?.studentId) {
          try {
            const sSnap = await getDoc(doc(db, 'students', claims.studentId));
            if (sSnap.exists()) docData = sSnap.data();
          } catch (e) {
            console.warn('Could not fetch student by claims.studentId:', e);
          }
        }

        if (!docData && user?.uid) {
          try {
            const sSnap = await getDoc(doc(db, 'students', user.uid));
            if (sSnap.exists()) {
              docData = sSnap.data();
            } else {
              const qSnap = await getDocs(query(collection(db, 'students'), where('authUid', '==', user.uid), limit(1)));
              if (!qSnap.empty) docData = qSnap.docs[0].data();
            }
          } catch (e) {
            console.warn('Could not fetch student by authUid:', e);
          }
        }

        if (docData) {
          rawDept = docData.department || docData.deptId || rawDept;
          rawDiv = docData.division || rawDiv;
          rawYear = docData.year || rawYear;
        }

        // 2. Fallback to localStorage cached roles if year is still not resolved
        if (!rawYear) {
          try {
            const cached = JSON.parse(localStorage.getItem('stellar_local_roles') || '{}');
            if (cached.year) rawYear = cached.year;
            if (!rawDept && cached.deptId) rawDept = cached.deptId;
            if (!rawDiv && cached.division) rawDiv = cached.division;
          } catch {}
        }

        const studentDept = normalizeDept(rawDept);
        const studentDiv = (rawDiv || 'A').toString().trim().toUpperCase();
        const studentYear = normalizeYear(rawYear);

        if (isMounted) {
          setStudentTag({ dept: studentDept, division: studentDiv, year: studentYear });
        }

        // 3. Query classrooms strictly matching student's department, division, and year
        const q = query(
          collection(db, 'classrooms'),
          where('department', '==', studentDept),
          where('division', '==', studentDiv),
          where('year', '==', studentYear)
        );

        unsubClassrooms = onSnapshot(
          q,
          (snap) => {
            if (!isMounted) return;
            const matched: Classroom[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as Classroom));
            setClassrooms(matched);
            setLoading(false);
          },
          (err) => {
            console.warn('Failed to listen to classrooms:', err);
            if (isMounted) setLoading(false);
          }
        );
      } catch (e) {
        console.warn('Failed to load classrooms:', e);
        if (isMounted) setLoading(false);
      }
    }

    loadMatchingClassrooms();

    return () => {
      isMounted = false;
      if (unsubClassrooms) unsubClassrooms();
    };
  }, [claims, user?.uid]);

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[--primary]" /></div>;

  if (openClassroom) {
    return (
      <ClassroomView
        classroom={openClassroom}
        isReadOnly
        onBack={() => setOpenClassroom(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-[--primary]" />
          My Classrooms
        </h1>
        <p className="text-sm text-[--text-muted] mt-1">
          Classrooms you are enrolled in based on your department, division, and year.
        </p>
        {studentTag && (
          <div className="flex items-center gap-2 mt-2.5 flex-wrap">
            <span className="text-xs text-[--text-muted] font-medium">Your Profile:</span>
            <span className="badge-primary text-xs">{studentTag.dept}</span>
            <span className="badge text-xs bg-slate-100 text-slate-700 font-semibold">Division {studentTag.division}</span>
            <span className="badge text-xs bg-blue-50 text-blue-700 font-semibold">{studentTag.year}</span>
          </div>
        )}
      </div>

      {classrooms.length === 0 ? (
        <div className="card text-center p-12 border-dashed border-2 border-gray-200">
          <AlertCircle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">No classrooms available</h3>
          <p className="text-sm text-[--text-muted] mt-1">
            Your teacher hasn't created a classroom matching your profile yet.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map(cls => (
            <button
              key={cls.id}
              onClick={() => setOpenClassroom(cls)}
              className="card text-left hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[--text] group-hover:text-[--primary] transition-colors truncate">{cls.classname}</p>
                  <p className="text-xs text-[--text-muted] mt-0.5">{cls.subject}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="badge-primary text-[10px]">{cls.department}</span>
                    <span className="badge text-[10px] bg-gray-100 text-gray-600">Div {cls.division}</span>
                    <span className="badge text-[10px] bg-gray-100 text-gray-600">{cls.year}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Faculty Resources Page ────────────────────────────────────────────────────

function FacultyResourcesPage() {
  const { user } = useAuth();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [loading, setLoading] = useState(true);
  const [openClassroom, setOpenClassroom] = useState<Classroom | null>(null);

  // "Add a Class" flow state
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addMode, setAddMode] = useState<'choose' | 'join' | 'create' | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create classroom form
  const [formClassname, setFormClassname] = useState('');
  const [formDept, setFormDept] = useState('Computer Science');
  const [formYear, setFormYear] = useState('First Year');
  const [formSubject, setFormSubject] = useState('');
  const [formDivision, setFormDivision] = useState('A');
  const [formLoading, setFormLoading] = useState(false);

  // Join classroom
  const [joinCode, setJoinCode] = useState('');

  // Load classrooms created by this faculty
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(collection(db, 'classrooms'), where('createdBy', '==', user.uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setClassrooms(snap.docs.map(d => ({ id: d.id, ...d.data() } as Classroom)));
      setLoading(false);
    }, err => {
      console.warn('Classrooms listener error:', err);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.uid) return;
    setFormLoading(true);
    try {
      await addDoc(collection(db, 'classrooms'), {
        name: formClassname.trim(),
        classname: formClassname.trim(),
        department: formDept,
        year: formYear,
        subject: formSubject.trim(),
        division: formDivision,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      toast.success(`Classroom "${formClassname}" created!`);
      setShowCreateModal(false);
      setAddMode(null);
      setConsentChecked(false);
      setFormClassname(''); setFormDept('Computer Science'); setFormYear('First Year');
      setFormSubject(''); setFormDivision('A');
    } catch (e) {
      console.error(e);
      toast.error('Failed to create classroom');
    } finally {
      setFormLoading(false);
    }
  };

  const handleJoinClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    toast.info(`Join code "${joinCode}" submitted. Ask the classroom owner to share the classroom ID directly.`);
    setJoinCode('');
    setAddMode(null);
  };

  if (openClassroom) {
    return (
      <ClassroomView
        classroom={openClassroom}
        isReadOnly={false}
        onBack={() => setOpenClassroom(null)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-[--primary]" />
            Resources &amp; Classrooms
          </h1>
          <p className="text-sm text-[--text-muted] mt-1">Create digital classrooms and manage study materials.</p>
        </div>

        {/* Add a Class button */}
        <div className="relative">
          <button
            onClick={() => { setShowAddMenu(!showAddMenu); setAddMode('choose'); }}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add a Class
          </button>

          {/* Dropdown menu: Join / Create */}
          {showAddMenu && addMode === 'choose' && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-30 overflow-hidden animate-fade-in">
              <button
                onClick={() => setAddMode('join')}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-[--text] hover:bg-blue-50 hover:text-[--primary] transition-colors"
              >
                <LogIn className="h-4 w-4" />
                Join a class
              </button>
              <div className="border-t border-gray-100" />
              <button
                onClick={() => setAddMode('create')}
                className="w-full flex items-center gap-2.5 px-4 py-3 text-sm font-medium text-[--text] hover:bg-blue-50 hover:text-[--primary] transition-colors"
              >
                <PlusCircle className="h-4 w-4" />
                Create a class
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Join a class panel ─────────────────────────────── */}
      {addMode === 'join' && (
        <div className="card border-blue-200 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[--text]">Join a Class</h3>
            <button onClick={() => { setAddMode(null); setShowAddMenu(false); }} className="btn-ghost p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleJoinClassroom} className="flex gap-3">
            <input
              className="input flex-1"
              placeholder="Enter classroom code…"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary flex items-center gap-1.5">
              <LogIn className="h-4 w-4" />
              Join
            </button>
          </form>
        </div>
      )}

      {/* ── Create a class: consent checkbox ─────────────────── */}
      {addMode === 'create' && !showCreateModal && (
        <div className="card border-blue-200 animate-fade-in max-w-lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-[--text]">Create a Class</h3>
            <button onClick={() => { setAddMode(null); setConsentChecked(false); setShowAddMenu(false); }} className="btn-ghost p-1">
              <X className="h-4 w-4" />
            </button>
          </div>

          <label className="flex items-start gap-3 cursor-pointer group select-none">
            <button
              type="button"
              onClick={() => setConsentChecked(!consentChecked)}
              className="mt-0.5 flex-shrink-0"
              aria-checked={consentChecked}
              role="checkbox"
            >
              {consentChecked
                ? <CheckSquare className="h-5 w-5 text-[--primary]" />
                : <Square className="h-5 w-5 text-gray-400 group-hover:text-[--primary] transition-colors" />}
            </button>
            <span className="text-sm text-[--text]">
              I consent to store this data in the database.
            </span>
          </label>

          <button
            onClick={() => { if (consentChecked) setShowCreateModal(true); }}
            disabled={!consentChecked}
            className="btn-primary mt-4 w-full flex justify-center items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            OK — Proceed to Create
          </button>
        </div>
      )}

      {/* ── Create Classroom Modal ─────────────────────────── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-[--text]">Create New Classroom</h2>
              <button
                onClick={() => { setShowCreateModal(false); setAddMode(null); setConsentChecked(false); setShowAddMenu(false); }}
                className="btn-ghost p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="label">Class Name <span className="text-red-500">*</span></label>
                <input className="input" required placeholder="e.g. Data Structures — 2024" value={formClassname} onChange={e => setFormClassname(e.target.value)} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Department <span className="text-red-500">*</span></label>
                  <select className="input" value={formDept} onChange={e => setFormDept(e.target.value)}>
                    {DEPT_OPTIONS.map(d => <option key={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Year <span className="text-red-500">*</span></label>
                  <select className="input" value={formYear} onChange={e => setFormYear(e.target.value)}>
                    {YEAR_OPTIONS.map(y => <option key={y}>{y}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Subject <span className="text-red-500">*</span></label>
                <input className="input" required placeholder="e.g. Data Structures & Algorithms" value={formSubject} onChange={e => setFormSubject(e.target.value)} />
              </div>

              <div>
                <label className="label">Division <span className="text-red-500">*</span></label>
                <select className="input" value={formDivision} onChange={e => setFormDivision(e.target.value)}>
                  {DIVISION_OPTIONS.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowCreateModal(false); setAddMode(null); setConsentChecked(false); setShowAddMenu(false); }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="btn-primary flex-1 flex justify-center items-center gap-2">
                  {formLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dismiss overlay on outside click */}
      {showAddMenu && addMode === 'choose' && (
        <div className="fixed inset-0 z-20" onClick={() => { setShowAddMenu(false); setAddMode(null); }} />
      )}

      {/* ── Classroom grid ────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[--primary]" /></div>
      ) : classrooms.length === 0 ? (
        <div className="card text-center p-12 border-dashed border-2 border-gray-200">
          <BookOpen className="h-8 w-8 text-blue-300 mx-auto mb-3" />
          <h3 className="font-semibold text-gray-700">No classrooms yet</h3>
          <p className="text-sm text-[--text-muted] mt-1">Click "Add a Class" to create your first digital classroom.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classrooms.map(cls => (
            <button
              key={cls.id}
              onClick={() => setOpenClassroom(cls)}
              className="card text-left hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                  <BookOpen className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-[--text] group-hover:text-[--primary] transition-colors truncate">{cls.classname}</p>
                  <p className="text-xs text-[--text-muted] mt-0.5">{cls.subject}</p>
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    <span className="badge-primary text-[10px]">{cls.department}</span>
                    <span className="badge text-[10px] bg-gray-100 text-gray-600">Div {cls.division}</span>
                    <span className="badge text-[10px] bg-gray-100 text-gray-600">{cls.year}</span>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Classroom View: folder tree + file upload ─────────────────────────────────

function ClassroomView({
  classroom,
  isReadOnly,
  onBack,
}: {
  classroom: Classroom;
  isReadOnly: boolean;
  onBack: () => void;
}) {
  const [folders, setFolders] = useState<FolderNode[]>([]);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumb, setBreadcrumb] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: classroom.classname },
  ]);
  const [loading, setLoading] = useState(true);

  // New folder
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderLoading, setFolderLoading] = useState(false);

  // File upload
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // Load folders and files for this classroom
  useEffect(() => {
    const foldersQ = query(
      collection(db, 'classroomFolders'),
      where('classroomId', '==', classroom.id)
    );
    const filesQ = query(
      collection(db, 'classroomFiles'),
      where('classroomId', '==', classroom.id)
    );

    let foldersDone = false;
    let filesDone = false;

    const unsubFolders = onSnapshot(foldersQ, snap => {
      setFolders(snap.docs.map(d => ({ id: d.id, ...d.data() } as FolderNode)));
      foldersDone = true;
      if (foldersDone && filesDone) setLoading(false);
    }, err => { console.warn(err); foldersDone = true; if (foldersDone && filesDone) setLoading(false); });

    const unsubFiles = onSnapshot(filesQ, snap => {
      setFiles(snap.docs.map(d => ({ id: d.id, ...d.data() } as FileNode)));
      filesDone = true;
      if (foldersDone && filesDone) setLoading(false);
    }, err => { console.warn(err); filesDone = true; if (foldersDone && filesDone) setLoading(false); });

    return () => { unsubFolders(); unsubFiles(); };
  }, [classroom.id]);

  // Current view: folders and files inside currentFolderId
  const visibleFolders = folders.filter(f => f.parentId === currentFolderId);
  const visibleFiles = files.filter(f => f.folderId === currentFolderId);

  const navigateIntoFolder = (folder: FolderNode) => {
    setCurrentFolderId(folder.id);
    setBreadcrumb(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateTo = (index: number) => {
    const crumb = breadcrumb[index];
    setCurrentFolderId(crumb.id);
    setBreadcrumb(prev => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setFolderLoading(true);
    try {
      await addDoc(collection(db, 'classroomFolders'), {
        name: newFolderName.trim(),
        parentId: currentFolderId,
        classroomId: classroom.id,
        createdAt: serverTimestamp(),
      });
      toast.success(`Folder "${newFolderName}" created`);
      setNewFolderName('');
      setShowNewFolder(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to create folder');
    } finally {
      setFolderLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadLoading(true);
    try {
      const path = `classrooms/${classroom.id}/${currentFolderId ?? 'root'}/${Date.now()}_${file.name}`;
      const sRef = storageRef(storage, path);
      const snap = await uploadBytes(sRef, file);
      const url = await getDownloadURL(snap.ref);

      await addDoc(collection(db, 'classroomFiles'), {
        name: file.name,
        url,
        folderId: currentFolderId,
        classroomId: classroom.id,
        uploadedAt: serverTimestamp(),
      });
      toast.success(`"${file.name}" uploaded successfully`);
    } catch (err) {
      console.error(err);
      toast.error('Upload failed. Check Firebase Storage rules.');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase() || '';
    const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'];
    const pdfExts = ['pdf'];
    if (imgExts.includes(ext)) return '🖼️';
    if (pdfExts.includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📑';
    if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
    return '📎';
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Back + Classroom header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="btn-ghost flex items-center gap-1.5 text-sm px-2 py-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <div className="h-5 w-px bg-gray-200" />
        <div>
          <h1 className="page-title leading-none">{classroom.classname}</h1>
          <p className="text-xs text-[--text-muted] mt-0.5">
            {classroom.subject} · {classroom.department} · Div {classroom.division} · {classroom.year}
          </p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-[--text-muted] flex-wrap">
        {breadcrumb.map((crumb, idx) => (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3.5 w-3.5" />}
            <button
              onClick={() => navigateTo(idx)}
              className={`font-medium transition-colors hover:text-[--primary] ${
                idx === breadcrumb.length - 1 ? 'text-[--text] cursor-default' : 'text-[--text-muted]'
              }`}
              disabled={idx === breadcrumb.length - 1}
            >
              {idx === 0 ? (
                <span className="flex items-center gap-1">
                  <Folder className="h-3.5 w-3.5" /> {crumb.name}
                </span>
              ) : crumb.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Action toolbar (faculty only) */}
      {!isReadOnly && (
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowNewFolder(true)}
            className="btn-secondary flex items-center gap-1.5 text-sm py-1.5"
          >
            <FolderPlus className="h-4 w-4" />
            New Folder
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading}
            className="btn-primary flex items-center gap-1.5 text-sm py-1.5"
          >
            {uploadLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Upload File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="*/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      )}

      {/* New folder inline form */}
      {showNewFolder && !isReadOnly && (
        <form onSubmit={handleCreateFolder} className="flex items-center gap-2 animate-fade-in">
          <Folder className="h-4 w-4 text-amber-500 flex-shrink-0" />
          <input
            className="input py-1.5 text-sm flex-1 max-w-xs"
            placeholder="Folder name…"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            autoFocus
            required
          />
          <button type="submit" disabled={folderLoading} className="btn-primary py-1.5 px-3 text-sm flex items-center gap-1">
            {folderLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create
          </button>
          <button type="button" onClick={() => { setShowNewFolder(false); setNewFolderName(''); }} className="btn-ghost py-1.5 px-3 text-sm">
            Cancel
          </button>
        </form>
      )}

      {/* File/Folder listing */}
      {loading ? (
        <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-[--primary]" /></div>
      ) : visibleFolders.length === 0 && visibleFiles.length === 0 ? (
        <div className="card text-center p-10 border-dashed border-2 border-gray-200">
          <FolderOpen className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-[--text-muted]">
            {isReadOnly ? 'No files or folders yet.' : 'This folder is empty. Create a folder or upload files.'}
          </p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[--text-muted] uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-[--text-muted] uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-[--text-muted] uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {/* Folders */}
              {visibleFolders.map(folder => (
                <tr key={folder.id} className="hover:bg-amber-50/60 transition-colors cursor-pointer" onClick={() => navigateIntoFolder(folder)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Folder className="h-5 w-5 text-amber-400" />
                      <span className="font-medium text-[--text]">{folder.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[--text-muted]">Folder</td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-auto" />
                  </td>
                </tr>
              ))}

              {/* Files */}
              {visibleFiles.map(file => (
                <tr key={file.id} className="hover:bg-blue-50/40 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg leading-none">{getFileIcon(file.name)}</span>
                      <span className="font-medium text-[--text] break-all">{file.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[--text-muted]">File</td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary text-xs py-1 px-2.5 inline-flex items-center gap-1"
                      onClick={e => e.stopPropagation()}
                    >
                      <FileText className="h-3 w-3" />
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
