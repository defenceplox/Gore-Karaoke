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
import { ensureCerts } from './lib/certGen.js';
import songsRouter from './routes/songs.js';
import queueRouter from './routes/queue.js';
import sessionsRouter from './routes/sessions.js';
import uploadRouter from './routes/upload.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = process.env.PORT || 3000;
// Resolve cert paths relative to the server/ directory so they work
// regardless of which directory pnpm/node is invoked from.
const _serverRoot = path.resolve(__dirname, '..');
const CERT_PATH    = path.resolve(_serverRoot, process.env.CERT_PATH    || '../certs/server.pem');
const KEY_PATH     = path.resolve(_serverRoot, process.env.KEY_PATH     || '../certs/server-key.pem');
const CA_CERT_PATH = path.resolve(_serverRoot, process.env.CA_CERT_PATH || '../certs/rootCA.pem');

// Auto-generate self-signed certs if missing (replaces mkcert requirement)
ensureCerts(CERT_PATH, KEY_PATH, CA_CERT_PATH);

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

// Serve root CA cert so phones can install it and trust HTTPS / WebRTC
if (fs.existsSync(CA_CERT_PATH)) {
  app.get('/rootCA.pem', (req, res) => {
    res.setHeader('Content-Type', 'application/x-pem-file');
    res.setHeader('Content-Disposition', 'attachment; filename="rootCA.pem"');
    res.sendFile(CA_CERT_PATH);
  });
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
const hasCerts = fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH);

if (hasCerts) {
  server = https.createServer(
    { cert: fs.readFileSync(CERT_PATH), key: fs.readFileSync(KEY_PATH) },
    app
  );
  console.log('🔒 HTTPS enabled (certs found)');
} else {
  server = http.createServer(app);
  console.warn('⚠️  HTTP only — cert generation failed. Check write permissions on the certs/ directory.');
}

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});
// Attach io to Express so REST routes (e.g. queue.js) can emit socket events
app.set('io', io);
registerSocketHandlers(io);

// ── PeerJS server (WebRTC signaling for phone mics) ──────────────────────────
// PeerJS requires HTTPS (WebRTC constraint). Only enable when certs are present.
if (hasCerts) {
  const peerServer = ExpressPeerServer(server, {
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

// ── Graceful shutdown ────────────────────────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n🛑 ${signal} received — shutting down gracefully…`);
  // Notify all connected clients so they can show a reconnecting state
  io.emit('server:shutdown');
  server.close(() => {
    console.log('✅ HTTP server closed.');
    // Give socket.io a moment to flush, then exit
    io.close(() => process.exit(0));
  });
  // Force exit after 5 s if something hangs
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
