# 🎤 Bootleggers Karaoke

> *"We should totally just build our own karaoke system."*
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
- **Phone (Mobile)** — PWA that guests install from a QR code. Search YouTube for karaoke tracks, add songs to the queue, vote, reorder, and even use your phone as a wireless mic.
- **Server** — Express + Socket.io backend running HTTPS locally. Handles sessions, queue management, YouTube search, yt-dlp fallback for embed-blocked videos, LRCLIB lyrics, and CDG+MP3 upload.

---

## 🛠️ Tech Stack

| Layer | What's In It |
|-------|-------------|
| Server | Node.js, Express, HTTPS, Socket.io, PeerJS, SQLite (better-sqlite3), yt-dlp |
| Display | React + Vite, cdgraphics, Web Audio API, Canvas |
| Mobile | React + Vite, PWA, WebRTC (PeerJS) |
| Package mgr | pnpm workspaces |
| Certs | mkcert (local CA for HTTPS + WebRTC on LAN) |

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- pnpm v9+
- Python 3.12 + Visual Studio Build Tools (for `better-sqlite3` native addon)
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) on your PATH
- [mkcert](https://github.com/FiloSottile/mkcert) for HTTPS certs

### Setup

```bash
# 1. Clone the repo
git clone <your-repo-url>
cd karaoke2

# 2. Generate local HTTPS certs (required for WebRTC phone mics)
cd certs
mkcert localhost 192.168.0.55   # replace with your LAN IP
mkcert -install                  # installs local CA
cd ..

# 3. Copy rootCA.pem for Android (optional but nice)
cp "$(mkcert -CAROOT)/rootCA.pem" certs/rootCA.pem

# 4. Install dependencies
pnpm install

# 5. Set up your .env (see .env.example)
cp server/.env.example server/.env

# 6. Fire it up
pnpm dev
```

### URLs

| Client | URL |
|--------|-----|
| Display (TV) | `https://localhost:3001/display/` |
| Mobile (phones) | `https://192.168.0.55:3002/remote/` |
| Server API | `https://localhost:3000/api/` |
| Install Android CA | Visit `https://192.168.0.55:3000/rootCA.pem` on the phone |

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

- Firefox on Windows doesn't play nice with mkcert. Use Chrome or Edge.
- `better-sqlite3` requires native build tools on Windows. If `pnpm install` explodes, make sure you have Python 3.12 + VS Build Tools installed.
- yt-dlp must be on your system PATH. Install via `winget install yt-dlp.yt-dlp`.
- WebRTC phone mics only work over HTTPS. If you skip the cert setup, PeerJS is disabled automatically.

---

## 🍸 Contributing

Pull requests welcome. Especially if you were also at Bootleggers that night and remember promising to "add that feature." You know who you are.

Please don't add a subscription tier.

---

## 📜 License

MIT — because this was built for fun, at a bar, and should stay that way.

---

*Built with love, pnpm, and an inadvisable number of gin & tonics. 🎶*
