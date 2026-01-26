'use strict';

const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { auth } = require('../../middleware/auth');
const fileAuth = require('../../middleware/fileAuth');
const { TMP_ROOT, MAX_SIZE_BYTES } = require('../../config/files');
const FileController = require('../../controllers/system/File.controller');

// Ensure temp directory exists (runtime safe for DEV/PROD)
fs.mkdirSync(TMP_ROOT, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_ROOT),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase().slice(0, 10);
    const rnd = crypto.randomBytes(6).toString('hex');
    cb(null, `${Date.now()}-${rnd}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
});

// Unified Files API
router.post('/upload', auth, upload.single('file'), FileController.upload);
router.get('/', auth, FileController.list);
router.post('/:id/signed-url', auth, FileController.signedUrl);
router.post('/:id/signed-download', auth, FileController.signedDownload);
router.get('/:id/inline', FileController.inline);
router.get('/:id/download-inline', FileController.downloadInline);
router.get('/:id/download', fileAuth, FileController.downloadPrivate);
router.delete('/:id', auth, FileController.remove);

module.exports = router;
