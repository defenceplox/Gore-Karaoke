# Karaoke — Development Checkpoint
_Last updated: 8 March 2026_

## Environment

| Item | Value |
|------|-------|
| OS | Windows 10/11 |
| Node.js | v24.14.0 |
| pnpm | v9.x |
| LAN IP | 192.168.0.55 |
| Dev URLs | https://localhost:3001/display/ · https://localhost:3002/remote/ |
| LAN Mobile URL | https://192.168.0.55:3002/remote/ |

---

## What Works ✅

- **Session create/join** — TV creates a session, gets a 4-digit PIN
- **YouTube search** — searches via youtube-sr (keyless) or YouTube Data API v3
- **Queue** — mobile can add songs via socket, display updates in real time
- **YouTube playback** — video loads and plays on display; muted-autoplay bypass is in place
- **YouTube error handling** — embedding-disabled videos show a toast and auto-skip after 3s
- **Countdown** — 3-2-1-GO before each song
- **NowPlaying banner + QueueBar** — persistent overlays on display
- **HTTPS (LAN)** — mkcert certs generated for localhost + 192.168.0.55; server and Vite both serve HTTPS
- **PeerJS** — auto-enables when certs present, disabled when HTTP-only
- **Phone mic WebRTC** — phone connects, stream routes to display Web Audio mixer
- **Web Audio mixer** — compressor + synthetic reverb; `addMic` resumes AudioContext on stream arrival
- **CA cert endpoint** — `GET /rootCA.pem` served from server for easy Android installation
- **Windows firewall** — ports 3000, 3001, 3002 open for inbound TCP

---

## Known Issues / Still To Test 🔲

- [ ] Phone mic audio actually audible on display (mixer fixes applied, needs live test)
- [ ] CDG+MP3 upload and playback (untested on Windows)
- [ ] PWA install on Android (icons missing — see below)
- [ ] Song end → auto-advance to next song (wired but untested E2E)
- [ ] Queue vote / reorder (wired but untested)
- [ ] Firefox not supported by mkcert on Windows (Chrome/Edge only)

---

## Remaining TODOs

### Quick wins
- [ ] PWA icons — create `client/mobile/public/icons/icon-192.png` + `icon-512.png`
- [ ] Drag-to-reorder in QueuePage (mobile, pointer events)

### Features
- [ ] Upload tab on mobile (links to `POST /api/upload` — server route exists)
- [ ] Mic volume slider per channel on display overlay
- [ ] Reverb toggle button on display
- [ ] Error boundary components
- [ ] Dark/light mode toggle (mobile)

### Deployment
- [ ] Document ngrok usage for cross-network phone mic testing
- [ ] Production build script + instructions

---

## Windows-Specific Fixes Applied This Session

### pnpm install (better-sqlite3 native build)
- Installed **Python 3.12** and **Visual Studio Build Tools 2026** separately (not `windows-build-tools` which is broken on modern Node)
- Node-gyp detects VS automatically — no `msvs_version` config needed

### HTTPS / Cert setup
- Installed **mkcert v1.4.4** via winget
- Generated certs: `certs/localhost.pem` + `certs/localhost-key.pem` (valid until 8 June 2028)
- CA cert copied to `certs/rootCA.pem` and served at `GET /rootCA.pem` for Android installation
- Vite configs (`display` + `mobile`) auto-detect certs at startup; fall back to HTTP if absent

### PeerJS conflict fix
- PeerJS `ExpressPeerServer` was intercepting all unmatched routes and returning "Unknown endpoint"
- Fixed by gating it behind `if (hasCerts)` — PeerJS requires HTTPS anyway (WebRTC browser constraint)

### Vite proxy
- Both Vite configs use `https://localhost:3000` with `secure: false` when certs exist
- `https` import and custom `devAgent` removed — `secure: false` is sufficient for self-signed certs

### Cert path resolution
- `.env` uses relative paths (`../certs/...`) which resolve against `process.cwd()`
- Server now resolves them against `__dirname` (i.e. `server/src/`) → `server/` → `karaoke2/certs/` ✓

### SearchPage socket fix
- `SearchPage` was using REST `POST /api/queue` which doesn't emit a socket event
- Switched to `emit('queue:add', ...)` so the display receives `queue:update` in real time

### YouTube autoplay fix
- Start player muted (`mute: 1` playerVar) to bypass browser autoplay block
- `onReady` → `playVideo()` + unmute after 100ms
- `CUED` state handler for subsequent songs on an existing player instance

### Web Audio mixer fixes
- `addMic` now calls `context.resume()` — context was suspended, mics were connected but silent
- Removed dead `createChannelSplitter` code
- Fixed `gain.connect(reverbNode || dryGain)` fallback that was double-connecting to dryGain
- `loadReverb` retroactively connects mics that arrived before reverb IR finished loading

---

## Starting Dev Server

```powershell
# From project root
pnpm dev
```

Servers:
- `[0]` server → https://localhost:3000
- `[1]` display → https://localhost:3001/display/
- `[2]` mobile  → https://localhost:3002/remote/

If port 3000 is already in use:
```powershell
Stop-Process -Name node -Force
pnpm dev
```

## Android CA Cert Installation

1. On the phone, open Chrome and visit `http://192.168.0.55:3000/rootCA.pem`
2. Download and install as a CA certificate (Settings → Security → Install certificate)
3. Visit `https://192.168.0.55:3002/remote/` — no warnings

CA cert lives at: `C:\Users\defen\AppData\Local\mkcert\rootCA.pem`
