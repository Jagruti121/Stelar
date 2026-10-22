import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { db } from '@/lib/firebase';
import { collection, query, where, getCountFromServer, getDoc } from 'firebase/firestore';
import { 
  Users, Award, Calendar, BookOpen, 
  Activity, Bell, FileSpreadsheet, 
  Hash, Search, ChevronRight 
} from 'lucide-react';
import { studentDoc } from '@/lib/firestore';

export default function DashboardPage(): React.ReactElement {
  const { claims, user } = useAuth();
  const isStudent = claims?.roles.includes('STUDENT');
  const isFaculty = claims?.roles.includes('FACULTY') || claims?.roles.includes('HOD');
  const isHOD = claims?.roles.includes('HOD');

  if (isStudent) return <StudentDashboard studentId={claims?.studentId as string} />;
  if (isFaculty) return <FacultyDashboard deptId={claims?.deptId || 'cse'} isHOD={isHOD || false} name={user?.displayName || 'Faculty'} />;

  return <div>Loading dashboard...</div>;
}

function StudentDashboard({ studentId }: { studentId: string }) {
  const [profileComp, setProfileComp] = useState(0);
  const [cgpa, setCgpa] = useState<number>(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const sSnap = await getDoc(studentDoc(studentId));
        if (sSnap.exists()) {
          setCgpa(sSnap.data().cgpa || 0);
          setProfileComp(sSnap.data().profileCompleteness || 0);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchStats();
  }, [studentId]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="page-title">Welcome back! 👋</h1>
        <p className="text-sm text-[--text-muted] mt-1">Here is a summary of your academic profile.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-500 to-indigo-600 text-white border-0">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-white/90">CGPA</h3>
            <div className="p-2 bg-white/20 rounded-lg"><Award className="h-4 w-4" /></div>
          </div>
          <p className="text-3xl font-bold mt-4">{cgpa.toFixed(2)}</p>
          <p className="text-xs text-blue-100 mt-2">Latest Semester</p>
        </div>

        <div className="card border-green-200 bg-green-50/50">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-gray-700">Profile Strength</h3>
            <div className="p-2 bg-green-100 text-green-700 rounded-lg"><Activity className="h-4 w-4" /></div>
          </div>
          <p className="text-3xl font-bold text-green-700 mt-4">{profileComp}%</p>
          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-3">
            <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${profileComp}%` }}></div>
          </div>
        </div>

        <div className="card hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-700">Attendance</h3>
            <div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><Calendar className="h-4 w-4" /></div>
          </div>
          <Link to="/app/attendance" className="text-sm text-[--primary] font-medium flex items-center group-hover:translate-x-1 transition-transform">
            View Summary <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>

        <div className="card hover:shadow-md transition-shadow group">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-700">Communities</h3>
            <div className="p-2 bg-orange-100 text-orange-700 rounded-lg"><Hash className="h-4 w-4" /></div>
          </div>
          <Link to="/app/communities" className="text-sm text-[--primary] font-medium flex items-center group-hover:translate-x-1 transition-transform">
            Join discussions <ChevronRight className="h-4 w-4 ml-1" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-8">
        <div className="card">
          <h2 className="section-title mb-4">Quick Links</h2>
          <div className="space-y-3">
            <Link to="/app/profile" className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-slate-50 transition-colors">
              <div className="bg-blue-100 text-blue-700 p-2 rounded-md"><BookOpen className="h-4 w-4" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[--text]">Update Profile & Skills</p>
                <p className="text-xs text-[--text-muted]">Keep your bio and expertise updated</p>
              </div>
            </Link>
            <Link to="/app/results" className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-slate-50 transition-colors">
              <div className="bg-green-100 text-green-700 p-2 rounded-md"><Award className="h-4 w-4" /></div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[--text]">View Results</p>
                <p className="text-xs text-[--text-muted]">Check your semester marks</p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function FacultyDashboard({ deptId, isHOD, name }: { deptId: string, isHOD: boolean, name: string }) {
  const [totalStudents, setTotalStudents] = useState<number | null>(null);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const q = query(collection(db, 'students'), where('deptId', '==', deptId.toLowerCase()));
        const snap = await getCountFromServer(q);
        setTotalStudents(snap.data().count);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCount();
  }, [deptId]);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div>
        <h1 className="page-title">Welcome, {name}</h1>
        <p className="text-sm text-[--text-muted] mt-1">Department of {deptId.toUpperCase()} Overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-indigo-500 to-blue-600 text-white border-0">
          <div className="flex justify-between items-start">
            <h3 className="font-semibold text-white/90">Total Students</h3>
            <div className="p-2 bg-white/20 rounded-lg"><Users className="h-4 w-4" /></div>
          </div>
          <p className="text-3xl font-bold mt-4">{totalStudents !== null ? totalStudents : '-'}</p>
        </div>

        <div className="card border-blue-200 bg-blue-50/50 hover:shadow-md transition-shadow group cursor-pointer">
          <Link to="/app/talent">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-gray-700">Talent Search</h3>
              <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Search className="h-4 w-4" /></div>
            </div>
            <p className="text-xs text-[--text-muted] mb-2">Find students by skills & CGPA</p>
            <div className="text-sm text-[--primary] font-medium flex items-center group-hover:translate-x-1 transition-transform">
              Launch Search <ChevronRight className="h-4 w-4 ml-1" />
            </div>
          </Link>
        </div>

        {isHOD && (
          <div className="card border-green-200 bg-green-50/50 hover:shadow-md transition-shadow group cursor-pointer">
            <Link to="/app/results-upload">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold text-gray-700">Results</h3>
                <div className="p-2 bg-green-100 text-green-700 rounded-lg"><FileSpreadsheet className="h-4 w-4" /></div>
              </div>
              <p className="text-xs text-[--text-muted] mb-2">Upload semester results</p>
              <div className="text-sm text-[--primary] font-medium flex items-center group-hover:translate-x-1 transition-transform">
                Bulk Upload <ChevronRight className="h-4 w-4 ml-1" />
              </div>
            </Link>
          </div>
        )}

        <div className="card border-purple-200 bg-purple-50/50 hover:shadow-md transition-shadow group cursor-pointer">
          <Link to="/app/notifications">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-semibold text-gray-700">Broadcasts</h3>
              <div className="p-2 bg-purple-100 text-purple-700 rounded-lg"><Bell className="h-4 w-4" /></div>
            </div>
            <p className="text-xs text-[--text-muted] mb-2">Send targeted notifications</p>
            <div className="text-sm text-[--primary] font-medium flex items-center group-hover:translate-x-1 transition-transform">
              Send Alert <ChevronRight className="h-4 w-4 ml-1" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
