/**
 * yt-dlp helper
 * Extracts a direct audio stream URL from a YouTube video ID.
 * Used as fallback when the YouTube IFrame API reports embedding disabled (error 101/150).
 *
 * Stream URLs expire after a few hours (YouTube CDN tokens) — fetch fresh per session/song.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

// yt-dlp binary — try PATH first, fall back to known winget install location
const YTDLP_BIN = process.platform === 'win32'
  ? 'yt-dlp.exe'
  : 'yt-dlp';

// Simple in-memory cache: videoId → { url, expires }
const cache = new Map();
const CACHE_TTL_MS = 90 * 60 * 1000; // 90 minutes (stream URLs last ~6h but be conservative)

/**
 * Returns a direct audio stream URL for the given YouTube video ID.
 * Throws if yt-dlp is not installed or the video is unavailable.
 */
export async function getStreamUrl(videoId) {
  const cached = cache.get(videoId);
  if (cached && Date.now() < cached.expires) {
    return cached.url;
  }

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // -f: prefer m4a audio-only, fall back to best audio, then best overall
  // --get-url: print the direct URL and exit (no download)
  // --no-playlist: never process playlists
  // --quiet: suppress progress output
  const args = [
    '-f', 'bestaudio[ext=m4a]/bestaudio/best',
    '--get-url',
    '--no-playlist',
    '--quiet',
    '--no-warnings',
    ytUrl,
  ];

  let url;
  try {
    const { stdout } = await execFileAsync(YTDLP_BIN, args, { timeout: 20000 });
    url = stdout.trim().split('\n')[0]; // take first URL if multiple formats returned
  } catch (err) {
    // If PATH lookup failed, try the known winget install path on Windows
    if (process.platform === 'win32' && err.code === 'ENOENT') {
      const fallbackBin = 'C:\\Users\\' + (process.env.USERNAME || 'defen') +
        '\\AppData\\Local\\Microsoft\\WinGet\\Packages\\yt-dlp.yt-dlp_Microsoft.WinGet.Source_8wekyb3d8bbwe\\yt-dlp.exe';
      const { stdout } = await execFileAsync(fallbackBin, args, { timeout: 20000 });
      url = stdout.trim().split('\n')[0];
    } else {
      throw err;
    }
  }

  if (!url || !url.startsWith('http')) {
    throw new Error(`yt-dlp returned no usable URL for ${videoId}`);
  }

  cache.set(videoId, { url, expires: Date.now() + CACHE_TTL_MS });
  return url;
}

/** Evict a cached entry (e.g. after playback error) */
export function evictStreamUrl(videoId) {
  cache.delete(videoId);
}
