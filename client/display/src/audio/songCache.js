/**
 * Song caching helpers — communicate with the service worker
 * to pre-cache upcoming queue songs and evict finished ones.
 */

function getSW() {
  return navigator.serviceWorker?.controller ?? null;
}

/** Pre-cache the next N songs in the queue (CDG source only) */
export function preCacheQueue(queue, lookAhead = 3) {
  const sw = getSW();
  if (!sw) return;

  const cdgSongs = queue
    .filter(item => item.source === 'cdg' && item.mp3_url)
    .slice(0, lookAhead);

  for (const song of cdgSongs) {
    sw.postMessage({
      type:   'CACHE_SONG',
      mp3Url: song.mp3_url,
      cdgUrl: song.cdg_url,
    });
  }
}

/** Remove a song from the cache after it finishes playing */
export function evictSong(song) {
  const sw = getSW();
  if (!sw || song.source !== 'cdg') return;
  sw.postMessage({
    type:   'EVICT_SONG',
    mp3Url: song.mp3_url,
    cdgUrl: song.cdg_url,
  });
}

/** Flush all cached audio at end of session */
export function clearSessionCache() {
  getSW()?.postMessage({ type: 'CLEAR_SESSION_CACHE' });
}
