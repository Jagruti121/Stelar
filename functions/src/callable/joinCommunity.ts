import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { z } from 'zod';
import { db } from '../lib/admin';
import { FieldValue } from 'firebase-admin/firestore';

const JoinCommunitySchema = z.object({
  inviteCode: z.string().min(1)
});

export const joinCommunity = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  let data;
  try {
    data = JoinCommunitySchema.parse(request.data);
  } catch (error: any) {
    throw new HttpsError('invalid-argument', 'Invalid payload', error.errors);
  }

  // Find the community by secretCode or inviteCode
  const code = data.inviteCode.trim().toUpperCase();
  let snapshot = await db.collection('communities').where('secretCode', '==', code).limit(1).get();
  if (snapshot.empty) {
    snapshot = await db.collection('communities').where('inviteCode', '==', code).limit(1).get();
  }

  if (snapshot.empty) {
    throw new HttpsError('not-found', 'Invalid Secret Code');
  }

  const communityDoc = snapshot.docs[0];
  const community = communityDoc.data();

  const uid = request.auth.uid;
  const name = request.auth.token.name || (request.auth.token.studentId as string) || 'User';

  const memberRef = communityDoc.ref.collection('members').doc(uid);

  // Use transaction to safely add member and increment count
  await db.runTransaction(async (transaction) => {
    const memberDoc = await transaction.get(memberRef);
    const existingMembers = (community.members as string[]) || [];

    if (memberDoc.exists || existingMembers.includes(uid)) {
      throw new HttpsError('already-exists', 'You are already a member of this community');
    }

    transaction.set(memberRef, {
      id: uid,
      uid,
      name,
      role: 'member',
      joinedAt: FieldValue.serverTimestamp()
    });

    transaction.update(communityDoc.ref, {
      members: FieldValue.arrayUnion(uid),
      memberCount: FieldValue.increment(1)
    });
  });

  return { success: true, id: communityDoc.id, name: community.name };
});
