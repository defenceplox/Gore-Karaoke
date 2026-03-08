# Karaoke Project — Progress Backup
_Last updated: 7 March 2026_

## ✅ Completed

### Scaffold & Config
- [x] Root `package.json` with pnpm workspaces (`server/`, `client/display/`, `client/mobile/`)
- [x] `pnpm-workspace.yaml`
- [x] `.gitignore`
- [x] `.env` (with placeholder for YOUTUBE_API_KEY)
- [x] `scripts/gen-certs.sh` (mkcert HTTPS for local dev)

### Server (`server/`)
- [x] `package.json` (Express, Socket.io, PeerJS, better-sqlite3, multer, uuid)
- [x] `src/index.js` — Express app, HTTPS/HTTP server, Socket.io, PeerJS, static serving
- [x] `src/db/database.js` — SQLite init, sessions + queue_items + votes tables
- [x] `src/db/queries.js` — All queue/session CRUD (createSession, getQueue, addToQueue, removeFromQueue, reorderQueue, voteForItem, markPlaying, skipCurrent, getNowPlaying)
- [x] `src/socket/handlers.js` — All Socket.io events (session:join, queue:*, playback:*, mic:*)
- [x] `src/routes/sessions.js` — POST /api/sessions, GET /api/sessions/:pin
- [x] `src/routes/songs.js` — GET /api/songs/search, GET /api/songs/local
- [x] `src/routes/queue.js` — Full REST queue API (GET/POST/DELETE/PATCH/vote)
- [x] `src/routes/upload.js` — CDG+MP3 pair upload (multer, session-scoped storage)
- [x] `src/lib/youtube.js` — YouTube Data API v3 search helper
- [x] `src/lib/songIndex.js` — In-memory CDG song index (parse filenames, search, indexUploadedFiles)
- [x] `src/lib/cleanup.js` — Session expiry + file cleanup (runs hourly)

### Display Client (`client/display/`)
- [x] `package.json` (React 19, Vite, cdgraphics, socket.io-client, peerjs)
- [x] `vite.config.js` (base `/display/`, proxy to server)
- [x] `index.html`
- [x] `src/main.jsx`
- [x] `src/App.jsx` — Session create/join screen, PIN URL routing
- [x] `src/theme.js`
- [x] `src/hooks/useSocket.js` — Shared socket singleton with session:join
- [x] `src/audio/mixer.js` — Web Audio API mixer (mic channels, reverb, compressor, gain)
- [x] `src/components/CDGPlayer.jsx` — CDG+MP3 playback via cdgraphics → canvas
- [x] `src/components/YouTubePlayer.jsx` — YouTube IFrame API wrapper with time ticks
- [x] `src/components/LyricsOverlay.jsx` — UltraStar .txt parser + animated syllable highlight
- [x] `src/components/QueueBar.jsx` — Bottom scrolling upcoming queue bar
- [x] `src/components/Countdown.jsx` — 3-2-1-GO countdown before song starts
- [x] `src/components/NowPlayingBanner.jsx` — Top banner with song title + singer
- [x] `src/components/MicManager.jsx` — Physical mic + PeerJS phone mic receiver
- [x] `src/pages/DisplayPage.jsx` — Main TV display page (wires all components together)

### Mobile Client (`client/mobile/`)
- [x] `package.json` (React 19, Vite, vite-plugin-pwa, socket.io-client, peerjs)
- [x] `vite.config.js` (base `/remote/`, PWA manifest, proxy to server)
- [x] `index.html` (mobile meta tags)
- [x] `src/main.jsx`
- [x] `src/App.jsx` — Tab shell (Search/Queue/Mic), header, session restore
- [x] `src/theme.js`
- [x] `src/hooks/useSocket.js` — Socket with queue/nowPlaying state
- [x] `src/components/TabBar.jsx` — Bottom tab bar with queue count badge
- [x] `src/pages/JoinPage.jsx` — PIN + name entry
- [x] `src/pages/SearchPage.jsx` — Song search → add to queue
- [x] `src/pages/QueuePage.jsx` — Live queue, vote, remove, skip
- [x] `src/pages/MicPage.jsx` — WebRTC phone mic via PeerJS + VU meter + lyrics progress

---

## 🔲 Still To Do

### Dependencies
- [ ] Fix `peer` package version in `server/package.json` — correct version is `^1.0.2` not `^9.0.1`
- [ ] Run `pnpm install` at root to install all workspace dependencies

### Service Worker / Caching (Display)
- [ ] Create `client/display/src/sw.js` — Workbox service worker with `RangeRequestsPlugin` for audio caching
- [ ] Register service worker in `client/display/src/main.jsx`
- [ ] Add cache-priming logic in `DisplayPage.jsx` (pre-cache next 2 songs in queue)

### PWA Icons
- [ ] Create placeholder `client/mobile/public/icons/icon-192.png` and `icon-512.png`
  (can be generated with a simple canvas script or replaced with real assets)

### Upload UI (Mobile)
- [ ] Add an "Upload" tab or section in the mobile client for CDG+MP3 pair upload
  (links to `POST /api/upload`)

### QR Code
- [ ] Display a QR code on the TV idle screen pointing to `/remote/<pin>`
  (use `qrcode` npm package or `qrcode.react`)

### Polish / Nice-to-haves
- [ ] Drag-to-reorder in QueuePage (mobile) using pointer events
- [ ] Mic volume slider per-channel on display (MicManager UI overlay)
- [ ] Reverb toggle button on display
- [ ] Song end auto-advance (currently wired, needs E2E test)
- [ ] Error boundary components
- [ ] Dark/light mode toggle (mobile)

### Testing
- [ ] `pnpm install` + `pnpm dev` smoke test — verify server starts
- [ ] Create a session via `POST /api/sessions`, check PIN returned
- [ ] Add a YouTube song, verify it appears on display queue bar
- [ ] Upload a CDG+MP3 pair, verify it indexes and plays
- [ ] Phone mic → TV audio path test (need HTTPS certs first)

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
