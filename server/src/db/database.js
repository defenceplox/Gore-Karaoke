import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/karaoke.db');

let db;

export function getDb() {
  if (!db) throw new Error('Database not initialised — call initDb() first');
  return db;
}

export function initDb() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          TEXT PRIMARY KEY,
      pin         TEXT NOT NULL UNIQUE,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      last_active INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS queue_items (
      id           TEXT PRIMARY KEY,
      session_id   TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      song_id      TEXT NOT NULL,
      song_title   TEXT NOT NULL,
      artist_name  TEXT NOT NULL,
      source       TEXT NOT NULL CHECK(source IN ('youtube','cdg')),
      youtube_id   TEXT,
      mp3_url      TEXT,
      cdg_url      TEXT,
      lyrics_data  TEXT,
      singer_name  TEXT NOT NULL DEFAULT 'Anonymous',
      position     INTEGER NOT NULL DEFAULT 0,
      added_at     INTEGER NOT NULL DEFAULT (unixepoch()),
      status       TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','playing','done','skipped'))
    );

    CREATE INDEX IF NOT EXISTS idx_queue_session
      ON queue_items(session_id, position);

    CREATE TABLE IF NOT EXISTS votes (
      id          TEXT PRIMARY KEY,
      queue_item_id TEXT NOT NULL REFERENCES queue_items(id) ON DELETE CASCADE,
      voter_id    TEXT NOT NULL,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch()),
      UNIQUE(queue_item_id, voter_id)
    );
  `);

  console.log('📦 Database initialised:', DB_PATH);
  return db;
}
