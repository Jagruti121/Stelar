import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { z } from 'zod';
import { auth, db } from '../lib/admin';

const FACULTY_REG_CODE = defineSecret('FACULTY_REG_CODE');
const HOD_REG_CODE = defineSecret('HOD_REG_CODE');

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
  empId: z.string().min(2),
  department: z.string().min(2),
  role: z.enum(['HOD', 'FACULTY']),
  secretCode: z.string().min(1),
});

export const registerStaff = onCall(
  { secrets: [FACULTY_REG_CODE, HOD_REG_CODE], region: 'us-central1' },
  async (request) => {
    try {
      const data = RegisterSchema.parse(request.data);

      // Verify secret code based on requested role
      const expectedCode = data.role === 'HOD' ? HOD_REG_CODE.value() : FACULTY_REG_CODE.value();
      if (data.secretCode !== expectedCode) {
        throw new HttpsError('permission-denied', 'Invalid registration code.');
      }

      // Create Auth user
      const userRecord = await auth.createUser({
        email: data.email,
        password: data.password,
        displayName: data.name,
      });

      // Set custom claims
      const roles = data.role === 'HOD' ? ['HOD', 'FACULTY'] : ['FACULTY'];
      await auth.setCustomUserClaims(userRecord.uid, { roles });

      // Create Firestore document
      await db.collection('staff').doc(userRecord.uid).set({
        uid: userRecord.uid,
        email: data.email,
        name: data.name,
        empId: data.empId,
        department: data.department,
        roles: roles,
        createdAt: new Date(), // Using Server Timestamp in client, but date here is fine for functions
      });

      return { success: true, uid: userRecord.uid };
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        throw new HttpsError('invalid-argument', 'Invalid request payload.', error.errors);
      }
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', error.message || 'An unexpected error occurred.');
    }
  }
);
