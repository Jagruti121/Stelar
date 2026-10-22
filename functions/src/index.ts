/**
 * STELLAR Cloud Functions — Entry point
 *
 * Re-exports all callable and trigger functions. Each module is
 * lazily imported so cold-start time stays low.
 */

// Callable functions (Phase 1+)
export { registerStaff } from './callable/registerStaff';
export { bulkUploadStudents } from './callable/bulkUploadStudents';
export { activateStudent } from './callable/activateStudent';
export { bulkUploadResults } from './callable/bulkUploadResults';
export { sendNotification } from './callable/sendNotification';
export { createCommunity } from './callable/createCommunity';
export { joinCommunity } from './callable/joinCommunity';
export { searchTalent } from './callable/searchTalent';
export { syncUserClaims } from './callable/syncUserClaims';

// Trigger functions (Phase 1+)
export { onAttendanceSessionWritten } from './triggers/onAttendanceSessionWritten';
export { fanoutNotification } from './triggers/fanoutNotification';
export { onPollVoteCreated } from './triggers/onPollVoteCreated';

// ── Phase 0 health check ─────────────────────────────────────
// A simple no-op callable used to verify emulator connectivity.
import { onCall } from 'firebase-functions/v2/https';

export const healthCheck = onCall({ region: 'us-central1' }, (_request) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});
