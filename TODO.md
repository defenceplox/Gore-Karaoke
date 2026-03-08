# Karaoke Project — Progress Backup
_Last updated: 8 March 2026_

## ✅ Completed

### Scaffold & Config
- [x] Root `package.json` with pnpm workspaces (`server/`, `client/display/`, `client/mobile/`)
- [x] `pnpm-workspace.yaml`
- [x] `.gitignore`
- [x] `.env` (`CERT_PATH`, `KEY_PATH`, `YOUTUBE_API_KEY` all active)
- [x] `scripts/gen-certs.sh` (mkcert HTTPS for local dev)
- [x] mkcert installed + certs generated for `localhost` + `192.168.0.55`
- [x] Firewall ports 3000/3001/3002 open for LAN access

### Windows Dev Environment
- [x] Node.js v24.14.0
- [x] pnpm v9
- [x] Python 3.12 + VS Build Tools 2026 (for better-sqlite3 native addon)
- [x] yt-dlp v2026.03.03 (winget)
- [x] `pnpm install` succeeds (better-sqlite3 compiles)

### Server (`server/`)
- [x] `package.json` (Express, Socket.io, PeerJS, better-sqlite3, multer, uuid)
- [x] `src/index.js` — HTTPS/HTTP, cert paths resolved from `__dirname`, PeerJS gated behind hasCerts, `/rootCA.pem` CA cert endpoint
- [x] `src/db/database.js` — SQLite init, WAL mode, sessions + queue_items + votes tables
- [x] `src/db/queries.js` — All queue/session CRUD
- [x] `src/socket/handlers.js` — All Socket.io events (session:join, queue:*, playback:*, mic:*)
- [x] `src/routes/sessions.js` — POST /api/sessions, GET /api/sessions/:pin
- [x] `src/routes/songs.js` — GET /api/songs/search, /api/songs/local, /api/songs/ytstream
- [x] `src/routes/queue.js` — Full REST queue API (GET/POST/DELETE/PATCH/vote)
- [x] `src/routes/upload.js` — CDG+MP3 pair upload (multer, session-scoped storage)
- [x] `src/lib/youtube.js` — YouTube Data API v3 + youtube-sr scraper fallback
- [x] `src/lib/songIndex.js` — In-memory CDG song index
- [x] `src/lib/cleanup.js` — Session expiry + file cleanup (runs hourly)
- [x] `src/lib/ytdlp.js` — yt-dlp wrapper: `getStreamUrl(videoId)` with 90-min cache + Windows path fallback

### Display Client (`client/display/`)
- [x] `package.json` (React 19, Vite, cdgraphics, socket.io-client, peerjs)
- [x] `vite.config.js` — HTTPS with cert auto-detect, proxy to server
- [x] `index.html` — `@keyframes spin` defined globally
- [x] `src/main.jsx`
- [x] `src/App.jsx` — Session create/join screen, PIN URL routing, defensive error coercion
- [x] `src/theme.js`
- [x] `src/hooks/useSocket.js` — Shared socket singleton with session:join
- [x] `src/audio/mixer.js` — Web Audio mixer: context.resume() on addMic, correct reverb routing
- [x] `src/audio/songCache.js` — Service worker cache priming for next queue songs
- [x] `src/sw.js` — Service worker (vite-plugin-pwa injectManifest)
- [x] `src/components/CDGPlayer.jsx` — CDG+MP3 playback via cdgraphics → canvas
- [x] `src/components/YouTubePlayer.jsx` — IFrame API: muted autoplay, explicit playVideo(), unmute after 100ms, onError for codes 101/150
- [x] `src/components/YTFallbackPlayer.jsx` — yt-dlp audio fallback: fetch stream URL, play via `<audio>`, onError callback
- [x] `src/components/LyricsOverlay.jsx` — UltraStar .txt parser + animated syllable highlight
- [x] `src/components/QueueBar.jsx` — Bottom scrolling upcoming queue bar
- [x] `src/components/Countdown.jsx` — 3-2-1-GO countdown before song starts
- [x] `src/components/NowPlayingBanner.jsx` — Top banner with song title + singer
- [x] `src/components/MicManager.jsx` — Physical mic + PeerJS phone mic receiver
- [x] `src/pages/DisplayPage.jsx` — Full wiring: CDG/YouTube/YTFallback players, ytFallback state, handleYTError → fallback → auto-skip

### Mobile Client (`client/mobile/`)
- [x] `package.json` (React 19, Vite, vite-plugin-pwa, socket.io-client, peerjs)
- [x] `vite.config.js` — HTTPS with cert auto-detect, PWA manifest, proxy to server
- [x] `index.html` — `@keyframes spin` defined globally, mobile meta tags
- [x] `src/main.jsx`
- [x] `src/App.jsx` — Tab shell (Search/Queue/Mic/Upload), header, session restore
- [x] `src/theme.js`
- [x] `src/hooks/useSocket.js` — Socket with queue/nowPlaying state
- [x] `src/components/TabBar.jsx` — Bottom tab bar with queue count badge
- [x] `src/pages/JoinPage.jsx` — PIN + name entry
- [x] `src/pages/SearchPage.jsx` — Song search → `emit('queue:add')` via socket
- [x] `src/pages/QueuePage.jsx` — Live queue, vote, remove, skip
- [x] `src/pages/MicPage.jsx` — WebRTC phone mic via PeerJS + VU meter + lyrics progress
- [x] `src/pages/UploadPage.jsx` — CDG+MP3 pair upload form

---

## 🔲 Still To Do

### PWA Icons
- [ ] Create `client/mobile/public/icons/icon-192.png` and `icon-512.png`
  (PWA install prompt won't show without these)

### Polish / Nice-to-haves
- [ ] QR code on TV idle screen pointing to `/remote/<pin>` (use `qrcode.react`)
- [ ] Drag-to-reorder in QueuePage (mobile) using pointer events
- [ ] Mic volume slider per-channel on display
- [ ] Reverb toggle button on display
- [ ] Error boundary components
- [ ] Dark/light mode toggle (mobile)

### Live Testing Checklist
- [ ] `pnpm dev` — all three processes start cleanly
- [ ] Create session on TV, join from phone
- [ ] Search YouTube song → appears in queue on TV
- [ ] Start playback → countdown → video plays with audio
- [ ] Trigger embed-blocked video → yt-dlp fallback kicks in, audio plays
- [ ] Upload CDG+MP3 pair → indexes → plays on TV
- [ ] Phone mic → audio heard through TV speakers

### Deployment (optional)
- [ ] `scripts/gen-certs.sh` — run to generate LAN HTTPS certs
- [ ] Document ngrok usage for cross-network phone mic testing

---

## File Tree Summary

```
karaoke/
├── .env
├── .gitignore
├── package.json
├── pnpm-workspace.yaml
├── TODO.md
├── scripts/
│   └── gen-certs.sh
├── server/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── db/
│       │   ├── database.js
│       │   └── queries.js
│       ├── lib/
│       │   ├── cleanup.js
│       │   ├── songIndex.js
│       │   └── youtube.js
│       ├── routes/
│       │   ├── queue.js
│       │   ├── sessions.js
│       │   ├── songs.js
│       │   └── upload.js
│       └── socket/
│           └── handlers.js
├── client/
│   ├── display/
│   │   ├── index.html
│   │   ├── package.json
│   │   ├── vite.config.js
│   │   └── src/
│   │       ├── App.jsx
│   │       ├── main.jsx
│   │       ├── theme.js
│   │       ├── audio/mixer.js
│   │       ├── components/
│   │       │   ├── CDGPlayer.jsx
│   │       │   ├── Countdown.jsx
│   │       │   ├── LyricsOverlay.jsx
│   │       │   ├── MicManager.jsx
│   │       │   ├── NowPlayingBanner.jsx
│   │       │   ├── QueueBar.jsx
│   │       │   └── YouTubePlayer.jsx
│   │       ├── hooks/useSocket.js
│   │       └── pages/DisplayPage.jsx
│   └── mobile/
│       ├── index.html
│       ├── package.json
│       ├── vite.config.js
│       └── src/
│           ├── App.jsx
│           ├── main.jsx
│           ├── theme.js
│           ├── components/TabBar.jsx
│           ├── hooks/useSocket.js
│           └── pages/
│               ├── JoinPage.jsx
│               ├── MicPage.jsx
│               ├── QueuePage.jsx
│               └── SearchPage.jsx
```
