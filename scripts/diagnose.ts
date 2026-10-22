import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const app = getApps().length === 0 ? initializeApp({ projectId: 'stellar-ef848' }) : getApps()[0];
const db = getFirestore(app);
const auth = getAuth(app);

async function diagnose() {
  console.log('\n=== Communities ===');
  const comSnap = await db.collection('communities').get();
  console.log('Count:', comSnap.size);
  comSnap.docs.forEach(d => console.log(' -', d.data().name, '| owner:', d.data().ownerId));

  console.log('\n=== Auth Users & Claims ===');
  const users = await auth.listUsers(100);
  for (const u of users.users) {
    console.log(` - ${u.email} | claims: ${JSON.stringify(u.customClaims)}`);
  }
}

diagnose().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
