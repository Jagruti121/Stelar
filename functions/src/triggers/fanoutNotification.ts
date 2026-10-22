import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { FieldValue, CollectionReference, Query } from 'firebase-admin/firestore';
import { db } from '../lib/admin';

export const fanoutNotification = onDocumentCreated('notifications/{notificationId}', async (event) => {
  const snap = event.data;
  if (!snap) return;

  const data = snap.data();
  const target = data.target;

  let query: CollectionReference | Query = db.collection('students');

  // Build query based on target type
  if (target.type === 'dept' && target.deptIds && target.deptIds.length > 0) {
    query = query.where('deptId', 'in', target.deptIds);
  } else if (target.type === 'division' && target.divisions && target.divisions.length > 0) {
    query = query.where('division', 'in', target.divisions);
  } else if (target.type === 'students' && target.studentIds && target.studentIds.length > 0) {
    // If it's a specific list of students, we can query in chunks of 30, 
    // but for simplicity in this trigger we'll just do a single 'in' (max 30) or fetch all and filter.
    // Assuming small targeted list for now.
    query = query.where('id', 'in', target.studentIds.slice(0, 30));
  }
  // if 'all', query stays as all students

  const snapshot = await query.get();
  
  if (snapshot.empty) return;

  const batch = db.batch();
  let count = 0;

  snapshot.docs.forEach((studentDoc) => {
    const studentId = studentDoc.id;
    const inboxRef = db.collection('students').doc(studentId).collection('inbox').doc(snap.id);
    
    batch.set(inboxRef, {
      id: snap.id,
      notificationId: snap.id,
      title: data.title,
      message: data.message,
      read: false,
      createdAt: FieldValue.serverTimestamp() // keeping the delivery time
    });

    count++;
    // Firestore batch limit is 500. In production, we need to chunk batches.
    // For this prototype, we'll assume less than 500 students per batch.
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Notification ${snap.id} delivered to ${count} students`);
  }
});
