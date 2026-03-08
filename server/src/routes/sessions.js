import express from 'express';
import { createSession, getSessionByPin } from '../db/queries.js';

const router = express.Router();

// POST /api/sessions — create a new karaoke session, returns PIN
router.post('/', (req, res) => {
  try {
    const session = createSession();
    res.json({ ok: true, session });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sessions/:pin — look up session by PIN
router.get('/:pin', (req, res) => {
  const session = getSessionByPin(req.params.pin);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true, session });
});

export default router;
