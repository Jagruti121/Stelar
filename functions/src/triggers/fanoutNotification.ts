import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../lib/admin';

/**
 * Normalizes any department variation to its canonical name.
 * Handles 'c.s', 'c. s', 'cs', 'cse', 'computer science'
 * 'i.t', 'it', 'information technology'
 * 'd.s', 'ds', 'data science'
 * 'eng', 'engineering'
 */
function normalizeDept(raw?: string): string {
  if (!raw) return 'Other';
  const clean = raw.trim().toLowerCase().replace(/[\s\.\-_]/g, '');
  if (['cs', 'cse', 'comp', 'computerscience'].includes(clean)) return 'Computer Science';
  if (['it', 'informationtechnology'].includes(clean)) return 'Information Technology';
  if (['ds', 'datascience'].includes(clean)) return 'Data Science';
  if (['eng', 'engineering'].includes(clean)) return 'Engineering';
  return raw.trim();
}

export const fanoutNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const target = data.target;

  const snapshot = await db.collection('students').get();
  if (snapshot.empty) return;

  const targetType = target?.type || 'all';
  const targetCanonicalDept = normalizeDept(
    target?.department || data.department || (target?.deptIds && target?.deptIds[0])
  );
  const targetDivisions = target?.divisions?.map((d: any) => String(d).toUpperCase().trim()) || [];
  const targetYear = target?.year ? String(target.year).trim().toLowerCase() : null;

  const matchingStudents = snapshot.docs.filter((studentDoc) => {
    const sData = studentDoc.data();
    if (targetType === 'all') return true;

    if (targetType === 'dept') {
      const studentDept = normalizeDept(sData.department || sData.deptId);
      if (studentDept !== targetCanonicalDept) return false;

      // Division filter
      if (targetDivisions.length > 0) {
        const studentDiv = String(sData.division || '').toUpperCase().trim();
        if (studentDiv && !targetDivisions.includes(studentDiv)) return false;
      }

      // Year filter (e.g. 'First Year', 'First', sem 1-2)
      if (targetYear) {
        const studentYear = String(sData.year || '').trim().toLowerCase();
        if (studentYear && !targetYear.includes(studentYear) && !studentYear.includes(targetYear)) {
          const sem = Number(sData.semester || sData.sem);
          if (targetYear.includes('first') && sem > 2) return false;
          if (targetYear.includes('second') && (sem < 3 || sem > 4)) return false;
          if (targetYear.includes('third') && (sem < 5 || sem > 6)) return false;
        }
      }
      return true;
    }

    if (targetType === 'division') {
      if (targetDivisions.length > 0) {
        const studentDiv = String(sData.division || '').toUpperCase().trim();
        return targetDivisions.includes(studentDiv);
      }
      return true;
    }

    if (targetType === 'students') {
      return (target?.studentIds || []).includes(studentDoc.id);
    }

    return true;
  });

  if (matchingStudents.length === 0) return;

  // Firestore batches allow up to 500 operations. Chunk by 400.
  for (let i = 0; i < matchingStudents.length; i += 400) {
    const chunk = matchingStudents.slice(i, i + 400);
    const batch = db.batch();
    for (const studentDoc of chunk) {
      const inboxRef = db.collection('students').doc(studentDoc.id).collection('inbox').doc(snap.id);
      batch.set(inboxRef, {
        id: snap.id,
        notificationId: snap.id,
        title: data.title,
        message: data.message,
        priority: data.priority || 'casual',
        read: false,
        createdAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    await batch.commit();
  }

  console.log(`Notification ${snap.id} delivered to ${matchingStudents.length} students`);
});
