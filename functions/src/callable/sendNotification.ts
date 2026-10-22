import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const NotificationTargetSchema = z.object({
  type: z.enum(['all', 'dept', 'division', 'students']),
  deptIds: z.array(z.string()).optional(),
  divisions: z.array(z.string()).optional(),
  studentIds: z.array(z.string()).optional(),
});

const SendNotificationSchema = z.object({
  title: z.string().min(1),
  message: z.string().min(1),
  target: NotificationTargetSchema
});

export const sendNotification = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  let roles: string[] = (request.auth.token.roles as string[]) || [];
  if (roles.length === 0) {
    const staffDoc = await db.collection('staff').doc(request.auth.uid).get();
    if (staffDoc.exists) {
      roles = (staffDoc.data()?.roles as string[]) || [];
    }
  }
  const isFaculty = roles.includes('FACULTY') || roles.includes('HOD');
  if (!isFaculty) {
    throw new HttpsError('permission-denied', 'Only faculty can send notifications');
  }

  let data;
  try {
    data = SendNotificationSchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  const docRef = db.collection('notifications').doc();
  await docRef.set({
    id: docRef.id,
    title: data.title,
    message: data.message,
    target: data.target,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp()
  });

  return { success: true, id: docRef.id };
});
