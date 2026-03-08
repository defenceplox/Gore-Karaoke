import express from 'express';
import https from 'https';
import http from 'http';
import { searchYouTube } from '../lib/youtube.js';
import { searchLocalSongs, getAllLocalSongs } from '../lib/songIndex.js';
import { getStreamUrl, evictStreamUrl } from '../lib/ytdlp.js';
import { fetchLyrics } from '../lib/lyrics.js';

const router = express.Router();

// GET /api/songs/search?q=bohemian+rhapsody&source=all|youtube|local
router.get('/search', async (req, res) => {
  const query  = req.query.q?.trim();
  const source = req.query.source || 'all';

  if (!query) return res.status(400).json({ error: 'Missing query parameter "q"' });

  try {
    const results = [];

    if (source === 'all' || source === 'local') {
      const local = searchLocalSongs(query);
      results.push(...local);
    }

    if (source === 'all' || source === 'youtube') {
      const yt = await searchYouTube(query);
      results.push(...yt);
    }

    res.json({ ok: true, results });
  } catch (err) {
    console.error('Song search error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/songs/local — list all indexed local CDG songs
router.get('/local', (req, res) => {
  res.json({ ok: true, songs: getAllLocalSongs() });
});

// GET /api/songs/lyrics?title=...&artist=...&duration=...
// Returns LRC synced lyrics (or plain text fallback) via LRCLIB.
router.get('/lyrics', async (req, res) => {
  const { title, artist, duration } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  try {
    console.log(`🎵 Lyrics fetch: "${title}" by "${artist || '(no artist)'}"`)
    const result = await fetchLyrics(
      title,
      artist || '',
      duration ? Number(duration) : 0,
    );
    console.log(`🎵 Lyrics result: lrc=${result.lrc ? 'YES ✓' : 'no'} plain=${result.plain ? 'YES ✓' : 'no'}`);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Lyrics fetch error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/songs/ytproxy?videoId=xxx
// Proxies the yt-dlp audio stream through this server so the browser
// never hits YouTube CDN directly (avoids CORS + 403 from User-Agent checks).
// Supports Range requests so the <audio> element can seek.
router.get('/ytproxy', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  let streamUrl;
  try {
    console.log(`⬇️  yt-dlp resolving stream for ${videoId}…`);
    streamUrl = await getStreamUrl(videoId);
    console.log(`✅ yt-dlp stream resolved for ${videoId}`);
  } catch (err) {
    console.error(`yt-dlp error for ${videoId}:`, err.message);
    evictStreamUrl(videoId);
    return res.status(500).json({ error: `yt-dlp failed: ${err.message}` });
  }

  const parsed = new URL(streamUrl);
  const transport = parsed.protocol === 'https:' ? https : http;

  const proxyReq = transport.get(
    streamUrl,
    {
      headers: {
        // Forward Range header so the audio element can seek
        ...(req.headers.range ? { Range: req.headers.range } : {}),
        // Mimic a browser so YouTube CDN doesn't 403
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive',
      },
    },
    (upstream) => {
      // If YouTube invalidated the URL, evict cache and return 502
      if (upstream.statusCode === 403 || upstream.statusCode === 410) {
        evictStreamUrl(videoId);
        return res.status(502).json({ error: 'Stream URL expired — retry' });
      }

      // Pass status + selected headers back to the browser
      const forward = ['content-type', 'content-length', 'content-range',
                       'accept-ranges', 'cache-control'];
      res.status(upstream.statusCode);
      for (const h of forward) {
        if (upstream.headers[h]) res.setHeader(h, upstream.headers[h]);
      }
      // Ensure browser treats this as audio, not a download
      if (!res.getHeader('content-type')) res.setHeader('content-type', 'audio/mp4');

      upstream.pipe(res);
      req.on('close', () => upstream.destroy());
    },
  );

  proxyReq.on('error', (err) => {
    console.error('Proxy stream error:', err.message);
    if (!res.headersSent) res.status(502).json({ error: 'Stream proxy error' });
  });
});

export default router;
