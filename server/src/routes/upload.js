import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { getSessionByPin } from '../db/queries.js';
import { indexUploadedFiles } from '../lib/songIndex.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const storage = multer.diskStorage({
  destination(req, file, cb) {
    const pin = req.headers['x-session-pin'] || req.query.pin;
    const session = pin ? getSessionByPin(pin) : null;
    if (!session) return cb(new Error('Invalid session PIN'));

    const dir = path.join(__dirname, `../../public/songs/${session.id}`);
    fs.mkdirSync(dir, { recursive: true });
    req.sessionObj = session;
    cb(null, dir);
  },
  filename(req, file, cb) {
    // Preserve original name (sanitised) so .mp3/.cdg pairs stay matched
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\- ]/g, '_');
    cb(null, safe);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mp3', '.cdg', '.zip'].includes(ext)) return cb(null, true);
    cb(new Error(`Unsupported file type: ${ext}`));
  },
});

const router = express.Router();

// POST /api/upload — upload CDG+MP3 pair(s)
router.post('/', upload.array('files', 20), (req, res) => {
  if (!req.sessionObj) return res.status(400).json({ error: 'Invalid session' });
  if (!req.files?.length) return res.status(400).json({ error: 'No files uploaded' });

  const sessionId   = req.sessionObj.id;
  const uploadedDir = path.join(__dirname, `../../public/songs/${sessionId}`);
  const indexed     = indexUploadedFiles(sessionId, uploadedDir, req.files.map(f => f.filename));

  res.json({ ok: true, songs: indexed });
});

export default router;
