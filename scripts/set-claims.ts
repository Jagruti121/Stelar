/**
 * STELLAR — Set HOD Custom Claims on all staff users in the emulator
 *
 * Run with:
 *   npx tsx scripts/set-claims.ts
 *
 * Requires emulators to be running.
 */
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const app = getApps().length === 0 ? initializeApp({ projectId: 'stellar-ef848' }) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);

async function setClaims() {
  console.log('🔐 STELLAR — Setting custom claims for all staff users...\n');

  // List all Auth emulator users
  const listResult = await auth.listUsers(1000);
  const users = listResult.users;
  console.log(`Found ${users.length} user(s) in Auth emulator.\n`);

  for (const user of users) {
    // Look up the staff document for this user
    const staffSnap = await db.collection('staff').doc(user.uid).get();
    if (!staffSnap.exists) {
      console.log(`  ⚠  ${user.email} — no staff doc found, skipping.`);
      continue;
    }

    const staffData = staffSnap.data()!;
    const roles: string[] = (staffData.roles as string[]) || ['FACULTY'];
    const deptId: string = staffData.deptId || staffData.department || '';

    // Set custom claims
    await auth.setCustomUserClaims(user.uid, { roles, deptId });
    console.log(`  ✓  ${user.email} → claims set: roles=${JSON.stringify(roles)}, deptId="${deptId}"`);

    // Also ensure the displayName is set if missing
    if (!user.displayName && staffData.name) {
      await auth.updateUser(user.uid, { displayName: staffData.name });
    }
  }

  console.log('\n✅ Done! Custom claims have been set on all staff users.');
  console.log('   ⚠  The user must SIGN OUT and SIGN IN again for new claims to take effect in their session.\n');
  process.exit(0);
}

setClaims().catch((err) => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
