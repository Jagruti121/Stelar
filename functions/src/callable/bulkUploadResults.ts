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
    const cleanRoll = rawId.toUpperCase().replace('STUDENT_', '');
    const standardStudentId = 'student_' + cleanRoll;

    const resultId = `${rawId}_${semester}`;
    const resultRef = db.collection('results').doc(resultId);
    
    const resultPayload = {
      id: resultId,
      studentId: rawId,
      rollNo: cleanRoll,
      semester,
      sgpa: res.sgpa,
      subjectMarks: res.subjectMarks,
      uploadedBy: request.auth.uid,
      uploadedAt: FieldValue.serverTimestamp()
    };

    batch.set(resultRef, resultPayload, { merge: true });

    // Also mirror to standard student_ID doc if different
    if (resultId !== `${standardStudentId}_${semester}`) {
      const mirrorRef = db.collection('results').doc(`${standardStudentId}_${semester}`);
      batch.set(mirrorRef, {
        ...resultPayload,
        id: `${standardStudentId}_${semester}`,
        studentId: standardStudentId
      }, { merge: true });
    }

    // Also mirror to lowercase roll doc (e.g. cs1001_5)
    if (resultId !== `${cleanRoll.toLowerCase()}_${semester}`) {
      const lowerRef = db.collection('results').doc(`${cleanRoll.toLowerCase()}_${semester}`);
      batch.set(lowerRef, {
        ...resultPayload,
        id: `${cleanRoll.toLowerCase()}_${semester}`,
        studentId: cleanRoll.toLowerCase()
      }, { merge: true });
    }

    // Update CGPA on both the raw doc and standard student_ doc
    const studentRef1 = db.collection('students').doc(rawId);
    batch.set(studentRef1, {
      cgpa: res.sgpa,
      semester: semester
    }, { merge: true });

    const studentRef2 = db.collection('students').doc(standardStudentId);
    batch.set(studentRef2, {
      cgpa: res.sgpa,
      semester: semester
    }, { merge: true });
  }

  await batch.commit();

  return { success: true, count: results.length };
});
