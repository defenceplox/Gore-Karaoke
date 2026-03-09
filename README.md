# 🎤 Gore Karaoke

> *"We should totally just build our own karaoke system., with blackjack, and hookers!"*
> — someone on their third cocktail at Bootleggers

And so it began. What started as a completely reasonable idea floated over drinks at **Bootleggers** evolved into a full-stack, LAN-hosted, WebRTC-powered karaoke machine that runs off a Windows box plugged into the TV. No monthly subscription. No bloated tablet app. No fighting with a DJ for the remote. Just vibes, bad singing, and questionable song choices.

---

## 🍹 The Origin Story

It was a perfectly normal evening at Bootleggers when the conversation inevitably turned to karaoke — specifically, how the existing options were either expensive, clunky, or required an internet connection that would inevitably fail at the worst possible moment (mid-chorus, naturally).

Three cocktails in, the architecture was designed on a napkin. One more round and the feature set had grown to include WebRTC phone mics, YouTube search, CDG graphics support, and a real-time queue with drag-to-reorder. By close, someone had promised reverb sliders.

We are not proud. We are also not sorry.

---

## 🎵 What It Does

A self-hosted karaoke system that runs entirely on your local network:

- **TV (Display)** — The big screen. Shows the video, CDG graphics, lyrics overlay, queue bar, and a stage visualizer when nobody's singing. Scans a QR code to let phones join.
- **Phone (Mobile)** — PWA that guests install from a QR code. Search YouTube for karaoke tracks, add songs to the queue, vote, reorder, and use your phone as a wireless mic.
- **Server** — Express + Socket.io backend running HTTPS locally. Handles sessions, queue management, YouTube search, yt-dlp fallback for embed-blocked videos, LRCLIB lyrics, and CDG+MP3 upload.

---

## 🛠️ Tech Stack

| Layer | What's In It |
|-------|-------------|
| Server | Node.js, Express, HTTPS, Socket.io, PeerJS, SQLite (better-sqlite3), yt-dlp |
| Display | React + Vite, cdgraphics, Web Audio API, Canvas |
| Mobile | React + Vite, PWA, WebRTC (PeerJS) |
| Package mgr | pnpm workspaces |
| Certs | node-forge (auto-generated local CA — no external tools) |

---

## 🚀 Getting Started

### The fast way — just run the launcher

**Windows (PowerShell):**
```powershell
.\launch.ps1
```

**Windows (Command Prompt):**
```bat
launch.bat
```

That's it. The launcher handles everything:

- **Installs Node.js** via winget if missing (native ARM64 build on Snapdragon)
- **Installs Python 3** via winget if missing (needed as a `node-gyp` fallback for `better-sqlite3`)
- **Installs yt-dlp** via winget if missing
- **Installs pnpm** via `npm` if missing
- Detects and warns if you're on ARM64 with an emulated x64 Node (and tells you the exact winget command to fix it)
- Wipes and rebuilds `node_modules` if a stale arch mismatch is detected (e.g. you cloned on an x64 PC and are now running on a Snapdragon)
- Builds the React clients on first run
- Starts the server

> **Requires winget** (Windows App Installer) for automatic dependency installs. It ships with Windows 11 and recent Windows 10 builds. If it's missing, install it from the Microsoft Store and re-run — or install Node.js, Python and yt-dlp manually (see below).

### Manual prerequisites

If you'd rather install things yourself:

| Dependency | Install |
|------------|---------|
| Node.js LTS | https://nodejs.org — pick the **ARM64** installer on Snapdragon |
| Python 3 | https://python.org |
| pnpm | `npm install -g pnpm` |
| yt-dlp | `winget install yt-dlp.yt-dlp` |

Then:
```bash
pnpm install
pnpm build          # builds both React clients
pnpm --filter server start
```

### Dev mode (hot reload)
```bash
pnpm dev
```

---

## 🔒 HTTPS & Certificates

The server auto-generates a local CA and HTTPS cert on boot using `node-forge` — no `mkcert`, no OpenSSL, no admin rights required.

Certs are saved to `certs/` and reused on subsequent runs. They are **automatically regenerated** when:

- Files are missing or corrupt
- The server cert has **expired**
- The cert is within **30 days of expiry** (renewed early)
- The machine's **LAN IP has changed** since the cert was issued (e.g. DHCP gave you a new address, or you moved to a different network) — this would otherwise cause every phone to get a TLS error

When regeneration happens, the server logs a clear reason before proceeding.

### Trusting the cert

**Host browser (first run only):**
Chrome/Edge will show a cert warning. Click *Advanced → Proceed*. To permanently silence it, import `certs/rootCA.pem` into Windows:
- `certmgr.msc → Trusted Root Certification Authorities → Import`
- Or uncomment the block near the bottom of `launch.ps1` — it does this automatically (requires running as Administrator).

**Phones:**
The server logs the exact URL on startup. Open it on the device and install the CA profile:
```
https://<your-lan-ip>:3000/rootCA.pem
```
> If certs were regenerated (you'll see a log message), phones need to re-install `rootCA.pem`.

---

## 🖥️ Running on ARM64 / Snapdragon

Both the Docker and native Windows paths support ARM64.

### Native Windows (Snapdragon X, Surface Pro X, etc.)

The launcher auto-detects the ARM64 host and:
- Requests the native ARM64 Node.js build from winget
- Warns if Node is running under x64 emulation and gives the exact command to switch
- Checks `better-sqlite3`'s compiled `.node` binary against Node's arch and forces a clean reinstall if they don't match

`yt-dlp` has no native ARM64 Windows binary — the x64 build runs fine under Windows ARM64's x64 emulation layer.

### Docker

Uncomment one line in `docker-compose.yml`:
```yaml
platform: linux/arm64
```

Then rebuild from scratch:
```bash
docker compose build --no-cache
docker compose up
```

The Dockerfile uses Docker's `TARGETARCH` build argument to download the correct `yt-dlp` binary (`yt-dlp_linux_aarch64` on ARM64, `yt-dlp_linux` on x86-64). `better-sqlite3` and all other native addons compile against the correct arch automatically inside the container.

To cross-build from an x86-64 machine for deployment on ARM64:
```bash
docker buildx build --platform linux/arm64 -t karaoke:arm64 --load .
```

---

## 🎤 Features

- **YouTube search** — Searches for karaoke versions, filters to karaoke-titled results, sorts by view count, returns the top 3. Keyless scraping with optional YouTube Data API v3 key for better results.
- **yt-dlp fallback** — When YouTube refuses to embed a video (error 101/150), the server proxies the audio through yt-dlp with a 90-minute cache. Stage visualizer plays instead of blank video.
- **CDG+MP3 support** — Upload your own `.cdg` + `.mp3` files. Real CD+Graphics karaoke, rendered on a canvas.
- **Lyrics overlay** — Pulls synced lyrics from LRCLIB. Supports LRC and UltraStar formats. Phone controls let singers nudge timing earlier/later in real time.
- **Phone as mic** — Guests open the Mic tab, tap once, and their phone mic streams over WebRTC (PeerJS) to the display's Web Audio mixer. Per-channel volume sliders and a reverb toggle on the display overlay.
- **Live queue** — Add, vote, reorder (drag-and-drop), skip, remove. Queue bar stays visible on the TV at all times.
- **Session PIN** — TV generates a 4-digit PIN. Phones join by scanning the QR code or entering the PIN manually.
- **PWA** — Mobile client installs to home screen on Android/iOS.
- **Stable on a LAN** — No cloud dependency. Works at a party even when the internet decides to take the night off.

---

## 📁 Project Structure

```
karaoke2/
├── server/          # Express API + Socket.io + PeerJS
│   └── src/
│       ├── routes/  # REST endpoints
│       ├── socket/  # Socket.io event handlers
│       ├── db/      # SQLite schema + queries
│       └── lib/     # certGen, yt-dlp, lyrics, song index, cleanup
├── client/
│   ├── display/     # TV-facing React app
│   └── mobile/      # Phone-facing PWA
├── certs/           # Auto-generated HTTPS certs (gitignored)
├── Dockerfile
├── docker-compose.yml
├── launch.bat       # Windows launcher (auto-installs all deps)
└── launch.ps1       # PowerShell launcher (auto-installs all deps)
```

---

## 🌐 URLs

| Client | URL |
|--------|-----|
| Display (TV) | `https://localhost:3000/display/` |
| Mobile (phones) | `https://<your-lan-ip>:3000/remote/` |
| Server API | `https://localhost:3000/api/` |
| Install phone CA | `https://<your-lan-ip>:3000/rootCA.pem` |

The server prints your exact LAN URLs and the `/rootCA.pem` install link for every detected network interface on startup.

---

## ⚠️ Known Limitations

- **Host browser cert warning** — Accept once on first run, or import the CA cert into Windows as described above.
- **Phone cert install** — Required once per device. Re-install if certs were regenerated.
- **`better-sqlite3` compilation** — If `pnpm install` fails for `better-sqlite3`, the prebuilt binary for your Node version may be missing. The launcher checks for Python and MSVC build tools. On ARM64, you need the **MSVC v143 ARM64 build tools** optional component from Visual Studio Build Tools 2022.
- **WebRTC phone mics** — Require HTTPS. The server falls back to HTTP if cert generation fails (check write permissions on `certs/`). Also require `network_mode: host` in Docker on Linux for full LAN access — Docker Desktop on Windows/Mac uses a bridge that blocks WebRTC.
- **yt-dlp on ARM64 Windows** — No native binary available; runs under x64 emulation. Works fine.

---

## 🍸 Contributing

Pull requests welcome. Especially if you were also at Bootleggers that night and remember promising to "add that feature." You know who you are.

Please don't add a subscription tier.

---

## ☕ Buy Me a Drink

This project was born over cocktails, so it's only fitting.
If it saved you from buying an overpriced karaoke subscription, or just made your party a bit more chaotic, consider returning the favour.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/defenceplox)

---

## 📜 License

GPL — because this was built for fun, at a bar, and should stay that way.

---

*Built with love, pnpm, and an inadvisable number of Long Island Ice Teas. 🎶*


> *"We should totally just build our own karaoke system., with blackjack, and hookers!"*
> — someone on their third cocktail at Bootleggers

And so it began. What started as a completely reasonable idea floated over drinks at **Bootleggers** evolved into a full-stack, LAN-hosted, WebRTC-powered karaoke machine that runs off a Windows box plugged into the TV. No monthly subscription. No bloated tablet app. No fighting with a DJ for the remote. Just vibes, bad singing, and questionable song choices.

---

## 🍹 The Origin Story

It was a perfectly normal evening at Bootleggers when the conversation inevitably turned to karaoke — specifically, how the existing options were either expensive, clunky, or required an internet connection that would inevitably fail at the worst possible moment (mid-chorus, naturally).

Three cocktails in, the architecture was designed on a napkin. One more round and the feature set had grown to include WebRTC phone mics, YouTube search, CDG graphics support, and a real-time queue with drag-to-reorder. By close, someone had promised reverb sliders.

We are not proud. We are also not sorry.

---

## 🎵 What It Does

A self-hosted karaoke system that runs entirely on your local network:

- **TV (Display)** — The big screen. Shows the video, CDG graphics, lyrics overlay, queue bar, and a stage visualizer when nobody's singing. Scans a QR code to let phones join.
- **Phone (Mobile)** — PWA that guests install from a QR code. Search YouTube for karaoke tracks, add songs to the queue, vote, reorder, and even use your phone as a wireless mic (WIP).
- **Server** — Express + Socket.io backend running HTTPS locally. Handles sessions, queue management, YouTube search, yt-dlp fallback for embed-blocked videos, LRCLIB lyrics, and CDG+MP3 upload.

---

## 🛠️ Tech Stack

| Layer | What's In It |
|-------|-------------|
| Server | Node.js, Express, HTTPS, Socket.io, PeerJS, SQLite (better-sqlite3), yt-dlp |
| Display | React + Vite, cdgraphics, Web Audio API, Canvas |
| Mobile | React + Vite, PWA, WebRTC (PeerJS) |
| Package mgr | pnpm workspaces |
| Certs | node-forge (auto-generated local CA — no external tools) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- pnpm v9+
- Python 3.12 + Visual Studio Build Tools (for `better-sqlite3` native addon)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) on your PATH — `winget install yt-dlp.yt-dlp`

> **No cert tool needed.** The server auto-generates a local CA + HTTPS cert on first boot using `node-forge`. No `mkcert`, no OpenSSL, no admin rights on the host.

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd karaoke2

# 2. Install dependencies
pnpm install

# 3. Set up your .env (see .env.example)
copy server\.env.example server\.env
```

**Windows quick-start** (handles everything automatically):
```bat
launch.bat
```
or in PowerShell:
```powershell
.\launch.ps1
```

The launcher checks for Node/pnpm/yt-dlp, installs deps, builds the React clients if needed, and starts the server. Certs are generated on first run — no extra steps.

**Manual start** (dev mode with hot reload):
```bash
pnpm dev
```

### URLs

| Client | URL |
|--------|-----|
| Display (TV) | `https://localhost:3000/display/` |
| Mobile (phones) | `https://<your-lan-ip>:3000/remote/` |
| Server API | `https://localhost:3000/api/` |
| Install phone CA | `https://<your-lan-ip>:3000/rootCA.pem` — open on device, install the cert |

The server logs your exact LAN URLs on startup, including the `/rootCA.pem` install link for each detected network interface.

---

## 🎤 Features

- **YouTube search** — Searches for karaoke versions, filters to karaoke-titled results, sorts by view count, returns the top 3. Keyless scraping with optional YouTube Data API v3 key for better results.
- **yt-dlp fallback** — When YouTube refuses to embed a video (error 101/150), the server proxies the audio through yt-dlp with a 90-minute cache. Stage visualizer plays instead of blank video.
- **CDG+MP3 support** — Upload your own `.cdg` + `.mp3` files. Real CD+Graphics karaoke, rendered on a canvas.
- **Lyrics overlay** — Pulls synced lyrics from LRCLIB. Supports LRC and UltraStar formats. Phone controls let singers nudge timing earlier/later in real time.
- **Phone as mic** — Guests open the Mic tab, tap once, and their phone mic streams over WebRTC (PeerJS) to the display's Web Audio mixer. Per-channel volume sliders and a reverb toggle are on the display overlay (because of course reverb made the cut).
- **Live queue** — Add, vote, reorder (drag-and-drop), skip, remove. Queue bar stays visible on the TV at all times.
- **Session PIN** — TV generates a 4-digit PIN. Phones join by scanning the QR code or entering the PIN manually.
- **PWA** — Mobile client installs to home screen on Android/iOS for that "real app" feeling.
- **Stable on a LAN** — No cloud dependency. Works at a party even when the internet decides to take the night off.

---

## 📁 Project Structure

```
karaoke2/
├── server/          # Express API + Socket.io + PeerJS
│   └── src/
│       ├── routes/  # REST endpoints
│       ├── socket/  # Socket.io event handlers
│       ├── db/      # SQLite schema + queries
│       └── lib/     # yt-dlp, lyrics, song index, cleanup
├── client/
│   ├── display/     # TV-facing React app
│   └── mobile/      # Phone-facing PWA
└── certs/           # mkcert-generated HTTPS certs (gitignored)
```

---

## ⚠️ Known Limitations

- **Host browser cert warning** — On first run, Chrome/Edge will warn about the self-signed cert. Click *Advanced → Proceed*. To permanently silence it, import `certs/rootCA.pem` into Windows via `certmgr.msc → Trusted Root Certification Authorities → Import` (or uncomment the relevant lines in `launch.ps1`, which does it automatically with admin rights).
- **Phones** — Visit `https://<lan-ip>:3000/rootCA.pem` on the device and install the CA profile. The server logs the exact link on startup.
- **`better-sqlite3`** requires native build tools on Windows. If `pnpm install` fails, install [Python 3.12](https://python.org) and [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022).
- **yt-dlp** must be on your system PATH: `winget install yt-dlp.yt-dlp`
- **WebRTC phone mics** only work over HTTPS. The server falls back to HTTP if cert generation fails (check write permissions on the `certs/` directory).

---

## 📦 Running It

Double-click `launch.bat` or run `launch.ps1` in PowerShell. That's it.

The launcher checks for Node.js and pnpm, installs dependencies on first run, builds the React clients if needed, and starts the server. Certs are generated automatically — no extra steps.

```bat
launch.bat
```

```powershell
.\launch.ps1
```

> **Tip:** `launch.ps1` has a commented block near the bottom that imports the CA cert into the Windows trust store (requires running as Administrator), which permanently silences the browser cert warning on the host machine.

---

## 🍸 Contributing

Pull requests welcome. Especially if you were also at Bootleggers that night and remember promising to "add that feature." You know who you are.

Please don't add a subscription tier.

---

## ☕ Buy Me a Drink

This project was born over cocktails, so it's only fitting.
If it saved you from buying an overpriced karaoke subscription, or just made your party a bit more chaotic, consider returning the favour.

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/defenceplox)

---

## 📜 License

GPL — because this was built for fun, at a bar, and should stay that way.

---

*Built with love, pnpm, and an inadvisable number of Long Island Ice Teas. 🎶*
