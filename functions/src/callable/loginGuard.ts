/**
 * loginGuard — Phase 1 stub
 * Full implementation in Phase 1.
 */
import { onCall, HttpsError } from 'firebase-functions/v2/https';

export const loginGuard = onCall({ region: 'us-central1' }, (_request) => {
  throw new HttpsError('unimplemented', 'loginGuard will be implemented in Phase 1');
});
