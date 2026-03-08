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
} from '../db/queries.js';

export function registerSocketHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id}`);

    // ── Join a session room by PIN ──────────────────────────────────────────
    socket.on('session:join', ({ pin }, ack) => {
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
    });

    // ── Queue operations ────────────────────────────────────────────────────
    socket.on('queue:add', ({ songData, singerName }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const queue = addToQueue(sessionId, { ...songData, singerName });
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    });

    socket.on('queue:remove', ({ itemId }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const queue = removeFromQueue(sessionId, itemId);
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    });

    socket.on('queue:reorder', ({ orderedIds }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const queue = reorderQueue(sessionId, orderedIds);
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    });

    socket.on('queue:vote', ({ itemId, voterId }, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const queue = voteForItem(sessionId, itemId, voterId);
      if (!queue) { ack?.({ error: 'Item not found' }); return; }
      io.to(sessionId).emit('queue:update', { queue });
      ack?.({ ok: true, queue });
    });

    // ── Playback control (display client) ──────────────────────────────────
    socket.on('playback:next', (_, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const nowPlaying = markPlaying(sessionId);
      const queue      = getQueue(sessionId);
      io.to(sessionId).emit('playback:started', { nowPlaying, queue });
      ack?.({ ok: true, nowPlaying });
    });

    socket.on('playback:skip', (_, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const nowPlaying = skipCurrent(sessionId);
      const queue      = getQueue(sessionId);
      io.to(sessionId).emit('playback:started', { nowPlaying, queue });
      ack?.({ ok: true, nowPlaying });
    });

    // Broadcast current playback time to phone clients (for lyrics follow-along)
    socket.on('playback:tick', ({ currentTime, duration }) => {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      // Broadcast to everyone else in the session (not back to display)
      socket.to(sessionId).emit('playback:tick', { currentTime, duration });
    });

    socket.on('playback:ended', (_, ack) => {
      const { sessionId } = socket.data;
      if (!sessionId) { ack?.({ error: 'Not in a session' }); return; }
      const nowPlaying = markPlaying(sessionId);
      const queue      = getQueue(sessionId);
      io.to(sessionId).emit('playback:started', { nowPlaying, queue });
      ack?.({ ok: true, nowPlaying });
    });

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
      const { sessionId } = socket.data || {};
      if (sessionId) {
        socket.to(sessionId).emit('mic:disconnected', { socketId: socket.id });
      }
    });
  });
}
