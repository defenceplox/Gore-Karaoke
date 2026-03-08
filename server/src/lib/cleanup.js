import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { expireSessions } from '../db/queries.js';
import { clearSessionIndex } from './songIndex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SONGS_DIR = path.join(__dirname, '../../public/songs');
const MAX_AGE_HOURS = Number(process.env.SESSION_EXPIRY_HOURS) || 8;
const INTERVAL_MS  = 60 * 60 * 1000; // Run every hour

export function startCleanup() {
  // Run once on startup, then on interval
  runCleanup();
  setInterval(runCleanup, INTERVAL_MS);
  console.log(`🧹 Session cleanup scheduled (every ${INTERVAL_MS / 60000} min, expire after ${MAX_AGE_HOURS}h)`);
}

function runCleanup() {
  const expiredIds = expireSessions(MAX_AGE_HOURS);

  for (const sessionId of expiredIds) {
    // Remove uploaded song files
    const sessionDir = path.join(SONGS_DIR, sessionId);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
      console.log(`🗑️  Deleted song files for session ${sessionId}`);
    }

    // Remove from in-memory song index
    clearSessionIndex(sessionId);
  }
}
