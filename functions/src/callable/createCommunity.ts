import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'crypto';

const CreateCommunitySchema = z.object({
  name: z.string().min(2, 'Community name must be at least 2 characters').max(100),
  description: z.string().min(1, 'Description is required').max(1000),
  adminName: z.string().min(1, 'Name of Admin is required').max(100).optional().default('Admin'),
  targetAudience: z.enum(['all', 'dept']).optional().default('all'),
  department: z.string().optional().default('All'),
  chatPermission: z.enum(['one-side', 'both-side']).optional().default('both-side'),
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

  // Generate 6-8 char unique alphanumeric Secret Code
  const secretCode = randomBytes(3).toString('hex').toUpperCase();

  const communityRef = db.collection('communities').doc();
  const memberRef = communityRef.collection('members').doc(request.auth.uid);

  const batch = db.batch();

  batch.set(communityRef, {
    id: communityRef.id,
    name: data.name,
    description: data.description,
    adminName: data.adminName || request.auth.token.name || 'Faculty Admin',
    targetAudience: data.targetAudience,
    department: data.department,
    chatPermission: data.chatPermission,
    restriction: {
      type: data.restrictionType,
      deptIds: data.deptIds || []
    },
    ownerId: request.auth.uid,
    secretCode,
    inviteCode: secretCode,
    inviteEnabled: true,
    members: [request.auth.uid],
    memberCount: 1,
    createdAt: FieldValue.serverTimestamp()
  });

  batch.set(memberRef, {
    id: request.auth.uid,
    uid: request.auth.uid,
    name: data.adminName || request.auth.token.name || 'Faculty',
    role: 'owner',
    joinedAt: FieldValue.serverTimestamp()
  });

  await batch.commit();

  return { success: true, id: communityRef.id, secretCode, inviteCode: secretCode };
});
