/**
 * STELLAR — Demo Users Seeder
 *
 * Populates Firebase Auth & Firestore emulators with ready-to-use test accounts:
 * - HOD / Teacher
 * - Faculty / Teacher
 * - Active Student (ready to log in)
 * - Pending Student (ready to test /activate)
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import crypto from 'node:crypto';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const app = getApps().length === 0 ? initializeApp({ projectId: 'stellar-ef848' }) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

function sha256(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function seedDemoUsers() {
  console.log('🌟 Seeding STELLAR Demo Accounts into Firebase Emulator...\n');

  // 1. Ensure CSE & MECH Departments exist
  const depts = [
    { id: 'cse', name: 'Computer Science & Engineering', code: 'CSE', durationYears: 3, semesterCount: 6 },
    { id: 'mech', name: 'Mechanical Engineering', code: 'MECH', durationYears: 3, semesterCount: 6 },
  ];
  for (const dept of depts) {
    await db.collection('departments').doc(dept.id).set({
      ...dept,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    }, { merge: true });
  }

  // 2. Teacher (HOD) Account
  const hodEmail = 'hod@stellar.edu';
  const hodPassword = 'Password123!';
  const hodEmpId = 'EMP101';
  let hodUser;
  try {
    hodUser = await auth.getUserByEmail(hodEmail);
    await auth.updateUser(hodUser.uid, { password: hodPassword, displayName: 'Dr. Ramesh Kumar (HOD)' });
  } catch {
    hodUser = await auth.createUser({
      email: hodEmail,
      password: hodPassword,
      displayName: 'Dr. Ramesh Kumar (HOD)',
    });
  }
  await auth.setCustomUserClaims(hodUser.uid, {
    roles: ['HOD', 'FACULTY'],
    deptId: 'cse',
  });
  await db.collection('staff').doc(hodUser.uid).set({
    id: hodUser.uid,
    name: 'Dr. Ramesh Kumar (HOD)',
    email: hodEmail,
    employeeId: hodEmpId,
    deptId: 'cse',
    roles: ['HOD', 'FACULTY'],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ Created HOD Account:');
  console.log(`   Email: ${hodEmail} | Emp ID: ${hodEmpId} | Password: ${hodPassword}`);

  // 3. Teacher (Faculty) Account
  const facultyEmail = 'faculty@stellar.edu';
  const facultyPassword = 'Password123!';
  const facultyEmpId = 'EMP102';
  let facultyUser;
  try {
    facultyUser = await auth.getUserByEmail(facultyEmail);
    await auth.updateUser(facultyUser.uid, { password: facultyPassword, displayName: 'Prof. Sunita Patil' });
  } catch {
    facultyUser = await auth.createUser({
      email: facultyEmail,
      password: facultyPassword,
      displayName: 'Prof. Sunita Patil',
    });
  }
  await auth.setCustomUserClaims(facultyUser.uid, {
    roles: ['FACULTY'],
    deptId: 'cse',
  });
  await db.collection('staff').doc(facultyUser.uid).set({
    id: facultyUser.uid,
    name: 'Prof. Sunita Patil',
    email: facultyEmail,
    employeeId: facultyEmpId,
    deptId: 'cse',
    roles: ['FACULTY'],
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ Created Faculty Account:');
  console.log(`   Email: ${facultyEmail} | Emp ID: ${facultyEmpId} | Password: ${facultyPassword}`);

  // 4. Student (Activated and ready for login)
  const studentEmail = 'student@stellar.edu';
  const studentPassword = 'Password123!';
  const studentRollNo = '202303026';
  const studentDocId = `student_${studentRollNo}`;
  let studentUser;
  try {
    studentUser = await auth.getUserByEmail(studentEmail);
    await auth.updateUser(studentUser.uid, { password: studentPassword, displayName: 'Raju Jha' });
  } catch {
    studentUser = await auth.createUser({
      email: studentEmail,
      password: studentPassword,
      displayName: 'Raju Jha',
    });
  }
  await auth.setCustomUserClaims(studentUser.uid, {
    roles: ['STUDENT'],
    studentId: studentDocId,
    deptId: 'cse',
    division: 'A',
  });
  await db.collection('students').doc(studentDocId).set({
    id: studentDocId,
    name: 'Raju Jha',
    nameLower: 'raju jha',
    rollNo: studentRollNo,
    roll: studentRollNo,
    srNo: 1,
    division: 'A',
    deptId: 'cse',
    department: 'CS',
    year: 'First',
    batch: '2023-2026',
    semester: 1,
    sem: 1,
    status: 'active',
    isActive: true,
    passwordSet: true,
    authUid: studentUser.uid,
    email: studentEmail,
    activationCode: 'STEL1A1A',
    activationCodeHash: sha256('STEL1A1A'),
    profileCompleteness: 80,
    cgpa: 8.75,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ Created Active Student Account:');
  console.log(`   Email: ${studentEmail} | Roll No: ${studentRollNo} | Password: ${studentPassword}`);

  // 5. Student (Pending activation for testing /activate)
  const pendingRollNo = '202303027';
  const pendingCode = 'STEL8A2F';
  const pendingDocId = `student_${pendingRollNo}`;
  await db.collection('students').doc(pendingDocId).set({
    id: pendingDocId,
    name: 'Priya Sharma',
    nameLower: 'priya sharma',
    rollNo: pendingRollNo,
    roll: pendingRollNo,
    srNo: 2,
    division: 'A',
    deptId: 'mech',
    department: 'MECH',
    year: 'Second',
    batch: '2023-2026',
    semester: 2,
    sem: 2,
    status: 'inactive',
    isActive: false,
    passwordSet: false,
    authUid: null,
    activationCode: pendingCode,
    activationCodeHash: sha256(pendingCode),
    profileCompleteness: 20,
    cgpa: 0,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  }, { merge: true });
  console.log('✅ Created Pending Student (For Activation Testing):');
  console.log(`   Roll No: ${pendingRollNo} | Activation Code: ${pendingCode}`);

  console.log('\n✨ All demo accounts successfully seeded!\n');
  process.exit(0);
}

seedDemoUsers().catch((err) => {
  console.error('❌ Failed seeding demo accounts:', err);
  process.exit(1);
});
