import fs from 'fs';
import https from 'https';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import cors from 'cors';
import { Server } from 'socket.io';
import { ExpressPeerServer } from 'peer';

import { initDb } from './db/database.js';
import { startCleanup } from './lib/cleanup.js';
import { registerSocketHandlers } from './socket/handlers.js';
import songsRouter from './routes/songs.js';
import queueRouter from './routes/queue.js';
import sessionsRouter from './routes/sessions.js';
import uploadRouter from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
// Resolve cert paths relative to the server/ directory so they work
// regardless of which directory pnpm/node is invoked from.
const _serverRoot = path.resolve(__dirname, '..');
const CERT_PATH = process.env.CERT_PATH ? path.resolve(_serverRoot, process.env.CERT_PATH) : null;
const KEY_PATH  = process.env.KEY_PATH  ? path.resolve(_serverRoot, process.env.KEY_PATH)  : null;

// ── Express app ─────────────────────────────────────────────────────────────
const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Serve built frontend assets
const displayDist = path.join(__dirname, '../../client/display/dist');
const mobileDist  = path.join(__dirname, '../../client/mobile/dist');
if (fs.existsSync(displayDist)) app.use('/display', express.static(displayDist));
if (fs.existsSync(mobileDist))  app.use('/remote',  express.static(mobileDist));

// Serve uploaded song files
const songsDir = path.join(__dirname, '../public/songs');
fs.mkdirSync(songsDir, { recursive: true });
app.use('/songs', express.static(songsDir));

// Serve mkcert root CA for easy phone trust installation (dev only)
const caCertPath = path.join(__dirname, '../../certs/rootCA.pem');
if (process.env.NODE_ENV !== 'production' && fs.existsSync(caCertPath)) {
  app.get('/rootCA.pem', (req, res) => {
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="rootCA.pem"');
    res.sendFile(caCertPath);
  });
  console.log('📲 CA cert available at /rootCA.pem (install on phone to trust HTTPS)');
}

// API routes
app.use('/api/songs',    songsRouter);
app.use('/api/queue',    queueRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/upload',   uploadRouter);

// Fallback: serve mobile app for /remote and all /remote/* routes (SPA)
app.get(['/remote', '/remote/*'], (req, res) => {
  const index = path.join(mobileDist, 'index.html');
  fs.existsSync(index) ? res.sendFile(index) : res.send('Mobile client not built yet — run pnpm build');
});
app.get(['/display', '/display/*'], (req, res) => {
  const index = path.join(displayDist, 'index.html');
  fs.existsSync(index) ? res.sendFile(index) : res.send('Display client not built yet — run pnpm build');
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    display: '/display',
    remote:  '/remote',
    api:     '/api',
  });
});

// ── HTTP(S) server ───────────────────────────────────────────────────────────
let server;
const hasCerts = CERT_PATH && KEY_PATH && fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

if (hasCerts) {
  server = https.createServer(
    { cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) },
    app
  );
  console.log('🔒 HTTPS enabled (certs found)');
} else {
  server = http.createServer(app);
  console.warn('⚠️  HTTP only — mic access requires HTTPS. Run scripts/gen-certs.sh to generate dev certs.');
}

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
registerSocketHandlers(io);

// ── PeerJS server (WebRTC signaling for phone mics) ──────────────────────────
// PeerJS requires HTTPS (WebRTC constraint). Only enable when certs are present.
if (hasCerts) {
  const peerServer = ExpressPeerServer(server, {
    path: '/',
    allow_discovery: false,
  });
  app.use('/peerjs', peerServer);

  peerServer.on('connection', (client) => {
    console.log(`📱 Peer connected: ${client.getId()}`);
  });
  peerServer.on('disconnect', (client) => {
    console.log(`📱 Peer disconnected: ${client.getId()}`);
  });
} else {
  console.warn('⚠️  PeerJS disabled — requires HTTPS. Phone mic will not work.');
}

// ── Init & start ─────────────────────────────────────────────────────────────
initDb();
startCleanup();

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use. Kill the old process and try again.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, '0.0.0.0', () => {
  const protocol = hasCerts ? 'https' : 'http';
  console.log(`\n🎤 Karaoke server running on ${protocol}://localhost:${PORT}`);
  console.log(`   TV Display → ${protocol}://localhost:${PORT}/display`);
  console.log(`   Mobile     → ${protocol}://localhost:${PORT}/remote\n`);
});
