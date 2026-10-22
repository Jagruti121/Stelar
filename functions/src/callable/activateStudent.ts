import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import * as crypto from 'crypto';
import { auth, db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const ActivateSchema = z.object({
  studentId: z.string(),
  activationCode: z.string(),
  password: z.string().min(8),
});

/**
 * Creates SHA-256 hash of the code
 */
function hashActivationCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

export const activateStudent = onCall({ region: 'us-central1' }, async (request) => {
  let data;
  try {
    data = ActivateSchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  const { studentId, activationCode, password } = data;
  const docRef = db.collection('students').doc(studentId);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new HttpsError('not-found', 'Student record not found.');
  }

  const studentData = docSnap.data();
  if (studentData?.isActive) {
    throw new HttpsError('already-exists', 'Account is already activated. Please login.');
  }

  // Verify hash
  const providedHash = hashActivationCode(activationCode);
  if (providedHash !== studentData?.activationCodeHash) {
    throw new HttpsError('permission-denied', 'Invalid activation code.');
  }

  // Generate synthetic email
  const syntheticEmail = `${studentId.replace(/_/g, '.')}@students.stellar.local`;

  // Transaction to create Auth User and update Firestore safely
  try {
    const userRecord = await auth.createUser({
      uid: studentId,
      email: syntheticEmail,
      password: password,
      displayName: studentData?.name,
    });

    await auth.setCustomUserClaims(userRecord.uid, {
      roles: ['STUDENT'],
      studentId: studentId,
      deptId: studentData?.deptId,
      division: studentData?.division,
    });

    const batch = db.batch();

    // Update Firestore to remove hash and mark active
    batch.update(docRef, {
      isActive: true,
      authUid: userRecord.uid,
      activationCodeHash: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Create empty profile
    const profileRef = db.collection('studentProfiles').doc(studentId);
    batch.set(profileRef, {
      id: studentId,
      bio: '',
      skills: [],
      skillKeys: [],
      talentKeys: [],
      interestKeys: [],
      expertise: [],
      placementInterest: 'maybe',
      links: {},
      privacy: {
        skills: 'everyone',
        achievements: 'everyone',
        links: 'everyone',
        bio: 'everyone'
      },
      updatedAt: FieldValue.serverTimestamp()
    });

    await batch.commit();

    return { success: true };
  } catch (error: any) {
    console.error('Error activating student:', error);
    // If it's a "uid-already-exists" or "email-already-exists", they might have partially activated before.
    if (error.code === 'auth/uid-already-exists' || error.code === 'auth/email-already-exists') {
        throw new HttpsError('already-exists', 'Auth account already exists. Contact administrator.');
    }
    throw new HttpsError('internal', 'Failed to activate account.');
  }
});
