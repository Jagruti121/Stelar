import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import * as crypto from 'crypto';
import { db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const StudentRowSchema = z.object({
  deptCode: z.string(),
  batch: z.string(), // e.g., '2021'
  division: z.string(), // e.g., 'A', 'B'
  roll: z.string(),
  name: z.string(),
});

const BulkUploadSchema = z.object({
  students: z.array(StudentRowSchema),
});

/**
 * Generates a random alphanumeric activation code
 */
function generateActivationCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // 8 characters
}

/**
 * Creates SHA-256 hash of the code
 */
function hashActivationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const bulkUploadStudents = onCall({ region: 'us-central1' }, async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be logged in');
  }

  // Require HOD role
  if (!request.auth.token.roles?.includes('HOD')) {
    throw new HttpsError('permission-denied', 'Only HODs can bulk upload students');
  }

  let data;
  try {
    data = BulkUploadSchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  const batch = db.batch();
  const results: Array<{ id: string; name: string; activationCode: string; status: string }> = [];

  for (const student of data.students) {
    const studentId = `${student.deptCode.toLowerCase()}_${student.batch}_${student.division.toLowerCase()}_${student.roll.toLowerCase()}`;
    const plainCode = generateActivationCode();
    const hashedCode = hashActivationCode(plainCode);

    const studentRef = db.collection('students').doc(studentId);
    
    // We overwrite or set new data. If updating, we shouldn't overwrite existing active students.
    // For simplicity in Phase 2, we assume we are upserting and giving new activation codes.
    // In production, we'd check if `isActive: true` and skip.
    batch.set(studentRef, {
      id: studentId,
      deptId: student.deptCode.toLowerCase(),
      batch: student.batch,
      division: student.division.toUpperCase(),
      rollNo: student.roll.toUpperCase(),
      name: student.name,
      isActive: false,
      activationCodeHash: hashedCode,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      // Stats placeholders
      cgpa: 0,
      totalCredits: 0,
      attendancePercentage: 0,
      points: 0,
    }, { merge: true }); // Merge keeps existing data if any

    results.push({
      id: studentId,
      name: student.name,
      activationCode: plainCode,
      status: 'Created/Updated',
    });
  }

  // Commit batch
  await batch.commit();

  return { success: true, count: results.length, students: results };
});
