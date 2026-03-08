import fs from 'fs';
import path from 'path';

/**
 * In-memory index of locally uploaded CDG+MP3 song pairs.
 * Key: sessionId → array of song objects
 */
const index = new Map();

/**
 * Parse artist & title from a filename.
 * Supports common formats:
 *   "Artist - Title.mp3"
 *   "Title (Artist).mp3"
 *   "01 Artist - Title.mp3"
 */
export function parseFilename(filename) {
  const base = path.basename(filename, path.extname(filename))
    .replace(/^\d+[\s._-]+/, '') // strip leading track numbers
    .trim();

  const dashMatch = base.match(/^(.+?)\s+-\s+(.+)$/);
  if (dashMatch) {
    return { artistName: dashMatch[1].trim(), songTitle: dashMatch[2].trim() };
  }

  const parenMatch = base.match(/^(.+?)\s+\(([^)]+)\)$/);
  if (parenMatch) {
    return { songTitle: parenMatch[1].trim(), artistName: parenMatch[2].trim() };
  }

  return { artistName: 'Unknown Artist', songTitle: base };
}

/**
 * Index uploaded files for a session.
 * Pairs .mp3 files with same-named .cdg files.
 * Returns array of song objects.
 */
export function indexUploadedFiles(sessionId, dir, filenames) {
  const existing = index.get(sessionId) || [];

  const mp3Files = filenames.filter(f => f.toLowerCase().endsWith('.mp3'));
  const newSongs = [];

  for (const mp3 of mp3Files) {
    const base  = mp3.replace(/\.mp3$/i, '');
    const cdgFile = base + '.cdg';
    const cdgPath = path.join(dir, cdgFile);
    const hasCdg  = fs.existsSync(cdgPath);

    const { artistName, songTitle } = parseFilename(mp3);
    const songId = `cdg-${sessionId}-${base}`;

    const song = {
      songId,
      source:     'cdg',
      songTitle,
      artistName,
      mp3Url:  `/songs/${sessionId}/${encodeURIComponent(mp3)}`,
      cdgUrl:  hasCdg ? `/songs/${sessionId}/${encodeURIComponent(cdgFile)}` : null,
    };

    // Avoid duplicate entries
    if (!existing.some(s => s.songId === songId)) {
      existing.push(song);
      newSongs.push(song);
    }
  }

  index.set(sessionId, existing);
  return newSongs;
}

/**
 * Full-text search across song title and artist name.
 */
export function searchLocalSongs(query) {
  const q = query.toLowerCase();
  const results = [];

  for (const songs of index.values()) {
    for (const song of songs) {
      if (
        song.songTitle.toLowerCase().includes(q) ||
        song.artistName.toLowerCase().includes(q)
      ) {
        results.push(song);
      }
    }
  }

  // Sort: title matches first
  return results.sort((a, b) => {
    const aTitle = a.songTitle.toLowerCase().includes(q) ? 0 : 1;
    const bTitle = b.songTitle.toLowerCase().includes(q) ? 0 : 1;
    return aTitle - bTitle;
  });
}

export function getAllLocalSongs() {
  const all = [];
  for (const songs of index.values()) all.push(...songs);
  return all;
}

export function clearSessionIndex(sessionId) {
  index.delete(sessionId);
}
