'use strict';

const router = require('express').Router();
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { auth } = require('../../middleware/auth');
const fileAuth = require('../../middleware/fileAuth');
const authorize = require('../../middleware/authorize');
const { TMP_ROOT, MAX_SIZE_BYTES } = require('../../config/files');
const FileController = require('../../controllers/system/File.controller');

// Ensure temp directory exists (runtime safe for DEV/PROD)
fs.mkdirSync(TMP_ROOT, { recursive: true });

const storage = multer.diskStorage({
  // Складывает временные файлы в общий temp-каталог.
destination: (_req, _file, cb) => cb(null, TMP_ROOT),
  // Генерирует уникальное имя файла с сохранением расширения.
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

// fileAuth supports ?token=... and populates req.user, but not req.companyId.
const restoreCompanyContext = (req, _res, next) => {
  req.companyId = req.companyId || req.user?.companyId || null;
  next();
};

// Unified Files API
router.post('/upload', auth, authorize(['file:upload', 'attachment:upload']), upload.single('file'), FileController.upload);
router.get('/', auth, authorize(['file:read', 'attachment:read']), FileController.list);
router.post('/:id/signed-url', auth, authorize(['file:read', 'attachment:read']), FileController.signedUrl);
router.post('/:id/signed-download', auth, authorize(['file:read', 'attachment:read']), FileController.signedDownload);
router.get('/:id/inline', FileController.inline);
router.get('/:id/download-inline', FileController.downloadInline);
router.get('/:id/download', fileAuth, restoreCompanyContext, authorize(['file:read', 'attachment:read']), FileController.downloadPrivate);
router.delete('/:id', auth, authorize(['file:delete', 'attachment:delete']), FileController.remove);

module.exports = router;
