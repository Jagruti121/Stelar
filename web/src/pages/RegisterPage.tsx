import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { auth, db } from '@/lib/firebase';

export default function RegisterPage(): React.ReactElement {
  const navigate = useNavigate();
  const location = useLocation();
  const stateData = location.state as { email?: string; name?: string } | null;

  const [loading, setLoading] = useState(false);
  
  // Form State — auto-prefill if redirected from Google login check
  const [name, setName] = useState(stateData?.name || '');
  const [email, setEmail] = useState(stateData?.email || '');
  const [empId, setEmpId] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'HOD' | 'FACULTY'>('FACULTY');
  const [password, setPassword] = useState('');
  const [secretCode, setSecretCode] = useState('');

  useEffect(() => {
    if (stateData?.email) setEmail(stateData.email);
    if (stateData?.name) setName(stateData.name);
  }, [stateData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Client-side validation
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters long');
      return;
    }

    const expectedCode = role === 'HOD' ? 'hod123' : 'faculty123';
    if (secretCode.trim() !== expectedCode) {
      toast.error(`Invalid secret code for ${role}. Please use '${expectedCode}'.`);
      return;
    }

    setLoading(true);

    try {
      // Direct Firebase Authentication registration
      const userCred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(userCred.user, { displayName: name.trim() });

      const staffRoles = role === 'HOD' ? ['HOD', 'FACULTY'] : ['FACULTY'];

      // Save staff document in Firestore
      try {
        await setDoc(doc(db, 'staff', userCred.user.uid), {
          id: userCred.user.uid,
          name: name.trim(),
          email: email.trim(),
          employeeId: empId.trim(),
          deptId: department.trim().toLowerCase(),
          roles: staffRoles,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (dbErr) {
        console.warn('Note: Could not write staff doc to Firestore:', dbErr);
      }

      // Sync custom claims to Auth immediately
      try {
        const { httpsCallable } = await import('firebase/functions');
        const { functions } = await import('@/lib/firebase');
        const syncCall = httpsCallable(functions, 'syncUserClaims');
        await syncCall();
      } catch (claimErr) {
        console.warn('Could not immediately sync claims via function:', claimErr);
      }

      // Cache role information locally for instant offline/direct resolution
      localStorage.setItem('stellar_local_roles', JSON.stringify({
        roles: staffRoles,
        deptId: department.trim().toLowerCase(),
        name: name.trim()
      }));

      // Cache Employee ID -> Email mapping so login by Employee ID succeeds without needing Firestore query
      try {
        const empMap = JSON.parse(localStorage.getItem('stellar_emp_map') || '{}');
        empMap[empId.trim().toUpperCase()] = email.trim().toLowerCase();
        empMap[empId.trim().toLowerCase()] = email.trim().toLowerCase();
        localStorage.setItem('stellar_emp_map', JSON.stringify(empMap));
      } catch (err) {
        console.warn('Could not cache employee mapping:', err);
      }
      
      toast.success('Registration successful! You can now log in.');
      navigate('/login');
    } catch (error: any) {
      console.error('Registration error:', error);
      let msg = error.message || 'Failed to register account';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'An account with this email address already exists. Please log in.';
      } else if (error.code === 'auth/weak-password') {
        msg = 'Password is too weak. Please use at least 8 characters.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Please enter a valid email address.';
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Staff Registration"
      subtitle="Create your STELLAR staff account"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-3">
          
          <div>
            <label htmlFor="name" className="label">Full Name</label>
            <input
              id="name"
              className="input"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="label">Email Address</label>
            <input
              id="email"
              type="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="empId" className="label">Employee ID</label>
              <input
                id="empId"
                className="input"
                placeholder="e.g. EMP123"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="department" className="label">Department</label>
              <input
                id="department"
                className="input"
                placeholder="e.g. CSE"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="role" className="label">Role</label>
              <select
                id="role"
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value as 'HOD' | 'FACULTY')}
                required
                disabled={loading}
              >
                <option value="FACULTY">Faculty</option>
                <option value="HOD">HOD</option>
              </select>
            </div>
            <div>
              <label htmlFor="secretCode" className="label">Secret Code</label>
              <input
                id="secretCode"
                type="password"
                className="input"
                placeholder="Provided by Admin"
                value={secretCode}
                onChange={(e) => setSecretCode(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Min 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
          </div>

        </div>

        <button 
          type="submit" 
          className="btn-primary w-full flex items-center justify-center gap-2" 
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            'Register'
          )}
        </button>

        <p className="text-center text-sm text-[--text-muted]">
          Already have an account?{' '}
          <Link to="/login" className="text-[--primary] font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
