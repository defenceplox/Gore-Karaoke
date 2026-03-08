/**
 * Lyrics fetcher — uses LRCLIB (https://lrclib.net)
 * Free, no API key, returns LRC format with line-level timestamps.
 */

// Simple in-memory cache: `${title}::${artist}` → { lrc, plain, expires }
const cache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Karaoke channel names that should never be used as the real artist
const KARAOKE_CHANNEL_RE = /karaoke|sing king|backing|instrumental|cdg|midi|no vocal|charttraxx|zoom|stingray/i;

/**
 * Clean a YouTube channel/artist name before using it as an LRCLIB query.
 * Returns null if it looks like a karaoke channel (try title-only search instead).
 */
function cleanArtist(artist) {
  if (!artist || KARAOKE_CHANNEL_RE.test(artist)) return null;
  return artist.trim();
}

/**
 * Fetch synced (LRC) lyrics for a song.
 * Returns { lrc: string|null, plain: string|null }
 */
export async function fetchLyrics(title, artist, durationSecs = 0) {
  const cleanedArtist = cleanArtist(artist);
  const cacheKey = `${title.toLowerCase()}::${(cleanedArtist || '').toLowerCase()}`;

  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expires) {
    return { lrc: cached.lrc, plain: cached.plain };
  }

  let result = null;

  // Strategy 1: exact lookup with real artist + duration
  if (cleanedArtist && durationSecs > 0) {
    result = await tryGet(title, cleanedArtist, durationSecs);
  }

  // Strategy 2: search with real artist
  if (!result?.lrc && cleanedArtist) {
    result = await trySearch(title, cleanedArtist);
  }

  // Strategy 3: search title-only (artist was a karaoke channel or above failed)
  if (!result?.lrc) {
    result = await trySearch(title, '');
  }

  const final = result || { lrc: null, plain: null };
  cache.set(cacheKey, { ...final, expires: Date.now() + CACHE_TTL });
  return final;
}

async function tryGet(title, artist, durationSecs) {
  try { return await lrclibGet(title, artist, durationSecs); } catch { return null; }
}

async function trySearch(title, artist) {
  try { return await lrclibSearch(title, artist); } catch { return null; }
}

async function lrclibGet(title, artist, durationSecs) {
  const params = new URLSearchParams({
    track_name:  title,
    artist_name: artist,
    duration:    Math.round(durationSecs),
  });
  const resp = await fetch(`https://lrclib.net/api/get?${params}`, {
    headers: { 'Lrclib-Client': 'karaoke-app (https://github.com/local)' },
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  return {
    lrc:   data.syncedLyrics  || null,
    plain: data.plainLyrics   || null,
  };
}

async function lrclibSearch(title, artist) {
  const q = [title, artist].filter(Boolean).join(' ').trim();
  const params = new URLSearchParams({ q });
  const resp = await fetch(`https://lrclib.net/api/search?${params}`, {
    headers: { 'Lrclib-Client': 'karaoke-app (https://github.com/local)' },
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) return null;
  const items = await resp.json();
  if (!items?.length) return null;

  // Prefer items with synced lyrics
  const synced = items.find(i => i.syncedLyrics);
  const best   = synced || items[0];
  return {
    lrc:   best.syncedLyrics || null,
    plain: best.plainLyrics  || null,
  };
}
