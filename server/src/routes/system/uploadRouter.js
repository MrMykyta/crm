// server/src/routes/system/uploadRouter.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const uploadRouter = express.Router();

const folder = path.join(__dirname, '../../..', 'uploads', 'backgrounds');
fs.mkdirSync(folder, { recursive: true });

const storage = multer.diskStorage({
  destination: folder,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.png';
    const name = `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
    cb(null, name);
  },
});
const upload = multer({ storage });

uploadRouter.post('/upload/background', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no_file' });

  const base = process.env.FILE_BASE_URL || `${req.protocol}://${req.get('host')}`;
  const url  = `${base}/static/backgrounds/${req.file.filename}`;
  res.json({ url });
});

module.exports = uploadRouter;