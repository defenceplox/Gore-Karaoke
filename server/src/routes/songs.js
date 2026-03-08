import express from 'express';
import { searchYouTube } from '../lib/youtube.js';
import { searchLocalSongs, getAllLocalSongs } from '../lib/songIndex.js';
import { getStreamUrl, evictStreamUrl } from '../lib/ytdlp.js';

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

// GET /api/songs/ytstream?videoId=xxx
// Returns a direct audio stream URL via yt-dlp — used as fallback when
// YouTube IFrame API reports embedding disabled (error 101/150).
router.get('/ytstream', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  try {
    console.log(`⬇️  yt-dlp resolving stream for ${videoId}…`);
    const url = await getStreamUrl(videoId);
    console.log(`✅ yt-dlp stream resolved for ${videoId}`);
    res.json({ ok: true, url });
  } catch (err) {
    console.error(`yt-dlp error for ${videoId}:`, err.message);
    evictStreamUrl(videoId); // don't cache failed lookups
    res.status(500).json({ error: `yt-dlp failed: ${err.message}` });
  }
});

export default router;
