/**
 * YouTube search helper.
 * Uses the official Data API v3 when YOUTUBE_API_KEY is set,
 * otherwise falls back to youtube-sr (keyless scraper).
 */

import { YouTube } from 'youtube-sr';

const DATA_API_BASE = 'https://www.googleapis.com/youtube/v3';

const TOP_N       = 3;   // how many to show after sorting
const CANDIDATES  = 15;  // how many to fetch before sorting by views

export async function searchYouTube(query) {
  const key = process.env.YOUTUBE_API_KEY;
  if (key && key !== 'YOUR_YOUTUBE_API_KEY_HERE') {
    return searchWithApiKey(query, key);
  }
  return searchWithScraper(query);
}

// ── Official Data API v3 ────────────────────────────────────────────────────
async function searchWithApiKey(query, key) {
  // Step 1: search for candidates
  const searchParams = new URLSearchParams({
    part:       'snippet',
    q:          `${query} karaoke`,
    type:       'video',
    maxResults: String(CANDIDATES),
    safeSearch: 'none',
    key,
  });

  const searchResp = await fetch(`${DATA_API_BASE}/search?${searchParams}`);
  if (!searchResp.ok) {
    const err = await searchResp.json().catch(() => ({}));
    throw new Error(`YouTube API error ${searchResp.status}: ${err.error?.message || searchResp.statusText}`);
  }
  const searchData = await searchResp.json();
  const items = searchData.items || [];
  if (!items.length) return [];

  // Step 2: fetch view counts in one batch
  const ids = items.map(i => i.id.videoId).join(',');
  const statsParams = new URLSearchParams({ part: 'statistics', id: ids, key });
  const statsResp = await fetch(`${DATA_API_BASE}/videos?${statsParams}`);
  const statsData  = statsResp.ok ? await statsResp.json() : { items: [] };
  const viewMap = Object.fromEntries(
    (statsData.items || []).map(v => [v.id, parseInt(v.statistics?.viewCount || '0', 10)])
  );

  // Step 3: keep only results whose raw title mentions karaoke, sort by views, return top N
  return items
    .filter(item => /karaoke/i.test(item.snippet.title))
    .map(item => ({
      songId:     `yt-${item.id.videoId}`,
      source:     'youtube',
      youtubeId:  item.id.videoId,
      songTitle:  cleanTitle(item.snippet.title),
      artistName: item.snippet.channelTitle,
      thumbnail:  item.snippet.thumbnails?.medium?.url || null,
      views:      viewMap[item.id.videoId] ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_N);
}

// ── Keyless scraper via youtube-sr ─────────────────────────────────────────
async function searchWithScraper(query) {
  const results = await YouTube.search(`${query} karaoke`, {
    limit: CANDIDATES,
    type:  'video',
  });

  return results
    .filter(v => /karaoke/i.test(v.title || ''))
    .map(v => ({
      songId:     `yt-${v.id}`,
      source:     'youtube',
      youtubeId:  v.id,
      songTitle:  cleanTitle(v.title || ''),
      artistName: v.channel?.name || '',
      thumbnail:  v.thumbnail?.url || null,
      views:      v.views ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, TOP_N);
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function cleanTitle(title) {
  return title
    .replace(/\(?\s*(karaoke|instrumental|backing track|no vocals?|sing along)[^)]*\)?/gi, '')
    .replace(/\s*[-|–]\s*$/, '')
    .trim();
}

