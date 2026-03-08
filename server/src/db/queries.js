import { getDb } from './database.js';
import { v4 as uuidv4 } from 'uuid';

// ── Sessions ─────────────────────────────────────────────────────────────────

function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function createSession() {
  const db = getDb();
  const id  = uuidv4();
  let pin;
  // Retry on unlikely collision
  for (let i = 0; i < 10; i++) {
    pin = generatePin();
    const existing = db.prepare('SELECT id FROM sessions WHERE pin = ?').get(pin);
    if (!existing) break;
  }
  db.prepare('INSERT INTO sessions (id, pin) VALUES (?, ?)').run(id, pin);
  return { id, pin };
}

export function getSessionByPin(pin) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE pin = ?').get(pin);
  if (session) {
    db.prepare('UPDATE sessions SET last_active = unixepoch() WHERE id = ?').run(session.id);
  }
  return session || null;
}

export function expireSessions(maxAgeHours = 8) {
  const db = getDb();
  const cutoff = Math.floor(Date.now() / 1000) - maxAgeHours * 3600;
  const expired = db.prepare('SELECT id FROM sessions WHERE last_active < ?').all(cutoff);
  if (expired.length > 0) {
    db.prepare('DELETE FROM sessions WHERE last_active < ?').run(cutoff);
    console.log(`🧹 Expired ${expired.length} session(s)`);
  }
  return expired.map(s => s.id);
}

// ── Queue ─────────────────────────────────────────────────────────────────────

export function getQueue(sessionId) {
  const db = getDb();
  return db
    .prepare(`SELECT * FROM queue_items WHERE session_id = ? AND status = 'queued' ORDER BY position ASC`)
    .all(sessionId);
}

export function addToQueue(sessionId, songData) {
  const db = getDb();
  const id = uuidv4();
  const maxPos = db
    .prepare(`SELECT COALESCE(MAX(position), -1) as m FROM queue_items WHERE session_id = ? AND status = 'queued'`)
    .get(sessionId).m;

  db.prepare(`
    INSERT INTO queue_items
      (id, session_id, song_id, song_title, artist_name, source, youtube_id, mp3_url, cdg_url, lyrics_data, singer_name, position)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    sessionId,
    songData.songId,
    songData.songTitle,
    songData.artistName,
    songData.source,
    songData.youtubeId   || null,
    songData.mp3Url      || null,
    songData.cdgUrl      || null,
    songData.lyricsData  ? JSON.stringify(songData.lyricsData) : null,
    songData.singerName  || 'Anonymous',
    maxPos + 1
  );

  return getQueue(sessionId);
}

export function removeFromQueue(sessionId, itemId) {
  const db = getDb();
  db.prepare(`DELETE FROM queue_items WHERE id = ? AND session_id = ?`).run(itemId, sessionId);
  reorderPositions(sessionId);
  return getQueue(sessionId);
}

export function reorderQueue(sessionId, orderedIds) {
  const db = getDb();
  const update = db.prepare(`UPDATE queue_items SET position = ? WHERE id = ? AND session_id = ?`);
  const tx = db.transaction((ids) => {
    ids.forEach((id, index) => update.run(index, id, sessionId));
  });
  tx(orderedIds);
  return getQueue(sessionId);
}

export function voteForItem(sessionId, itemId, voterId) {
  const db = getDb();
  const item = db.prepare(`SELECT * FROM queue_items WHERE id = ? AND session_id = ?`).get(itemId, sessionId);
  if (!item) return null;

  try {
    db.prepare(`INSERT INTO votes (id, queue_item_id, voter_id) VALUES (?, ?, ?)`)
      .run(uuidv4(), itemId, voterId);
  } catch {
    // Already voted — ignore unique constraint error
  }

  // Move item up one position (swap with preceding item)
  const prev = db.prepare(`
    SELECT * FROM queue_items
    WHERE session_id = ? AND status = 'queued' AND position < ?
    ORDER BY position DESC LIMIT 1
  `).get(sessionId, item.position);

  if (prev) {
    db.prepare(`UPDATE queue_items SET position = ? WHERE id = ?`).run(item.position, prev.id);
    db.prepare(`UPDATE queue_items SET position = ? WHERE id = ?`).run(prev.position, item.id);
  }

  return getQueue(sessionId);
}

export function markPlaying(sessionId) {
  const db = getDb();
  // Mark all currently playing as done
  db.prepare(`UPDATE queue_items SET status = 'done' WHERE session_id = ? AND status = 'playing'`).run(sessionId);
  // Get and mark the first queued item
  const next = db.prepare(`
    SELECT * FROM queue_items WHERE session_id = ? AND status = 'queued' ORDER BY position ASC LIMIT 1
  `).get(sessionId);
  if (next) {
    db.prepare(`UPDATE queue_items SET status = 'playing' WHERE id = ?`).run(next.id);
  }
  return next || null;
}

export function skipCurrent(sessionId) {
  const db = getDb();
  db.prepare(`UPDATE queue_items SET status = 'skipped' WHERE session_id = ? AND status = 'playing'`).run(sessionId);
  return markPlaying(sessionId);
}

export function getNowPlaying(sessionId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM queue_items WHERE session_id = ? AND status = 'playing' LIMIT 1`).get(sessionId) || null;
}

function reorderPositions(sessionId) {
  const db = getDb();
  const items = db.prepare(`SELECT id FROM queue_items WHERE session_id = ? AND status = 'queued' ORDER BY position ASC`).all(sessionId);
  const update = db.prepare(`UPDATE queue_items SET position = ? WHERE id = ?`);
  const tx = db.transaction(() => items.forEach((item, i) => update.run(i, item.id)));
  tx();
}
