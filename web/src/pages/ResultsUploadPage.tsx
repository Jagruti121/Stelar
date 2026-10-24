import { useState } from 'react';
import { read, utils, writeFile } from 'xlsx';
import { httpsCallable } from 'firebase/functions';
import { Upload, Loader2, FileSpreadsheet, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';

const bulkUploadResults = httpsCallable(functions, 'bulkUploadResults');

function getField(row: any, ...aliases: string[]) {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const cleanAlias = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const key of rowKeys) {
      const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanKey === cleanAlias && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
        return row[key];
      }
    }
  }
  return undefined;
}

export default function ResultsUploadPage(): React.ReactElement {
  const { claims } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [semester, setSemester] = useState<number>(1);
  const [parsedSummary, setParsedSummary] = useState<{ studentCount: number; rowCount: number } | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setParsedSummary(null);
    }
  };

  const handleDownloadTemplate = () => {
    const deptId = claims?.deptId || 'cs';
    const sampleData = [
      {
        StudentID: `${deptId}_sem1_divA_1`,
        SGPA: 8.75,
        SubCode: 'CS101',
        Marks: 88,
        MaxMarks: 100,
        Grade: 'A+'
      },
      {
        StudentID: `${deptId}_sem1_divA_1`,
        SGPA: 8.75,
        SubCode: 'CS102',
        Marks: 82,
        MaxMarks: 100,
        Grade: 'A'
      },
      {
        StudentID: `${deptId}_sem1_divA_2`,
        SGPA: 7.90,
        SubCode: 'CS101',
        Marks: 76,
        MaxMarks: 100,
        Grade: 'B+'
      },
      {
        StudentID: `${deptId}_sem1_divA_2`,
        SGPA: 7.90,
        SubCode: 'CS102',
        Marks: 79,
        MaxMarks: 100,
        Grade: 'B+'
      }
    ];

    const ws = utils.json_to_sheet(sampleData);
    const wb = utils.book_new();
    utils.book_append_sheet(wb, ws, 'Results');
    writeFile(wb, `Stellar_Results_Sem${semester}_Template.xlsx`);
    toast.success('Sample Excel template downloaded!');
  };

  const processUpload = async () => {
    if (!file || !semester) return;

    setLoading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = utils.sheet_to_json(firstSheet);

      if (rows.length === 0) {
        throw new Error('The uploaded file is empty or contains no data rows.');
      }

      const studentResultsMap = new Map<string, any>();

      rows.forEach((row, index) => {
        const rawSid = getField(row, 'StudentID', 'Student_ID', 'Student ID', 'RollNo', 'Roll_No', 'Roll No', 'Roll', 'ID');
        const rawSgpa = getField(row, 'SGPA', 'GPA', 'SPI', 'Sem_SGPA');
        const rawSubCode = getField(row, 'SubCode', 'SubjectCode', 'Sub_Code', 'Subject_Code', 'Subject Code', 'Course', 'Subject');
        const rawMarks = getField(row, 'Marks', 'Mark', 'Score', 'ObtainedMarks', 'Obtained_Marks', 'Marks_Obtained');
        const rawMaxMarks = getField(row, 'MaxMarks', 'Max_Marks', 'Max Marks', 'TotalMarks', 'Total_Marks', 'Max', 'Total');
        const rawGrade = getField(row, 'Grade', 'Letter_Grade', 'Letter Grade', 'Gr');

        if (rawSid === undefined) {
          throw new Error(`Row ${index + 2}: Missing student identifier column (expected StudentID or RollNo).`);
        }
        if (rawSubCode === undefined) {
          throw new Error(`Row ${index + 2}: Missing subject code column (expected SubCode or Subject).`);
        }

        // Parse student ID: preserve clean identifier so bulkUploadResults can mirror both roll numbers and composite IDs
        let sid = String(rawSid).trim();

        const marks = rawMarks !== undefined ? Number(rawMarks) : 0;
        const maxMarks = rawMaxMarks !== undefined ? Number(rawMaxMarks) : 100;
        const sgpa = rawSgpa !== undefined ? Number(rawSgpa) : 0.0;

        let grade = rawGrade ? String(rawGrade).trim().toUpperCase() : '';
        if (!grade && maxMarks > 0) {
          const pct = (marks / maxMarks) * 100;
          if (pct >= 85) grade = 'A+';
          else if (pct >= 75) grade = 'A';
          else if (pct >= 65) grade = 'B+';
          else if (pct >= 55) grade = 'B';
          else if (pct >= 45) grade = 'C';
          else if (pct >= 35) grade = 'D';
          else grade = 'F';
        }

        if (!studentResultsMap.has(sid)) {
          studentResultsMap.set(sid, {
            studentId: sid,
            sgpa: Number(sgpa.toFixed(2)),
            subjectMarks: []
          });
        }

        studentResultsMap.get(sid).subjectMarks.push({
          subjectId: String(rawSubCode).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          subjectCode: String(rawSubCode).trim().toUpperCase(),
          marks: Number(marks),
          maxMarks: Number(maxMarks),
          grade: grade || 'P'
        });
      });

      const results = Array.from(studentResultsMap.values());
      setParsedSummary({ studentCount: results.length, rowCount: rows.length });

      // Call Cloud Function
      const res = await bulkUploadResults({ semester: Number(semester), results });
      const { count } = res.data as any;

      toast.success(`Successfully uploaded semester ${semester} results for ${count} students!`);
      setFile(null);
    } catch (error: any) {
      console.error(error);
      const msg = error.details || error.message || 'Failed to process Results Excel file';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="page-title">Upload Results</h1>
          <p className="text-sm text-[--text-muted] mt-1">
            Upload end-semester marks and SGPA (HOD Only).
          </p>
        </div>

        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="btn-secondary py-2 px-3 text-xs flex items-center gap-2 self-start sm:self-auto font-medium shadow-sm hover:border-blue-400"
        >
          <Download className="h-4 w-4 text-blue-600" />
          Download Sample Template (.xlsx)
        </button>
      </div>

      <div className="card max-w-2xl">
        <h2 className="section-title mb-4 flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-[--primary]" />
          Bulk Results Upload
        </h2>
        
        <p className="text-sm text-[--text-muted] mb-4">
          Upload an Excel file (.xlsx or .csv) containing subject marks and SGPA.
          Headers are flexible (e.g. <strong>StudentID</strong> or <strong>RollNo</strong>, <strong>SGPA</strong>, <strong>SubCode</strong>, <strong>Marks</strong>, <strong>MaxMarks</strong>, <strong>Grade</strong>).
        </p>

        <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-lg text-xs text-gray-600 mb-6 space-y-1">
          <p className="font-semibold text-blue-900">Format Guide:</p>
          <p>• One row per subject per student. The system will automatically group subjects by StudentID.</p>
          <p>• If StudentID is just a roll number (e.g. 1, 2), it will automatically map to your department's roster.</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label">Semester</label>
            <select 
              className="input w-36 font-medium cursor-pointer" 
              value={semester} 
              onChange={(e) => setSemester(Number(e.target.value))}
              disabled={loading}
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Semester {s}</option>)}
            </select>
          </div>

          <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 hover:border-blue-400 transition-colors">
            <input 
              type="file" 
              accept=".xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-xl file:border-0
                file:text-sm file:font-semibold
                file:bg-[--primary-soft] file:text-[--primary]
                hover:file:bg-blue-100 transition-colors cursor-pointer"
              disabled={loading}
            />
          </div>

          {parsedSummary && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200">
              <CheckCircle2 className="h-4 w-4" />
              <span>Parsed {parsedSummary.rowCount} marks entries for {parsedSummary.studentCount} students.</span>
            </div>
          )}

          <button 
            onClick={processUpload}
            disabled={!file || loading}
            className="btn-primary w-full flex justify-center items-center gap-2 shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Processing Upload...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Upload Results
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
