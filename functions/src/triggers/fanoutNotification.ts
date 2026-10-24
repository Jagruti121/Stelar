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
  if (target?.type === 'dept') {
    const rawTerms = [
      ...(target.deptIds || []),
      ...(target.department ? [target.department, target.department.toLowerCase()] : []),
    ];
    // Expand acronyms/names
    const terms = new Set<string>();
    rawTerms.forEach(t => {
      terms.add(t);
      terms.add(t.toLowerCase());
      if (t.toLowerCase() === 'cs' || t.toLowerCase() === 'cse' || t.toLowerCase() === 'computer science') {
        terms.add('cs');
        terms.add('cse');
        terms.add('computer science');
        terms.add('Computer Science');
      }
      if (t.toLowerCase() === 'it' || t.toLowerCase() === 'information technology') {
        terms.add('it');
        terms.add('information technology');
        terms.add('Information Technology');
      }
    });
    const termsArray = Array.from(terms).slice(0, 30);
    if (termsArray.length > 0) {
      query = query.where('deptId', 'in', termsArray);
    }
  } else if (target?.type === 'division' && target.divisions && target.divisions.length > 0) {
    query = query.where('division', 'in', target.divisions);
  } else if (target?.type === 'students' && target.studentIds && target.studentIds.length > 0) {
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
      priority: data.priority || 'casual',
      read: false,
      createdAt: FieldValue.serverTimestamp() // keeping the delivery time
    });

    count++;
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Notification ${snap.id} delivered to ${count} students`);
  }
});
