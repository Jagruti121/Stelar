import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';

export const onAttendanceSessionWritten = onDocumentWritten('attendanceSessions/{sessionId}', async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();

  const isCreate = !event.data?.before.exists && event.data?.after.exists;
  const isDelete = event.data?.before.exists && !event.data?.after.exists;
  const isUpdate = event.data?.before.exists && event.data?.after.exists;

  // We need to figure out the delta for each student.
  // Map of studentId -> { presentDelta: number, totalDelta: number, subjectId: string }
  const deltas = new Map<string, { presentDelta: number, totalDelta: number, subjectId: string }>();

  const subjectId = after?.subjectId || before?.subjectId;
  const hours = Number(after?.lectureHours || before?.lectureHours || 1);

  if (isCreate && after) {
    after.presentIds?.forEach((id: string) => {
      deltas.set(id, { presentDelta: hours, totalDelta: hours, subjectId });
    });
    after.absentIds?.forEach((id: string) => {
      deltas.set(id, { presentDelta: 0, totalDelta: hours, subjectId });
    });
  } else if (isDelete && before) {
    before.presentIds?.forEach((id: string) => {
      deltas.set(id, { presentDelta: -hours, totalDelta: -hours, subjectId });
    });
    before.absentIds?.forEach((id: string) => {
      deltas.set(id, { presentDelta: 0, totalDelta: -hours, subjectId });
    });
  } else if (isUpdate && before && after) {
    // A student could move from present to absent or vice versa
    const oldPresent = new Set<string>((before.presentIds as string[]) || []);
    const newPresent = new Set<string>((after.presentIds as string[]) || []);
    const oldAbsent = new Set<string>((before.absentIds as string[]) || []);
    const newAbsent = new Set<string>((after.absentIds as string[]) || []);

    const allStudents = new Set<string>([...oldPresent, ...newPresent, ...oldAbsent, ...newAbsent]);

    allStudents.forEach((id: string) => {
      let presentDelta = 0;
      let totalDelta = 0;

      const wasPresent = oldPresent.has(id);
      const isPresent = newPresent.has(id);
      const wasAbsent = oldAbsent.has(id);
      const isAbsent = newAbsent.has(id);

      const wasTracked = wasPresent || wasAbsent;
      const isTracked = isPresent || isAbsent;

      if (!wasTracked && isTracked) {
        totalDelta = 1;
        if (isPresent) presentDelta = 1;
      } else if (wasTracked && !isTracked) {
        totalDelta = -1;
        if (wasPresent) presentDelta = -1;
      } else if (wasTracked && isTracked) {
        if (wasPresent && isAbsent) presentDelta = -1;
        if (wasAbsent && isPresent) presentDelta = 1;
      }

      if (presentDelta !== 0 || totalDelta !== 0) {
        deltas.set(id, { presentDelta, totalDelta, subjectId });
      }
    });
  }

  if (deltas.size === 0) return;

  const batch = db.batch();
  
  for (const [studentId, delta] of deltas.entries()) {
    const summaryRef = db.collection('attendanceSummary').doc(studentId);
    
    // We can't easily increment nested maps with FieldValue without specifying the exact key path.
    // Fortunately, we know the path: `bySubject.${delta.subjectId}.present`
    batch.set(summaryRef, {
      id: studentId,
      updatedAt: FieldValue.serverTimestamp(),
      bySubject: {
        [delta.subjectId]: {
          present: FieldValue.increment(delta.presentDelta),
          total: FieldValue.increment(delta.totalDelta)
        }
      }
    }, { merge: true });
  }

  await batch.commit();
});
