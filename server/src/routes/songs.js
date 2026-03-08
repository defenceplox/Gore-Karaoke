import express from 'express';
import { searchYouTube } from '../lib/youtube.js';
import { searchLocalSongs, getAllLocalSongs } from '../lib/songIndex.js';

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
      if (!process.env.YOUTUBE_API_KEY || process.env.YOUTUBE_API_KEY === 'YOUR_YOUTUBE_API_KEY_HERE') {
        if (source === 'youtube') {
          return res.status(503).json({ error: 'YouTube API key not configured' });
        }
        // Silently skip YouTube if key not set when source=all
      } else {
        const yt = await searchYouTube(query);
        results.push(...yt);
      }
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

export default router;
