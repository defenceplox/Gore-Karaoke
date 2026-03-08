import express from 'express';
import { getQueue, addToQueue, removeFromQueue, reorderQueue, voteForItem, getNowPlaying } from '../db/queries.js';
import { getSessionByPin } from '../db/queries.js';

const router = express.Router();

// Middleware: resolve session from PIN header or query param
router.use((req, res, next) => {
  const pin = req.headers['x-session-pin'] || req.query.pin;
  if (!pin) return res.status(400).json({ error: 'Missing session PIN' });
  const session = getSessionByPin(pin);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  req.session = session;
  next();
});

// GET /api/queue
router.get('/', (req, res) => {
  const queue      = getQueue(req.session.id);
  const nowPlaying = getNowPlaying(req.session.id);
  res.json({ ok: true, queue, nowPlaying });
});

// POST /api/queue
router.post('/', (req, res) => {
  const { songData, singerName } = req.body;
  if (!songData) return res.status(400).json({ error: 'Missing songData' });
  const queue = addToQueue(req.session.id, { ...songData, singerName });
  res.json({ ok: true, queue });
});

// DELETE /api/queue/:itemId
router.delete('/:itemId', (req, res) => {
  const queue = removeFromQueue(req.session.id, req.params.itemId);
  res.json({ ok: true, queue });
});

// PATCH /api/queue/reorder
router.patch('/reorder', (req, res) => {
  const { orderedIds } = req.body;
  if (!Array.isArray(orderedIds)) return res.status(400).json({ error: 'orderedIds must be an array' });
  const queue = reorderQueue(req.session.id, orderedIds);
  res.json({ ok: true, queue });
});

// POST /api/queue/:itemId/vote
router.post('/:itemId/vote', (req, res) => {
  const { voterId } = req.body;
  if (!voterId) return res.status(400).json({ error: 'Missing voterId' });
  const queue = voteForItem(req.session.id, req.params.itemId, voterId);
  if (!queue) return res.status(404).json({ error: 'Queue item not found' });
  res.json({ ok: true, queue });
});

export default router;
