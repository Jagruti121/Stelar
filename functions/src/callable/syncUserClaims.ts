import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { auth, db } from '../lib/admin';

export const syncUserClaims = onCall({ region: 'us-central1' }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const uid = request.auth.uid;

  // 1. Check if user is in staff collection
  const staffSnap = await db.collection('staff').doc(uid).get();
  if (staffSnap.exists) {
    const data = staffSnap.data() || {};
    let roles: string[] = (data.roles as string[]) || ['FACULTY'];
    
    // An HOD is also a faculty member
    if (roles.includes('HOD') && !roles.includes('FACULTY')) {
      roles.push('FACULTY');
      await db.collection('staff').doc(uid).update({ roles });
    }

    const deptId = data.deptId || data.department || '';

    await auth.setCustomUserClaims(uid, {
      roles,
      deptId
    });

    return {
      success: true,
      type: 'staff',
      roles,
      deptId
    };
  }

  // 2. Check if user is in students collection
  const studentSnap = await db.collection('students').doc(uid).get();
  if (studentSnap.exists) {
    const data = studentSnap.data() || {};
    const roles = ['STUDENT'];
    const studentId = data.id || uid;
    const deptId = data.deptId || '';
    const division = data.division || '';

    await auth.setCustomUserClaims(uid, {
      roles,
      studentId,
      deptId,
      division
    });

    return {
      success: true,
      type: 'student',
      roles,
      studentId,
      deptId,
      division
    };
  }

  // 3. Fallback: query student by authUid field if doc id is student roll ID
  const studentByAuthSnap = await db.collection('students').where('authUid', '==', uid).limit(1).get();
  if (!studentByAuthSnap.empty) {
    const data = studentByAuthSnap.docs[0].data() || {};
    const roles = ['STUDENT'];
    const studentId = data.id || studentByAuthSnap.docs[0].id;
    const deptId = data.deptId || '';
    const division = data.division || '';

    await auth.setCustomUserClaims(uid, {
      roles,
      studentId,
      deptId,
      division
    });

    return {
      success: true,
      type: 'student',
      roles,
      studentId,
      deptId,
      division
    };
  }

  return { success: false, message: 'User record not found in staff or students' };
});
