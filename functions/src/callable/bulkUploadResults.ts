import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const SubjectMarkSchema = z.object({
  subjectId: z.string(),
  subjectCode: z.string(),
  marks: z.number(),
  maxMarks: z.number(),
  grade: z.string(),
});

const ResultUploadSchema = z.object({
  semester: z.number(),
  results: z.array(z.object({
    studentId: z.string(),
    sgpa: z.number(),
    subjectMarks: z.array(SubjectMarkSchema)
  }))
});

export const bulkUploadResults = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }
  let roles: string[] = (request.auth.token.roles as string[]) || [];
  if (!roles.includes('HOD')) {
    const staffDoc = await db.collection('staff').doc(request.auth.uid).get();
    if (staffDoc.exists) {
      roles = (staffDoc.data()?.roles as string[]) || [];
    }
  }
  if (!roles.includes('HOD')) {
    throw new HttpsError('permission-denied', 'Only HODs can upload results');
  }

  let data;
  try {
    data = ResultUploadSchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  const { semester, results } = data;
  const batch = db.batch();
  
  for (const res of results) {
    const rawId = res.studentId.trim();
    const cleanRoll = rawId.toUpperCase().replace(/^STUDENT_/, '');
    
    // Extract pure roll if composite key like dept_semX_divY_roll or dept_roll
    const compositeMatch = rawId.match(/_div[a-zA-Z0-9]+_([a-zA-Z0-9]+)$/i) || rawId.match(/_([a-zA-Z0-9]+)$/);
    const pureRoll = (compositeMatch && compositeMatch[1]) ? compositeMatch[1].toUpperCase() : cleanRoll;

    const standardStudentId = 'student_' + pureRoll;
    const resultId = `${rawId}_${semester}`;
    const resultRef = db.collection('results').doc(resultId);
    
    const resultPayload = {
      id: resultId,
      studentId: rawId,
      rollNo: pureRoll,
      semester,
      sgpa: res.sgpa,
      subjectMarks: res.subjectMarks,
      uploadedBy: request.auth.uid,
      uploadedAt: FieldValue.serverTimestamp()
    };

    batch.set(resultRef, resultPayload, { merge: true });

    // Key variations to mirror to ensure instant lookup by any identifier
    const mirrorKeys = new Set<string>([
      `${standardStudentId}_${semester}`,
      `student_${cleanRoll}_${semester}`,
      `${pureRoll}_${semester}`,
      `${pureRoll.toLowerCase()}_${semester}`,
      `${cleanRoll}_${semester}`,
      `${cleanRoll.toLowerCase()}_${semester}`,
    ]);

    for (const key of mirrorKeys) {
      if (key !== resultId) {
        const mirrorRef = db.collection('results').doc(key);
        batch.set(mirrorRef, {
          ...resultPayload,
          id: key,
          studentId: key.replace(new RegExp(`_${semester}$`), '')
        }, { merge: true });
      }
    }

    // Update CGPA on both the raw doc and standard student_ docs
    const studentIdsToUpdate = new Set<string>([rawId, standardStudentId, pureRoll, `student_${cleanRoll}`]);
    for (const sid of studentIdsToUpdate) {
      const sRef = db.collection('students').doc(sid);
      batch.set(sRef, {
        cgpa: res.sgpa,
        semester: semester
      }, { merge: true });
    }
  }

  await batch.commit();

  return { success: true, count: results.length };
});
