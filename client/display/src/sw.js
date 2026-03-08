/**
 * Service Worker — Karaoke Display Client
 * Uses Workbox to cache song files for the upcoming queue.
 *
 * Key strategy: pre-fetch full MP3/CDG files so the <audio> element's
 * HTTP range requests can be served from cache (via RangeRequestsPlugin).
 */

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute }    from 'workbox-routing';
import { CacheFirst }       from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { RangeRequestsPlugin }     from 'workbox-range-requests';
import { ExpirationPlugin }        from 'workbox-expiration';

// Injected by Workbox build — precaches the app shell
precacheAndRoute(self.__WB_MANIFEST || []);

const AUDIO_CACHE = 'karaoke-audio-v1';

// ── Cache song files (MP3 + CDG) ─────────────────────────────────────────────
// The RangeRequestsPlugin synthesises 206 Partial Content responses from the
// cached full file, which is what <audio> requires for seeking.
registerRoute(
  ({ url }) => url.pathname.startsWith('/songs/'),
  new CacheFirst({
    cacheName: AUDIO_CACHE,
    plugins: [
      // Only cache successful full-file responses (status 200)
      new CacheableResponsePlugin({ statuses: [200] }),
      // Serve range requests (206) from the cached full file
      new RangeRequestsPlugin(),
      // Auto-evict after 2 hours
      new ExpirationPlugin({
        maxAgeSeconds: 2 * 60 * 60,
        maxEntries:    30,
      }),
    ],
  })
);

// ── Manual cache management (called from app) ─────────────────────────────────
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  if (event.data.type === 'CACHE_SONG') {
    const { mp3Url, cdgUrl } = event.data;
    const cache = await caches.open(AUDIO_CACHE);
    const promises = [];
    if (mp3Url) promises.push(cache.add(mp3Url).catch(e => console.warn('Cache mp3 failed:', e)));
    if (cdgUrl) promises.push(cache.add(cdgUrl).catch(e => console.warn('Cache cdg failed:', e)));
    await Promise.all(promises);
    event.source?.postMessage({ type: 'SONG_CACHED', mp3Url, cdgUrl });
  }

  if (event.data.type === 'EVICT_SONG') {
    const { mp3Url, cdgUrl } = event.data;
    const cache = await caches.open(AUDIO_CACHE);
    if (mp3Url) await cache.delete(mp3Url);
    if (cdgUrl) await cache.delete(cdgUrl);
  }

  if (event.data.type === 'CLEAR_SESSION_CACHE') {
    await caches.delete(AUDIO_CACHE);
    event.source?.postMessage({ type: 'SESSION_CACHE_CLEARED' });
  }
});
