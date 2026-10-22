import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Loader2, KeyRound, CheckCircle2, UserCheck, ShieldCheck } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { 
  collection, query, where, getDocs, doc, updateDoc, serverTimestamp, setDoc 
} from 'firebase/firestore';
import { AuthLayout } from '@/components/layout/AuthLayout';

interface VerifiedStudent {
  id: string;
  rollNo: string;
  name: string;
  department: string;
  year: string;
  semester: number;
  division: string;
  activationCode: string;
  activationCodeHash?: string;
  isActive?: boolean;
}

export default function ActivatePage(): React.ReactElement {
  const navigate = useNavigate();
  
  // Step 1: Verification fields
  const [rollNo, setRollNo] = useState('');
  const [activationCode, setActivationCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedStudent, setVerifiedStudent] = useState<VerifiedStudent | null>(null);

  // Step 2: Credentials setup
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  /**
   * Verify Roll Number & Activation Code from the uploaded Excel roster
   */
  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!rollNo.trim() || !activationCode.trim()) {
      toast.error('Please enter both your Roll Number and Activation Code.');
      return;
    }

    setVerifying(true);
    setVerifiedStudent(null);

    try {
      const cleanRoll = rollNo.trim();
      const enteredCode = activationCode.trim().toUpperCase().replace(/[\s-]/g, '');

      // 1. Query by rollNo
      const q = query(collection(db, 'students'), where('rollNo', '==', cleanRoll));
      let snap = await getDocs(q);

      // Fallback query by document id if not found
      let matchedDoc = snap.docs.length > 0 ? snap.docs[0] : null;
      if (!matchedDoc) {
        const allSnap = await getDocs(collection(db, 'students'));
        matchedDoc = allSnap.docs.find(d => {
          const dData = d.data();
          const dRoll = String(dData.rollNo || d.id).trim();
          return dRoll.toLowerCase() === cleanRoll.toLowerCase();
        }) || null;
      }

      if (!matchedDoc) {
        toast.error(`No student record found for Roll Number "${cleanRoll}". Please check with your HOD.`);
        return;
      }

      const data = matchedDoc.data();

      // Check if already activated
      if (data.isActive) {
        toast.info('Your account is already activated! Please log in directly with your email and password.');
        navigate('/login');
        return;
      }

      // Check Activation Code
      const storedCode = String(data.activationCode || '').toUpperCase().replace(/[\s-]/g, '');
      
      // Calculate hash for verification fallback
      let hashMatches = false;
      if (data.activationCodeHash) {
        const msgUint8 = new TextEncoder().encode(enteredCode);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const computedHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
        hashMatches = (computedHash === data.activationCodeHash);
      }

      const codeMatches = (storedCode && storedCode === enteredCode) || hashMatches;

      if (!codeMatches) {
        toast.error('Invalid activation code. Please check the code in Column H of your class Excel sheet.');
        return;
      }

      // Successfully verified!
      const verified: VerifiedStudent = {
        id: matchedDoc.id,
        rollNo: data.rollNo || cleanRoll,
        name: data.name || 'Student',
        department: data.department || data.deptId || 'CS',
        year: data.year || 'First',
        semester: Number(data.semester ?? data.sem ?? 1),
        division: data.division || 'A',
        activationCode: data.activationCode,
        isActive: !!data.isActive,
      };

      setVerifiedStudent(verified);
      toast.success(`Identity Verified: Welcome, ${verified.name}!`);
    } catch (err: any) {
      console.error('Verification error:', err);
      toast.error(err.message || 'Error verifying activation code.');
    } finally {
      setVerifying(false);
    }
  };

  /**
   * Finalize Registration: Create Auth User and link to student document
   */
  const handleCompleteRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedStudent) return;

    if (password !== confirmPassword) {
      toast.error('Passwords do not match. Please re-enter.');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }

    setSubmitting(true);
    try {
      const cleanEmail = email.trim().toLowerCase();

      // 1. Create Firebase Auth user with email & password
      const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
      await updateProfile(userCred.user, { displayName: verifiedStudent.name });

      // 2. Mark student doc as active in Firestore
      const studentDocRef = doc(db, 'students', verifiedStudent.id);
      await updateDoc(studentDocRef, {
        authUid: userCred.user.uid,
        email: cleanEmail,
        isActive: true,
        updatedAt: serverTimestamp(),
      });

      // 3. Initialize attendance summary document if not present
      try {
        await setDoc(doc(db, 'attendanceSummary', verifiedStudent.id), {
          id: verifiedStudent.id,
          studentName: verifiedStudent.name,
          rollNo: verifiedStudent.rollNo,
          deptId: verifiedStudent.department.toLowerCase(),
          division: verifiedStudent.division,
          bySubject: {},
          updatedAt: serverTimestamp(),
        }, { merge: true });
      } catch (sumErr) {
        console.warn('Could not initialize summary doc:', sumErr);
      }

      // 4. Cache local student mapping for instant roll-number sign in
      try {
        const studentMap = JSON.parse(localStorage.getItem('stellar_student_map') || '{}');
        studentMap[verifiedStudent.rollNo.trim()] = cleanEmail;
        localStorage.setItem('stellar_student_map', JSON.stringify(studentMap));

        localStorage.setItem('stellar_local_roles', JSON.stringify({
          roles: ['STUDENT'],
          studentId: verifiedStudent.id,
          deptId: verifiedStudent.department.toLowerCase(),
          division: verifiedStudent.division,
          name: verifiedStudent.name
        }));
      } catch {
        // ignore
      }

      toast.success(`Account activated successfully! You can now log in using your Roll Number (#${verifiedStudent.rollNo}) or Email.`);
      navigate('/login');
    } catch (error: any) {
      console.error('Registration completion error:', error);
      let msg = error.message || 'Failed to complete registration';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already in use by another account. Please use a different email.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please choose a stronger password.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="First-Time Student Registration"
      subtitle="Activate your student account using the code from your class roster"
    >
      <div className="space-y-5">
        {/* Step 1: Verification Form */}
        <div className="space-y-4">
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3.5">
            <p className="text-xs text-blue-900 font-semibold flex items-center gap-1.5">
              <KeyRound className="h-4 w-4 text-blue-600 flex-shrink-0" />
              Column 'H' Activation Code
            </p>
            <p className="text-[11px] text-blue-700 mt-1 leading-relaxed">
              Find your unique 8-character code in Column 'H' of the Excel sheet distributed by your HOD or teacher.
            </p>
          </div>

          <form onSubmit={handleVerifyCode} className="space-y-3">
            <div>
              <label htmlFor="rollNo" className="label text-xs">
                Roll Number <span className="text-red-500">*</span>
              </label>
              <input
                id="rollNo"
                className="input text-xs font-mono font-semibold"
                placeholder="e.g. 202303026"
                value={rollNo}
                onChange={(e) => {
                  setRollNo(e.target.value);
                  setVerifiedStudent(null);
                }}
                required
                disabled={verifying || !!verifiedStudent}
              />
            </div>

            <div>
              <label htmlFor="activationCode" className="label text-xs">
                Activation Code <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  id="activationCode"
                  className="input uppercase text-xs font-mono font-semibold tracking-wider flex-1"
                  placeholder="8-character code (e.g. STEL8A2F)"
                  value={activationCode}
                  onChange={(e) => {
                    setActivationCode(e.target.value.toUpperCase());
                    setVerifiedStudent(null);
                  }}
                  required
                  disabled={verifying || !!verifiedStudent}
                />
                
                {!verifiedStudent && (
                  <button
                    type="submit"
                    disabled={verifying || !rollNo.trim() || !activationCode.trim()}
                    className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5"
                  >
                    {verifying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5" />
                    )}
                    Verify
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>

        {/* Verified Student Badge */}
        {verifiedStudent && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2 animate-fade-in">
            <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
              <span>Identity Verified</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-700 font-medium">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Name</span>
                <span className="font-bold text-gray-900">{verifiedStudent.name}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Roll No</span>
                <span className="font-mono font-bold text-gray-900">#{verifiedStudent.rollNo}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Department</span>
                <span className="text-blue-700 font-bold">{verifiedStudent.department}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase">Class</span>
                <span>Sem {verifiedStudent.semester}, Div {verifiedStudent.division}</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Set Email and Password */}
        {verifiedStudent && (
          <form onSubmit={handleCompleteRegistration} className="space-y-3 pt-2 border-t border-gray-100 animate-fade-in">
            <div>
              <label htmlFor="studentEmail" className="label text-xs">
                Your Email Address <span className="text-red-500">*</span>
              </label>
              <input
                id="studentEmail"
                type="email"
                className="input text-xs"
                placeholder="name@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={submitting}
              />
              <p className="text-[10px] text-gray-400 mt-1">Used for password recovery and notifications.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="studentPassword" className="label text-xs">
                  Create Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="studentPassword"
                  type="password"
                  className="input text-xs"
                  placeholder="Min 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="label text-xs">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  className="input text-xs"
                  placeholder="Re-type password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  disabled={submitting}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !email.trim() || !password}
              className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2 mt-4 shadow-sm"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating Your Account...
                </>
              ) : (
                <>
                  <UserCheck className="h-4 w-4" />
                  Complete Registration & Activate
                </>
              )}
            </button>
          </form>
        )}

        {/* Already Registered Link */}
        <div className="text-center pt-2">
          <p className="text-xs text-[--text-muted]">
            Already activated?{' '}
            <Link to="/login" className="text-blue-600 font-semibold hover:underline">
              Sign in with Email or Roll Number
            </Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
