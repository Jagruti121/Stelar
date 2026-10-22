import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { db } from '../lib/admin';

export const onPollVoteCreated = onDocumentCreated('polls/{pollId}/votes/{studentId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const voteData = snap.data();
  const optionId = voteData.optionId;
  const pollId = event.params.pollId;

  if (!optionId) return;

  const pollRef = db.collection('polls').doc(pollId);

  try {
    await db.runTransaction(async (transaction) => {
      const pollDoc = await transaction.get(pollRef);
      if (!pollDoc.exists) return;

      const poll = pollDoc.data();
      const options = poll?.options || [];

      // Find the option and increment its count
      const updatedOptions = options.map((opt: any) => {
        if (opt.id === optionId) {
          return { ...opt, count: (opt.count || 0) + 1 };
        }
        return opt;
      });

      transaction.update(pollRef, { options: updatedOptions });
    });
  } catch (error) {
    console.error(`Failed to update poll ${pollId} with vote`, error);
  }
});
