import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2, GraduationCap, Briefcase } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { AuthLayout } from '@/components/layout/AuthLayout';

type LoginRole = 'STUDENT' | 'FACULTY';

export default function LoginPage(): React.ReactElement {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<LoginRole>('STUDENT');
  
  // Student form state
  const [studentIdentifier, setStudentIdentifier] = useState('');
  const [studentPassword, setStudentPassword] = useState('');
  
  // Faculty form state
  const [facultyEmpId, setFacultyEmpId] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');

  const [loading, setLoading] = useState(false);

  // Proactively clear any legacy lockout
  useEffect(() => {
    localStorage.removeItem('stellar_login_attempts');
  }, []);

  // Handle Student Login
  const handleStudentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const rawInput = studentIdentifier.trim();
      let emailToUse = rawInput.toLowerCase();

      // If user entered a Student Roll Number or ID (does not contain '@')
      if (!rawInput.includes('@')) {
        let foundEmail: string | null = null;

        // 1. Check local student map first
        try {
          const map = JSON.parse(localStorage.getItem('stellar_student_map') || '{}');
          if (map[rawInput]) {
            foundEmail = map[rawInput];
          }
        } catch {
          // ignore
        }

        // 2. Query Firestore by rollNo
        if (!foundEmail) {
          try {
            const qRoll = query(collection(db, 'students'), where('rollNo', '==', rawInput));
            const snapRoll = await getDocs(qRoll);
            if (!snapRoll.empty && snapRoll.docs[0].data().email) {
              foundEmail = snapRoll.docs[0].data().email;
            } else {
              // Try document ID matching
              const qId = query(collection(db, 'students'), where('id', '==', `student_${rawInput}`));
              const snapId = await getDocs(qId);
              if (!snapId.empty && snapId.docs[0].data().email) {
                foundEmail = snapId.docs[0].data().email;
              }
            }
          } catch (dbErr) {
            console.warn('Student roll lookup error:', dbErr);
          }
        }

        if (foundEmail) {
          emailToUse = foundEmail.toLowerCase();
        } else {
          // Synthetic fallback
          emailToUse = `${rawInput.replace(/_/g, '.').toLowerCase()}@students.stellar.local`;
        }
      }

      await signInWithEmailAndPassword(auth, emailToUse, studentPassword);
      toast.success('Welcome back! Logged in successfully.');
      navigate('/app/dashboard');
    } catch (error: any) {
      console.error('Student login error:', error);
      let msg = 'Invalid email or password';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Incorrect password. Please verify and try again.';
      } else if (error.code === 'auth/user-not-found') {
        msg = 'Student account not found. If this is your first time, please activate your account.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a few moments.';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'Email/Password authentication is disabled in Firebase Console.';
      } else if (error.message) {
        msg = error.message;
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Handle Faculty Login
  const handleFacultyLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const rawInput = facultyEmpId.trim();
      let emailToUse = rawInput.toLowerCase();

      // If user entered Employee ID (does not contain '@')
      if (!rawInput.includes('@')) {
        let foundEmail: string | null = null;

        // 1. Check locally cached employee ID mapping first
        try {
          const empMap = JSON.parse(localStorage.getItem('stellar_emp_map') || '{}');
          if (empMap[rawInput.toUpperCase()]) {
            foundEmail = empMap[rawInput.toUpperCase()];
          } else if (empMap[rawInput.toLowerCase()]) {
            foundEmail = empMap[rawInput.toLowerCase()];
          }
        } catch (e) {
          // ignore
        }

        // 2. If not found in cache, attempt Firestore query
        if (!foundEmail) {
          try {
            const q = query(collection(db, 'staff'), where('employeeId', '==', rawInput));
            const snap = await getDocs(q);
            if (!snap.empty) {
              foundEmail = snap.docs[0].data().email;
            } else {
              const allStaffSnap = await getDocs(collection(db, 'staff'));
              const matchingDoc = allStaffSnap.docs.find(
                d => d.data().employeeId?.toString().trim().toLowerCase() === rawInput.toLowerCase()
              );
              if (matchingDoc) {
                foundEmail = matchingDoc.data().email;
              }
            }
          } catch (dbErr) {
            console.warn('Firestore employee ID lookup failed/unauthorized:', dbErr);
          }
        }

        // 3. Fallback: standard campus domain
        emailToUse = foundEmail ? foundEmail.toLowerCase() : `${rawInput.toLowerCase()}@stellar.edu`;
      }

      await signInWithEmailAndPassword(auth, emailToUse, facultyPassword);
      toast.success('Welcome back, Professor! Logged in successfully.');
      navigate('/app/dashboard');
    } catch (error: any) {
      console.error('Faculty login error:', error);
      let msg = error.message || 'Invalid Employee ID or password';
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        msg = 'Incorrect password. Please verify and try again.';
      } else if (error.code === 'auth/user-not-found') {
        msg = 'No staff account found for this Employee ID. Please register first.';
      } else if (error.code === 'auth/too-many-requests') {
        msg = 'Too many failed login attempts. Please wait a few moments.';
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to STELLAR"
      subtitle="Sign in to your collegiate portal"
    >
      <div className="space-y-6">
        {/* Role Toggle Tabs */}
        <div className="flex rounded-xl bg-gray-100 p-1 border border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('STUDENT')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'STUDENT'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            Student Login
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('FACULTY')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'FACULTY'
                ? 'bg-white text-blue-600 shadow-sm border border-gray-200/80'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Briefcase className="h-4 w-4" />
            Faculty Login
          </button>
        </div>

        {/* STUDENT LOGIN FORM */}
        {activeTab === 'STUDENT' && (
          <form onSubmit={handleStudentLogin} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="studentIdentifier" className="label">
                  Student Email ID
                </label>
                <input
                  id="studentIdentifier"
                  type="text"
                  className="input"
                  placeholder="e.g. student@stellar.edu or roll number"
                  value={studentIdentifier}
                  onChange={(e) => setStudentIdentifier(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="studentPassword" className="label">
                  Password
                </label>
                <input
                  id="studentPassword"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={studentPassword}
                  onChange={(e) => setStudentPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex justify-center items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign in as Student'
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[--text-muted]">
              First time logging in?{' '}
              <Link to="/activate" className="text-[--primary] font-medium hover:underline">
                Activate your student account
              </Link>
            </div>
          </form>
        )}

        {/* FACULTY LOGIN FORM */}
        {activeTab === 'FACULTY' && (
          <form onSubmit={handleFacultyLogin} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label htmlFor="facultyEmpId" className="label">
                  Employee ID
                </label>
                <input
                  id="facultyEmpId"
                  type="text"
                  className="input"
                  placeholder="e.g. EMP-1001 or faculty email"
                  value={facultyEmpId}
                  onChange={(e) => setFacultyEmpId(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="facultyPassword" className="label">
                  Password
                </label>
                <input
                  id="facultyPassword"
                  type="password"
                  className="input"
                  placeholder="••••••••"
                  value={facultyPassword}
                  onChange={(e) => setFacultyPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex justify-center items-center gap-2"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign in as Faculty'
              )}
            </button>

            <div className="pt-2 text-center text-xs text-[--text-muted]">
              New faculty member?{' '}
              <Link to="/register" className="text-[--primary] font-medium hover:underline">
                Register staff account
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
