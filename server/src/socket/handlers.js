import {
  getSessionByPin,
  getQueue,
  addToQueue,
  removeFromQueue,
  reorderQueue,
  voteForItem,
  markPlaying,
  skipCurrent,
  getNowPlaying,
  isVideoInQueue,
} from '../db/queries.js';

// ── Per-socket rate limiting ────────────────────────────────────────────────
// Simple in-memory cooldown map: socketId → { action → lastMs }
// No external dependency — just enough to stop spam at a real party.
const COOLDOWNS = {
  'queue:add':    2000,  // max 1 add every 2 s
  'queue:vote':   1000,  // max 1 vote every 1 s
  'queue:reorder': 500,  // max 1 reorder every 0.5 s
};
const lastAction = new Map(); // socketId → Map<action, timestamp>

function isRateLimited(socketId, action) {
  const limit = COOLDOWNS[action];
  if (!limit) return false;
  const now = Date.now();
  let actions = lastAction.get(socketId);
  if (!actions) { actions = new Map(); lastAction.set(socketId, actions); }
  const last = actions.get(action) || 0;
  if (now - last < limit) return true;
  actions.set(action, now);
  return false;
}

// ── Wrap a socket handler in try/catch ─────────────────────────────────────
// Prevents one bad handler from crashing the whole socket connection.
function safe(handlerFn) {
  return function (...args) {
    try {
      handlerFn.apply(this, args);
    } catch (err) {
      console.error(`Socket handler error:`, err);
      // Last arg might be the ack callback
      const ack = args[args.length - 1];
      if (typeof ack === 'function') ack({ error: 'Internal server error' });
    }
  };
}

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Join a session room by PIN ──────────────────────────────────────────
    socket.on('session:join', safe(({ pin }, ack) => {
      const session = getSessionByPin(pin);
      if (!session) {
        ack?.({ error: 'Session not found' });
        return;
      }
      socket.join(session.id);
      socket.data.sessionId = session.id;

      const queue      = getQueue(session.id);
      const nowPlaying = getNowPlaying(session.id);
      ack?.({ ok: true, sessionId: session.id, queue, nowPlaying });
      console.log(`📺 Socket ${socket.id} joined session ${session.id} (PIN: ${pin})`);
    }));

    // ── Queue operations ────────────────────────────────────────────────────
    socket.on('queue:add', safe(({ songData, singerName }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }

      if (isRateLimited(socket.id, 'queue:add')) {
        ack?.({ error: 'Slow down — one song every 2 seconds' }); return;
      }

      // Duplicate check for YouTube videos
      if (songData?.youtubeId && isVideoInQueue(sessionId, songData.youtubeId)) {
        ack?.({ error: 'This song is already in the queue', duplicate: true }); return;
      }

      const queue = addToQueue(sessionId, { ...songData, singerName });
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    }));

    socket.on('queue:remove', safe(({ itemId }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const queue = removeFromQueue(sessionId, itemId);
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    }));

    socket.on('queue:reorder', safe(({ orderedIds }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      if (!Array.isArray(orderedIds)) { ack?.({ error: 'orderedIds must be an array' }); return; }

      if (isRateLimited(socket.id, 'queue:reorder')) {
        ack?.({ error: 'Too many reorders' }); return;
      }

      const queue = reorderQueue(sessionId, orderedIds);
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    }));

    socket.on('queue:vote', safe(({ itemId, voterId }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }

      if (isRateLimited(socket.id, 'queue:vote')) {
        ack?.({ error: 'Too many votes' }); return;
      }

      const queue = voteForItem(sessionId, itemId, voterId);
      if (!queue) { ack?.({ error: 'Item not found' }); return; }
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    }));

    // ── Playback control (display client) ──────────────────────────────────
    socket.on('playback:next', safe((_, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const nowPlaying = markPlaying(sessionId);
      const queue      = getQueue(sessionId);
      io.to(sessionId).emit('playback:started', { nowPlaying, queue });
      ack?.({ ok: true, nowPlaying });
    }));

    socket.on('playback:skip', safe((_, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const nowPlaying = skipCurrent(sessionId);
      const queue      = getQueue(sessionId);
      io.to(sessionId).emit('playback:started', { nowPlaying, queue });
      ack?.({ ok: true, nowPlaying });
    }));

    // Broadcast current playback time to phone clients (for lyrics follow-along)
    socket.on('playback:tick', ({ currentTime, duration }) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      // Broadcast to everyone else in the session (not back to display)
      socket.to(sessionId).emit('playback:tick', { currentTime, duration });
    });

    // Nudge lyrics timing from any client in the session
    socket.on('lyrics:offset', ({ delta }) => {
      const { sessionId } = socket.data;
      if (!sessionId || typeof delta !== 'number') return;
      socket.to(sessionId).emit('lyrics:offset', { delta });
    });

    socket.on('playback:ended', safe((_, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const nowPlaying = markPlaying(sessionId);
      const queue      = getQueue(sessionId);
      io.to(sessionId).emit('playback:started', { nowPlaying, queue });
      ack?.({ ok: true, nowPlaying });
    }));

    // ── Mic state ───────────────────────────────────────────────────────────
    socket.on('mic:connected', ({ peerId, singerName }) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      socket.to(sessionId).emit('mic:connected', { peerId, singerName, socketId: socket.id });
    });

    socket.on('mic:disconnected', ({ peerId }) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      socket.to(sessionId).emit('mic:disconnected', { peerId, socketId: socket.id });
    });

    // ── Disconnect ──────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
      // Clean up rate limit state for this socket
      lastAction.delete(socket.id);
      const { sessionId } = socket.data || {};
      if (sessionId) {
        socket.to(sessionId).emit('mic:disconnected', { socketId: socket.id });
      }
    });
  });
}
