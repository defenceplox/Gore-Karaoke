# Karaoke Project — Progress Backup
_Last updated: 8 March 2026_

---

## ? Completed

### Scaffold & Config
- [x] Root `package.json` with pnpm workspaces (`server/`, `client/display/`, `client/mobile/`)
- [x] `pnpm-workspace.yaml`, `.gitignore`, `.env`
- [x] mkcert certs for `localhost` + `192.168.0.55`
- [x] Firewall ports 3000/3001/3002 open for LAN access

### Windows Dev Environment
- [x] Node.js v24.14.0, pnpm v9
- [x] Python 3.12 + VS Build Tools 2026 (for better-sqlite3 native addon)
- [x] yt-dlp v2026.03.03 (winget)

### Server (`server/`)
- [x] Express + HTTPS + Socket.io + PeerJS (port 3000)
- [x] `/rootCA.pem` endpoint for Android CA install
- [x] SQLite DB — sessions, queue_items, votes tables
- [x] All socket events: `session:join`, `queue:*`, `playback:*`, `mic:*`, `lyrics:offset`
- [x] REST: `/api/sessions`, `/api/songs/search`, `/api/songs/ytproxy`, `/api/songs/lyrics`, `/api/songs/local`
- [x] CDG+MP3 upload (multer, session-scoped)
- [x] YouTube search — Data API v3 + youtube-sr scraper fallback
      Fetches 15 candidates, filters to karaoke-titled only, sorts by view count, top 3
- [x] `lib/ytdlp.js` — yt-dlp wrapper, 90-min cache, Windows path fallback
- [x] `lib/lyrics.js` — LRCLIB: cleanArtist() strips karaoke channels,
      3-strategy fallback (exact ? search+artist ? title-only), 24h cache
- [x] `lib/songIndex.js`, `lib/cleanup.js`

### Display Client (`client/display/`)
- [x] `CDGPlayer.jsx` — CDG+MP3 via cdgraphics canvas
- [x] `YouTubePlayer.jsx` — muted autoplay, explicit playVideo(), unmute, error 101/150 handler
- [x] `YTFallbackPlayer.jsx` — audio proxy player, loading/error states, Web Audio connection
- [x] `StageVisualizer.jsx` — animated canvas: gradient bg, spotlight beams, particles, frequency bars
- [x] `LyricsOverlay.jsx` — UltraStar + LRC parsers, per-line highlight, vertically centered
- [x] `MicControls.jsx` — collapsible panel: per-channel volume sliders (0-150%), reverb slider + toggle
- [x] `MicManager.jsx` — physical getUserMedia mic + PeerJS phone mic receiver
- [x] `QueueBar.jsx`, `Countdown.jsx`, `NowPlayingBanner.jsx`
- [x] `IdleScreen.jsx` — QR code (LAN IP, correct port + trailing slash), Start Queue button
- [x] `ErrorBoundary.jsx` — full-screen crash recovery, 15s auto-reload countdown
- [x] `DisplayPage.jsx` — full wiring: player switching, yt-dlp fallback, LRCLIB lyrics,
      lyrics offset (keyboard + socket), stage visuals, MicControls panel

### Mobile Client (`client/mobile/`)
- [x] `JoinPage.jsx` — PIN pre-filled from QR scan URL param
- [x] `SearchPage.jsx` — socket queue:add, view count badges, top-3 most-viewed
- [x] `QueuePage.jsx` — drag-to-reorder, vote, remove, skip,
      "Start Queue" button, lyrics "Earlier/Later" nudge buttons
- [x] `MicPage.jsx` — WebRTC phone mic via PeerJS + VU meter
- [x] `UploadPage.jsx` — CDG+MP3 upload
- [x] `ErrorBoundary.jsx` — "Tap to Reload" crash screen
- [x] PWA icons — icon-192.png + icon-512.png present and valid

### Audio (`client/display/src/audio/`)
- [x] `mixer.js` — per-mic gain, reverb with tracked state (getReverbAmount), master gain, compressor
- [x] `songCache.js` — service worker cache priming

---

## ?? Still To Do

### Live Testing Checklist (manual)
- [ ] `pnpm dev` — all three on 3000/3001/3002
- [ ] TV: create session ? QR appears ? phone: scan ? PIN pre-filled ? join
- [ ] Search YouTube ? top-3 karaoke results with view counts
- [ ] Add song ? queue updates live on TV
- [ ] Start playback ? countdown ? YouTube video + audio
- [ ] Embed-blocked video ? yt-dlp fallback ? stage visuals ? lyrics centered
- [ ] Lyrics timing off ? phone "Earlier/Later" buttons adjust in real time
- [ ] Phone mic ? MicPage ? audio on TV ? MicControls panel: adjust volume, toggle reverb
- [ ] Upload CDG+MP3 ? indexes ? plays with CDG graphics
- [ ] Android: open mobile URL ? "Add to Home Screen" PWA prompt

### Optional / Future
- [ ] ngrok for cross-network phone mic testing
- [ ] Dark/light mode toggle on mobile
- [ ] Multiple simultaneous singer queues
