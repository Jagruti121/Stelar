/**
 * STELLAR — Seed Script (Phase 0 Stub)
 *
 * Runs against the Firebase Emulator Suite to populate test data.
 * Full implementation will be added incrementally as phases are completed.
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Prerequisites:
 *   - Firebase Emulators must be running: firebase emulators:start
 */

import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

const app = getApps().length === 0 ? initializeApp({ projectId: 'stellar-ef848' }) : getApps()[0];
const db = getFirestore(app);

async function seed(): Promise<void> {
  console.log('🌱 STELLAR Seed Script — Phase 0 stub');
  console.log('   Seeding departments…');

  const departments = [
    { id: 'cse', name: 'Computer Science & Engineering', code: 'CSE', durationYears: 3, semesterCount: 6 },
    { id: 'mech', name: 'Mechanical Engineering', code: 'MECH', durationYears: 3, semesterCount: 6 },
  ];

  for (const dept of departments) {
    await db.collection('departments').doc(dept.id).set({
      name: dept.name,
      code: dept.code,
      durationYears: dept.durationYears,
      semesterCount: dept.semesterCount,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
    console.log(`   ✓ Department: ${dept.name}`);
  }

  console.log('\n✅ Phase 0 seed complete.');
  console.log('   Full seed data (students, staff, profiles, etc.) will be added in Phase 2.');

  process.exit(0);
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
