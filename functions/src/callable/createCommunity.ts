import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

const CreateCommunitySchema = z.object({
  name: z.string().min(2, 'Community name must be at least 2 characters').max(100),
  description: z.string().max(1000).optional().default(''),
  restrictionType: z.enum(['open', 'dept', 'invite']).optional().default('invite'),
  deptIds: z.array(z.string()).optional()
});

export const createCommunity = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  let roles: string[] = (request.auth.token.roles as string[]) || [];
  if (!roles.includes('FACULTY') && !roles.includes('HOD')) {
    const staffDoc = await db.collection('staff').doc(request.auth.uid).get();
    if (staffDoc.exists) {
      roles = (staffDoc.data()?.roles as string[]) || [];
    }
  }
  const isFaculty = roles.includes('FACULTY') || roles.includes('HOD');
  if (!isFaculty) {
    throw new HttpsError('permission-denied', 'Only faculty can create communities');
  }

  let data;
  try {
    data = CreateCommunitySchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  // Generate 8 char invite code
  const inviteCode = randomBytes(4).toString('hex').toUpperCase();

  const communityRef = db.collection('communities').doc();
  const memberRef = communityRef.collection('members').doc(request.auth.uid);

  const batch = db.batch();

  batch.set(communityRef, {
    id: communityRef.id,
    name: data.name,
    description: data.description,
    restriction: {
      type: data.restrictionType,
      deptIds: data.deptIds || []
    },
    ownerId: request.auth.uid,
    inviteCode,
    inviteEnabled: true,
    memberCount: 1,
    createdAt: FieldValue.serverTimestamp()
  });

  batch.set(memberRef, {
    id: request.auth.uid,
    uid: request.auth.uid,
    name: request.auth.token.name || 'Faculty',
    role: 'owner',
    joinedAt: FieldValue.serverTimestamp()
  });

  await batch.commit();

  return { success: true, id: communityRef.id, inviteCode };
});
