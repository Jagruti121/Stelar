import { useState, useEffect, useRef } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { 
  Upload, Loader2, Users, FileSpreadsheet, Download, 
  CheckCircle2, Search, Copy, Sparkles, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { db } from '@/lib/firebase';
import { 
  collection, doc, getDocs, writeBatch, serverTimestamp 
} from 'firebase/firestore';

interface StudentRosterItem {
  srNo: number;
  rollNo: string;
  name: string;
  department: string;
  year: string;
  sem: number;
  division: string;
  activationCode: string;
  isActive?: boolean;
  email?: string;
}

// Exact sample data matching the user's reference image image_9e8271.png
const SAMPLE_DATA_FROM_IMAGE: Omit<StudentRosterItem, 'activationCode'>[] = [
  { srNo: 1, rollNo: '202303026', name: 'Raju Jha', department: 'CS', year: 'First', sem: 1, division: 'A' },
  { srNo: 2, rollNo: '202303027', name: 'Priya Sharma', department: 'MECH', year: 'Second', sem: 2, division: 'A' },
  { srNo: 3, rollNo: '202303028', name: 'Amit Patel', department: 'CS', year: 'Second', sem: 3, division: 'A' },
  { srNo: 4, rollNo: '202303029', name: 'Sneha Desai', department: 'IT', year: 'Final', sem: 4, division: 'A' },
  { srNo: 5, rollNo: '202303030', name: 'Rahul Singh', department: 'E&TC', year: 'Final', sem: 5, division: 'A' },
  { srNo: 6, rollNo: '202303031', name: 'Neha Gupta', department: 'E&TC', year: 'Final', sem: 6, division: 'B' },
  { srNo: 7, rollNo: '202303032', name: 'Vikram Joshi', department: 'E&TC', year: 'Third', sem: 1, division: 'C' },
  { srNo: 8, rollNo: '202303033', name: 'Pooja Verma', department: 'CS', year: 'Second', sem: 2, division: 'A' },
  { srNo: 9, rollNo: '202303034', name: 'Karan Malhotra', department: 'E&TC', year: 'First', sem: 3, division: 'B' },
  { srNo: 10, rollNo: '202303035', name: 'Riya Kapoor', department: 'IT', year: 'First', sem: 4, division: 'C' },
  { srNo: 11, rollNo: '202303036', name: 'Arjun Nair', department: 'MECH', year: 'First', sem: 5, division: 'B' },
  { srNo: 12, rollNo: '202303037', name: 'Kavita Reddy', department: 'CS', year: 'First', sem: 6, division: 'A' },
  { srNo: 13, rollNo: '202303038', name: 'Sanjay Kumar', department: 'CS', year: 'Final', sem: 1, division: 'B' },
  { srNo: 14, rollNo: '202303039', name: 'Anjali Iyer', department: 'IT', year: 'Second', sem: 2, division: 'A' },
  { srNo: 15, rollNo: '202303040', name: 'Rohit Mehta', department: 'IT', year: 'Final', sem: 3, division: 'B' },
  { srNo: 16, rollNo: '202303041', name: 'Divya Menon', department: 'IT', year: 'Third', sem: 4, division: 'B' },
  { srNo: 17, rollNo: '202303042', name: 'Aditya Rao', department: 'E&TC', year: 'First', sem: 5, division: 'C' },
  { srNo: 18, rollNo: '202303043', name: 'Shruti Tiwari', department: 'E&TC', year: 'Third', sem: 6, division: 'C' },
  { srNo: 19, rollNo: '202303044', name: 'Manish Pandey', department: 'E&TC', year: 'Third', sem: 1, division: 'C' },
  { srNo: 20, rollNo: '202303045', name: 'Kiran Chawla', department: 'E&TC', year: 'First', sem: 2, division: 'A' },
  { srNo: 21, rollNo: '202303046', name: 'Kiran Chawla', department: 'E&TC', year: 'First', sem: 3, division: 'B' },
  { srNo: 22, rollNo: '202303047', name: 'Kiran Chawla', department: 'E&TC', year: 'First', sem: 4, division: 'B' },
  { srNo: 23, rollNo: '202303048', name: 'Kiran Chawla', department: 'E&TC', year: 'First', sem: 5, division: 'B' },
  { srNo: 24, rollNo: '202303049', name: 'Kiran Chawla', department: 'E&TC', year: 'First', sem: 6, division: 'B' },
  { srNo: 25, rollNo: '202303050', name: 'Kiran Chawla', department: 'E&TC', year: 'First', sem: 5, division: 'B' },
];

/**
 * Generates an 8-character uppercase alphanumeric activation code
 */
function generateActivationCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous 0/O, 1/I
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Simple SHA-256 in browser using Web Crypto API
 */
async function hashActivationCode(code: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default function StudentsPage(): React.ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [existingStudents, setExistingStudents] = useState<StudentRosterItem[]>([]);
  const [fetchingRoster, setFetchingRoster] = useState(true);
  const [lastUploadedRoster, setLastUploadedRoster] = useState<StudentRosterItem[] | null>(null);
  
  // Filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDivision, setFilterDivision] = useState('ALL');
  const [filterSemester, setFilterSemester] = useState('ALL');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    fetchExistingStudents();
  }, []);

  const fetchExistingStudents = async () => {
    setFetchingRoster(true);
    try {
      const snap = await getDocs(collection(db, 'students'));
      const list: StudentRosterItem[] = snap.docs.map((d, index) => {
        const data = d.data();
        return {
          srNo: Number(data.srNo) || (index + 1),
          rollNo: String(data.rollNo || d.id.split('_').pop() || ''),
          name: String(data.name || 'Student'),
          department: String(data.department || data.deptId || 'CS').toUpperCase(),
          year: String(data.year || 'First'),
          sem: Number(data.semester ?? data.sem ?? 1),
          division: String(data.division || 'A').toUpperCase(),
          activationCode: data.activationCode || '—',
          isActive: !!data.isActive,
          email: data.email || undefined,
        };
      });

      // Sort numerically by roll number or Sr No
      list.sort((a, b) => {
        const rA = parseInt(a.rollNo.replace(/\D/g, ''), 10) || a.srNo;
        const rB = parseInt(b.rollNo.replace(/\D/g, ''), 10) || b.srNo;
        return rA - rB;
      });

      setExistingStudents(list);
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setFetchingRoster(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  /**
   * Process Uploaded Excel Sheet
   */
  const processUpload = async (fileToProcess?: File) => {
    const targetFile = fileToProcess || file;
    if (!targetFile) {
      toast.error('Please select an Excel file to upload.');
      return;
    }

    setLoading(true);
    try {
      const data = await targetFile.arrayBuffer();
      const workbook = read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = utils.sheet_to_json(firstSheet);

      if (rows.length === 0) {
        throw new Error('The uploaded Excel sheet contains no student records.');
      }

      await parseAndSaveStudents(rows);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to process Excel file');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Core logic: parse rows, generate activation codes, save to Firestore, and download enriched Excel
   */
  const parseAndSaveStudents = async (rows: any[]) => {
    const processed: StudentRosterItem[] = [];
    const batch = writeBatch(db);

    for (let index = 0; index < rows.length; index++) {
      const row = rows[index];

      // Format from image: Sr No, Roll No, Name, Department, Year, Sem, Division
      const srNo = Number(row['Sr No'] ?? row['Sr. No.'] ?? row['SrNo'] ?? row['S.No'] ?? (index + 1));
      const rollNoRaw = row['Roll No'] ?? row['Roll'] ?? row['RollNo'] ?? row['Roll Number'] ?? `2023030${index + 1}`;
      const nameRaw = row['Name'] ?? row['Student Name'] ?? row['StudentName'] ?? `Student ${index + 1}`;
      const deptRaw = row['Department'] ?? row['Dept'] ?? row['Branch'] ?? 'CS';
      const yearRaw = row['Year'] ?? 'First';
      const semRaw = row['Sem'] ?? row['Semester'] ?? 1;
      const divRaw = row['Division'] ?? row['Div'] ?? row['Section'] ?? 'A';

      const rollNo = String(rollNoRaw).trim();
      const name = String(nameRaw).trim();
      const department = String(deptRaw).trim();
      const year = String(yearRaw).trim();
      const sem = Number(semRaw) || 1;
      const division = String(divRaw).trim().toUpperCase();

      // Generate unique 8-character activation code
      const activationCode = generateActivationCode();
      const hashedCode = await hashActivationCode(activationCode);

      // Student ID in database
      const studentId = `student_${rollNo}`;
      const studentRef = doc(db, 'students', studentId);

      batch.set(studentRef, {
        id: studentId,
        srNo,
        rollNo,
        name,
        department,
        deptId: department.toLowerCase(),
        year,
        semester: sem,
        sem,
        division,
        activationCode, // Stored for HOD export and registration
        activationCodeHash: hashedCode,
        isActive: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        cgpa: 0,
        totalCredits: 0,
        attendancePercentage: 0,
        points: 0,
      }, { merge: true });

      processed.push({
        srNo,
        rollNo,
        name,
        department,
        year,
        sem,
        division,
        activationCode,
        isActive: false,
      });
    }

    // Commit batch write to Firestore
    await batch.commit();

    // Cache locally as last uploaded roster
    setLastUploadedRoster(processed);

    // Generate and download the new Excel sheet matching the exact format + Column H
    downloadExcelWithActivationCodes(processed);

    toast.success(`Successfully registered ${processed.length} students! Excel sheet with Activation Codes downloaded.`);
    await fetchExistingStudents();
  };

  /**
   * Generates and downloads the enriched Excel file with column 'H' = Activation Code
   */
  const downloadExcelWithActivationCodes = (items: StudentRosterItem[]) => {
    // Exact column headers matching image_9e8271.png + Column H: Activation Code
    const excelRows = items.map((s) => ({
      'Sr No': s.srNo,
      'Roll No': s.rollNo,
      'Name': s.name,
      'Department': s.department,
      'Year': s.year,
      'Sem': s.sem,
      'Division': s.division,
      'Activation Code': s.activationCode, // Column H
    }));

    const worksheet = utils.json_to_sheet(excelRows, {
      header: ['Sr No', 'Roll No', 'Name', 'Department', 'Year', 'Sem', 'Division', 'Activation Code']
    });

    // Configure column widths
    worksheet['!cols'] = [
      { wch: 8 },  // Sr No
      { wch: 16 }, // Roll No
      { wch: 22 }, // Name
      { wch: 14 }, // Department
      { wch: 12 }, // Year
      { wch: 8 },  // Sem
      { wch: 10 }, // Division
      { wch: 18 }, // Activation Code (Column H)
    ];

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Students');

    // Trigger download
    const filename = `STELLAR_Student_Roster_With_Activation_Codes_${new Date().toISOString().split('T')[0]}.xlsx`;
    writeFile(workbook, filename);
  };

  /**
   * Download sample blank/reference template matching image_9e8271.png
   */
  const downloadSampleTemplate = () => {
    const sampleRows = SAMPLE_DATA_FROM_IMAGE.map(s => ({
      'Sr No': s.srNo,
      'Roll No': s.rollNo,
      'Name': s.name,
      'Department': s.department,
      'Year': s.year,
      'Sem': s.sem,
      'Division': s.division,
    }));

    const worksheet = utils.json_to_sheet(sampleRows, {
      header: ['Sr No', 'Roll No', 'Name', 'Department', 'Year', 'Sem', 'Division']
    });

    worksheet['!cols'] = [
      { wch: 8 },
      { wch: 16 },
      { wch: 22 },
      { wch: 14 },
      { wch: 12 },
      { wch: 8 },
      { wch: 10 },
    ];

    const workbook = utils.book_new();
    utils.book_append_sheet(workbook, worksheet, 'Student_Upload_Template');
    writeFile(workbook, 'STELLAR_Student_Upload_Template.xlsx');
    toast.success('Sample Excel Template downloaded.');
  };

  /**
   * One-click demo batch generation using the sample data from the user's reference image
   */
  const handleQuickDemoLoad = async () => {
    setLoading(true);
    try {
      await parseAndSaveStudents(SAMPLE_DATA_FROM_IMAGE);
    } catch (err: any) {
      console.error(err);
      toast.error('Failed to load sample dataset.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`Copied activation code: ${text}`);
  };

  // Filter students for display
  const displayedStudents = (lastUploadedRoster || existingStudents).filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.department.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesDiv = filterDivision === 'ALL' || s.division === filterDivision;
    const matchesSem = filterSemester === 'ALL' || s.sem === Number(filterSemester);

    return matchesSearch && matchesDiv && matchesSem;
  });

  return (
    <div className="space-y-8 animate-fade-in max-w-7xl mx-auto pb-16">
      {/* Page Title & Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="page-title flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Student Management & Bulk Registration
          </h1>
          <p className="text-sm text-[--text-muted] mt-1">
            Upload student Excel rosters to automatically register students and generate unique activation codes.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={downloadSampleTemplate}
            className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-2"
          >
            <Download className="h-4 w-4 text-gray-500" />
            Download Excel Template
          </button>

          <button
            type="button"
            onClick={handleQuickDemoLoad}
            disabled={loading}
            className="btn-secondary py-2 px-3.5 text-xs flex items-center gap-2 text-blue-700 bg-blue-50/70 hover:bg-blue-100/70 border-blue-200"
          >
            <Sparkles className="h-4 w-4 text-blue-600" />
            Load Sample Sheet (Image Roster)
          </button>
        </div>
      </div>

      {/* Upload & Expected Format Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <div className="card lg:col-span-1 shadow-sm border border-gray-200 flex flex-col justify-between">
          <div>
            <h2 className="section-title mb-2 flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-600" />
              Upload Student Roster
            </h2>
            <p className="text-xs text-[--text-muted] mb-5">
              Select or drop your class spreadsheet (.xlsx, .xls) matching the required institutional format.
            </p>

            <input 
              type="file" 
              ref={fileInputRef}
              accept=".xlsx, .xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-xl p-6 text-center cursor-pointer transition-colors bg-gray-50/60 hover:bg-blue-50/40"
            >
              <FileSpreadsheet className="h-10 w-10 text-emerald-600 mx-auto mb-2" />
              {file ? (
                <div>
                  <p className="text-xs font-semibold text-gray-900 truncate max-w-xs mx-auto">{file.name}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{(file.size / 1024).toFixed(1)} KB — Click to change</p>
                </div>
              ) : (
                <div>
                  <p className="text-xs font-medium text-gray-700">Click to choose Excel sheet (.xlsx)</p>
                  <p className="text-[10px] text-gray-400 mt-1">Columns: Sr No, Roll No, Name, Department, Year, Sem, Division</p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-100 space-y-3">
            <button
              type="button"
              onClick={() => processUpload()}
              disabled={!file || loading}
              className="btn-primary w-full py-2.5 font-semibold text-xs flex justify-center items-center gap-2 shadow-sm"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Data & Generating Codes...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Process & Download Enriched Excel
                </>
              )}
            </button>

            <p className="text-[10px] text-center text-gray-400">
              A new Excel sheet with Column H (Activation Code) will download automatically.
            </p>
          </div>
        </div>

        {/* Reference Format Guide */}
        <div className="card lg:col-span-2 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title text-sm flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Required Excel Format Specification
            </h2>
            <span className="text-[10px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded border border-emerald-200">
              Matches image_9e8271.png
            </span>
          </div>

          <p className="text-xs text-[--text-muted] mb-3">
            Your uploaded Excel sheet should contain rows matching this exact layout. Column H will be appended automatically with the generated activation codes upon processing:
          </p>

          {/* Visual Table Specification */}
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-[#2b6cb0] text-white font-semibold">
                <tr>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col A: Sr No</th>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col B: Roll No</th>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col C: Name</th>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col D: Department</th>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col E: Year</th>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col F: Sem</th>
                  <th className="py-2 px-2.5 border-r border-blue-400">Col G: Division</th>
                  <th className="py-2 px-2.5 bg-emerald-700 text-white font-bold">Col H: Activation Code (Generated)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white font-mono text-[11px]">
                <tr className="hover:bg-gray-50/80">
                  <td className="py-1.5 px-2.5 text-gray-500">1</td>
                  <td className="py-1.5 px-2.5 font-bold text-gray-800">202303026</td>
                  <td className="py-1.5 px-2.5 font-sans font-medium text-gray-900">Raju Jha</td>
                  <td className="py-1.5 px-2.5 text-blue-700 font-bold">CS</td>
                  <td className="py-1.5 px-2.5 font-sans text-gray-600">First</td>
                  <td className="py-1.5 px-2.5 font-bold text-center">1</td>
                  <td className="py-1.5 px-2.5 font-bold text-purple-700 text-center">A</td>
                  <td className="py-1.5 px-2.5 bg-emerald-50 text-emerald-800 font-bold">STEL-8A2F ★</td>
                </tr>
                <tr className="hover:bg-gray-50/80">
                  <td className="py-1.5 px-2.5 text-gray-500">2</td>
                  <td className="py-1.5 px-2.5 font-bold text-gray-800">202303027</td>
                  <td className="py-1.5 px-2.5 font-sans font-medium text-gray-900">Priya Sharma</td>
                  <td className="py-1.5 px-2.5 text-blue-700 font-bold">MECH</td>
                  <td className="py-1.5 px-2.5 font-sans text-gray-600">Second</td>
                  <td className="py-1.5 px-2.5 font-bold text-center">2</td>
                  <td className="py-1.5 px-2.5 font-bold text-purple-700 text-center">A</td>
                  <td className="py-1.5 px-2.5 bg-emerald-50 text-emerald-800 font-bold">STEL-3K9B ★</td>
                </tr>
                <tr className="hover:bg-gray-50/80">
                  <td className="py-1.5 px-2.5 text-gray-500">3</td>
                  <td className="py-1.5 px-2.5 font-bold text-gray-800">202303028</td>
                  <td className="py-1.5 px-2.5 font-sans font-medium text-gray-900">Amit Patel</td>
                  <td className="py-1.5 px-2.5 text-blue-700 font-bold">CS</td>
                  <td className="py-1.5 px-2.5 font-sans text-gray-600">Second</td>
                  <td className="py-1.5 px-2.5 font-bold text-center">3</td>
                  <td className="py-1.5 px-2.5 font-bold text-purple-700 text-center">A</td>
                  <td className="py-1.5 px-2.5 bg-emerald-50 text-emerald-800 font-bold">STEL-7M4C ★</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center gap-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-800">
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-blue-600" />
            <span>
              <strong>Registration Protocol:</strong> Distribute the downloaded Excel sheet (with Column H) to students. Students navigate to <strong>/activate</strong>, enter their Roll Number and Activation Code, set their password, and their account is ready!
            </span>
          </div>
        </div>
      </div>

      {/* Processed Student Roster Table */}
      <div className="card shadow-sm border border-gray-200 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="section-title flex items-center gap-2">
              <Users className="h-5 w-5 text-gray-700" />
              Registered Student Roster ({displayedStudents.length} Students)
            </h2>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Synced with the database and ready for session attendance.
            </p>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, roll, dept..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input py-1.5 pl-8 pr-3 text-xs w-48"
              />
            </div>

            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="input py-1.5 px-2 text-xs w-auto cursor-pointer font-medium"
            >
              <option value="ALL">All Semesters</option>
              {[1, 2, 3, 4, 5, 6].map(sem => (
                <option key={sem} value={sem}>Sem {sem}</option>
              ))}
            </select>

            <select
              value={filterDivision}
              onChange={(e) => setFilterDivision(e.target.value)}
              className="input py-1.5 px-2 text-xs w-auto cursor-pointer font-medium"
            >
              <option value="ALL">All Divisions</option>
              {['A', 'B', 'C', 'D'].map(div => (
                <option key={div} value={div}>Division {div}</option>
              ))}
            </select>

            {existingStudents.length > 0 && (
              <button
                type="button"
                onClick={() => downloadExcelWithActivationCodes(existingStudents)}
                className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              >
                <Download className="h-3.5 w-3.5" />
                Export Roster (.xlsx)
              </button>
            )}
          </div>
        </div>

        {/* Student Table */}
        {fetchingRoster ? (
          <div className="flex flex-col items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
            <p className="text-xs text-gray-500">Loading student roster...</p>
          </div>
        ) : displayedStudents.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
            <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
            <p className="text-xs font-semibold text-gray-600">No students match current filter</p>
            <p className="text-[11px] text-gray-400 mt-1">Upload an Excel sheet or load the sample batch above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 rounded-xl">
            <table className="min-w-full text-xs text-left">
              <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Sr No</th>
                  <th className="py-2.5 px-3">Roll No</th>
                  <th className="py-2.5 px-3">Student Name</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Year</th>
                  <th className="py-2.5 px-3 text-center">Sem</th>
                  <th className="py-2.5 px-3 text-center">Division</th>
                  <th className="py-2.5 px-3 bg-emerald-50 text-emerald-900 font-bold">Activation Code (Col H)</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {displayedStudents.map((s, idx) => (
                  <tr key={`${s.rollNo}-${idx}`} className="hover:bg-blue-50/30 transition-colors">
                    <td className="py-2 px-3 text-gray-500 font-mono">{s.srNo}</td>
                    <td className="py-2 px-3 font-mono font-bold text-gray-900">#{s.rollNo}</td>
                    <td className="py-2 px-3 font-semibold text-gray-800">{s.name}</td>
                    <td className="py-2 px-3 font-semibold text-blue-700">{s.department}</td>
                    <td className="py-2 px-3 text-gray-600">{s.year}</td>
                    <td className="py-2 px-3 text-center font-bold">{s.sem}</td>
                    <td className="py-2 px-3 text-center font-bold text-purple-700">{s.division}</td>
                    <td className="py-2 px-3 bg-emerald-50/70 font-mono font-bold text-emerald-800">
                      <div className="flex items-center gap-1.5">
                        <span>{s.activationCode}</span>
                        {s.activationCode !== '—' && (
                          <button
                            type="button"
                            onClick={() => copyToClipboard(s.activationCode)}
                            className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition-colors"
                            title="Copy Code"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center">
                      {s.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          Pending Activation
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
