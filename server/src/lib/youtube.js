/**
 * YouTube Data API v3 search helper
 * Searches for karaoke backing tracks using the given query.
 * Costs 100 quota units per call (free tier: 10,000 units/day = 100 searches/day).
 */

const BASE = 'https://www.googleapis.com/youtube/v3';

export async function searchYouTube(query, maxResults = 12) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error('YOUTUBE_API_KEY not set');

  const params = new URLSearchParams({
    part:        'snippet',
    q:           `${query} karaoke`,
    type:        'video',
    maxResults:  String(maxResults),
    safeSearch:  'none',
    videoCategoryId: '10', // Music category
    key,
  });

  const resp = await fetch(`${BASE}/search?${params}`);
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(`YouTube API error ${resp.status}: ${err.error?.message || resp.statusText}`);
  }

  const data = await resp.json();

  return (data.items || []).map(item => ({
    songId:     `yt-${item.id.videoId}`,
    source:     'youtube',
    youtubeId:  item.id.videoId,
    songTitle:  cleanTitle(item.snippet.title),
    artistName: item.snippet.channelTitle,
    thumbnail:  item.snippet.thumbnails?.medium?.url || null,
    publishedAt: item.snippet.publishedAt,
  }));
}

/**
 * Strip common karaoke suffixes from YouTube titles
 * e.g. "Bohemian Rhapsody - Karaoke Version (Instrumental)" → "Bohemian Rhapsody"
 */
function cleanTitle(title) {
  return title
    .replace(/\(?\s*(karaoke|instrumental|backing track|no vocals?|sing along)[^)]*\)?/gi, '')
    .replace(/\s*[-|–]\s*$/, '')
    .trim();
}
