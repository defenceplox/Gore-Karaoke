/**
 * YouTube search helper.
 * Uses the official Data API v3 when YOUTUBE_API_KEY is set,
 * otherwise falls back to youtube-sr (keyless scraper).
 */

import { YouTube } from 'youtube-sr';

const DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';

export async function searchYouTube(query, maxResults = 12) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key && key !== 'YOUR_YOUTUBE_API_KEY_HERE') {
    return searchWithApiKey(query, maxResults, key);
  }
  return searchWithScraper(query, maxResults);
}

// ── Official Data API v3 ────────────────────────────────────────────────────
async function searchWithApiKey(query, maxResults, key) {
  const params = new URLSearchParams({
    part:        'snippet',
    q:           `${query} karaoke`,
    type:        'video',
    maxResults:  String(maxResults),
    safeSearch:  'none',
    videoCategoryId: '10',
    key,
  });

  const resp = await fetch(`${DATA_API_BASE}/search?${params}`);
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
  }));
}

// ── Keyless scraper via youtube-sr ─────────────────────────────────────────
async function searchWithScraper(query, maxResults) {
  const results = await YouTube.search(`${query} karaoke`, {
    limit: maxResults,
    type:  'video',
  });

  return results.map(v => ({
    songId:     `yt-${v.id}`,
    source:     'youtube',
    youtubeId:  v.id,
    songTitle:  cleanTitle(v.title || ''),
    artistName: v.channel?.name || '',
    thumbnail:  v.thumbnail?.url || null,
  }));
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function cleanTitle(title) {
  return title
    .replace(/\(?\s*(karaoke|instrumental|backing track|no vocals?|sing along)[^)]*\)?/gi, '')
    .replace(/\s*[-|–]\s*$/, '')
    .trim();
}

