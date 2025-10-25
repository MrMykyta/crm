// server/src/routes/uploadRouter.js
const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const fetch = require('node-fetch'); // v2
const { sequelize } = require('../../models');

const router = express.Router();

/* ---------------- Models (safe pick) ---------------- */
const pickModel = (name) =>
  sequelize.models[name] ||
  sequelize.models[name.toLowerCase()] ||
  sequelize.models[`${name}s`] ||
  sequelize.models[`${name.toLowerCase()}s`];

const Attachment   = pickModel('Attachment');
const User         = pickModel('User');
const Company      = pickModel('Company');
const Counterparty = pickModel('Counterparty');

if (!Attachment) throw new Error('Attachment model not found');

/* ---------------- MIME / LIMITS ---------------- */
const IMAGE_MIME = new Set(['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']);
const FILE_MIME  = new Set([
  'text/plain','text/csv','application/json','application/pdf','application/zip',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const ALLOWED_MIME = new Set([...IMAGE_MIME, ...FILE_MIME]);
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;      // 5 MB
const MAX_FILE_SIZE  = 500 * 1024 * 1024;    // 500 MB
const limitForMime = (m) => (IMAGE_MIME.has(m) ? MAX_IMAGE_SIZE : MAX_FILE_SIZE);

/* ---------------- Owner normalization ---------------- */
// что бы ни пришло в URL — приводим к единственному (для БД enum) и к папке (множественное)
const OWNER_MAP = {
  user: 'user', users: 'user',
  company: 'company', companies: 'company',
  counterparty: 'counterparty', counterparties: 'counterparty',
};
const DIR_PLURAL = { user: 'users', company: 'companies', counterparty: 'counterparties' };
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertOwner(req, res) {
  const rawType = String(req.params.ownerType || '').toLowerCase();
  const ownerId = String(req.params.ownerId || '');
  const singular = OWNER_MAP[rawType]; // 'company' | 'user' | 'counterparty'
  if (!singular) { res.status(400).json({ error:'bad_owner_type' }); return null; }
  if (!UUID_RX.test(ownerId)) { res.status(400).json({ error:'bad_owner_id' }); return null; }

  req._ownerSingular = singular;               // для БД (enum)
  req._ownerDir      = DIR_PLURAL[singular];   // для файловой системы/URL
  req._ownerId       = ownerId;
  return { ownerTypeDb: singular, ownerDir: req._ownerDir, ownerId };
}

/* ---------------- FS helpers ---------------- */
const UPLOAD_ROOT = path.join(__dirname, '../../..', 'uploads');
fs.mkdirSync(UPLOAD_ROOT, { recursive: true });

const makeFileName = (orig='') => {
  const ext = path.extname(orig).toLowerCase().slice(0, 10);
  const rnd = crypto.randomBytes(8).toString('hex');
  return `${Date.now()}-${rnd}${ext}`;
};
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

const publicUrl = (req, rel) =>
  `${req.protocol}://${req.get('host')}${rel.startsWith('/') ? '' : '/'}${rel}`;

/* ---------------- DB helpers ---------------- */
async function attachRow({ companyId, ownerTypeEnum, ownerId, originalname, mimetype, size, relPath, uploadedBy }) {
  return Attachment.create({
    companyId,
    ownerType: ownerTypeEnum,  // enum: 'company' | 'user' | 'counterparty'
    ownerId,
    filename: originalname,
    mime: mimetype,
    size,
    storagePath: relPath,
    uploadedBy,
  });
}

// проставляем avatar/background/logo URL прямо в сущность (если поле существует)
async function maybeSetVisualUrl(ownerDirOrSingular, ownerId, purpose, url) {
  if (!['avatar', 'background', 'logo'].includes(purpose)) return;

  // принимаем и 'companies' и 'company'
  const key = ownerDirOrSingular.endsWith('s')
    ? ownerDirOrSingular
    : DIR_PLURAL[ownerDirOrSingular] || ownerDirOrSingular;

  const map = { users: User, companies: Company, counterparties: Counterparty };
  const Model = map[key];
  if (!Model) return;

  const rec = await Model.findByPk(ownerId);
  if (!rec) return;

  const json  = rec.toJSON();
  const camel = `${purpose}Url`;
  const snake = `${purpose}_url`;
  const field = camel in json ? camel : (snake in json ? snake : null);
  if (!field) return;

  rec.set(field, url);
  await rec.save();
}

/* ---------------- Multer ---------------- */
function createMulter() {
  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      const dest = path.join(UPLOAD_ROOT, req._ownerDir, req._ownerId);
      ensureDir(dest);
      cb(null, dest);
    },
    filename: (_req, file, cb) => cb(null, makeFileName(file.originalname)),
  });

  return multer({
    storage,
    limits: { fileSize: MAX_FILE_SIZE }, // реальный лимит проверим сами
    fileFilter: (req, file, cb) => {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'mime_not_allowed'));
      }
      req._maxSize = limitForMime(file.mimetype);
      cb(null, true);
    },
  }).single('file'); // поле формы: 'file'
}

/* ---------------- ROUTES ---------------- */
/**
 * Multipart upload
 * POST /api/uploads/:ownerType/:ownerId?purpose=avatar|background|logo|file
 */
router.post('/:ownerType/:ownerId',
  (req, res, next) => { const ok = assertOwner(req, res); if (!ok) return; next(); },
  (req, res, next) => {
    createMulter()(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE')
          return res.status(413).json({ error: 'file_too_large', max: req._maxSize || MAX_FILE_SIZE });
        if (err.code === 'LIMIT_UNEXPECTED_FILE')
          return res.status(415).json({ error: 'mime_not_allowed' });
        return res.status(400).json({ error: 'multer_error', code: err.code });
      }
      if (err) return res.status(500).json({ error: 'upload_failed', message: err.message });
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'no_file' });

      const ownerTypeDb = req._ownerSingular; // 'company' | 'user' | 'counterparty'
      const ownerDir    = req._ownerDir;      // 'companies' | 'users' | 'counterparties'
      const ownerId     = req._ownerId;
      const purpose     = String(req.query.purpose || 'file').toLowerCase();

      let companyId = req.body.companyId || req.query.companyId || null;
      if (!companyId) companyId = (ownerTypeDb === 'company') ? ownerId : (req.user?.companyId || null);

      const uploadedBy = req.user?.id || req.body.uploadedBy || req.query.uploadedBy || ownerId;

      const max = limitForMime(req.file.mimetype);
      if (req.file.size > max) {
        try { fs.unlinkSync(req.file.path); } catch {}
        return res.status(413).json({ error: 'file_too_large', max });
      }

      const relPath = `/uploads/${ownerDir}/${ownerId}/${req.file.filename}`;
      const url = publicUrl(req, relPath);

      const row = await attachRow({
        companyId,
        ownerTypeEnum: ownerTypeDb,
        ownerId,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        relPath,
        uploadedBy,
      });

      await maybeSetVisualUrl(ownerDir, ownerId, purpose, url);

      res.json({ id: row.id, url, filename: row.filename, mime: row.mime, size: row.size, purpose });
    } catch (e) {
      res.status(500).json({ error: 'upload_failed', message: e.message });
    }
  }
);

/**
 * Upload by URL
 * POST /api/uploads/by-url/:ownerType/:ownerId
 * body: { url, filename?, mime?, companyId?, uploadedBy? }
 */
router.post('/by-url/:ownerType/:ownerId', async (req, res) => {
  try {
    const ok = assertOwner(req, res); if (!ok) return;

    const src = String(req.body?.url || '').trim();
    if (!src) return res.status(400).json({ error: 'no_url' });

    let u;
    try { u = new URL(src); } catch { return res.status(400).json({ error: 'bad_url' }); }
    if (!/^https?:$/.test(u.protocol)) return res.status(400).json({ error: 'bad_url_scheme' });
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/i.test(u.hostname)) {
      return res.status(400).json({ error: 'forbidden_host' });
    }

    const ownerTypeDb = req._ownerSingular;
    const ownerDir    = req._ownerDir;
    const ownerId     = req._ownerId;
    const purpose     = String(req.query.purpose || 'file').toLowerCase();

    let companyId = req.body.companyId || req.query.companyId || null;
    if (!companyId) companyId = (ownerTypeDb === 'company') ? ownerId : (req.user?.companyId || null);
    const uploadedBy = req.user?.id || req.body.uploadedBy || req.query.uploadedBy || ownerId;

    let mime = req.body?.mime || '';
    let contentLength = 0;

    // попытка HEAD
    try {
      const head = await fetch(src, { method: 'HEAD' });
      if (head.ok) {
        mime = mime || head.headers.get('content-type') || '';
        const len = Number(head.headers.get('content-length') || 0);
        if (Number.isFinite(len)) contentLength = len;
      }
    } catch {}

    if (!mime) mime = 'application/octet-stream';
    if (!ALLOWED_MIME.has(mime)) return res.status(415).json({ error: 'mime_not_allowed' });

    const max = limitForMime(mime);
    if (contentLength && contentLength > max) return res.status(413).json({ error: 'file_too_large', max });

    const filename = makeFileName(req.body?.filename || path.basename(u.pathname || 'download'));
    const destDir  = path.join(UPLOAD_ROOT, ownerDir, ownerId);
    ensureDir(destDir);
    const destPath = path.join(destDir, filename);

    const r = await fetch(src);
    if (!r.ok) return res.status(400).json({ error: 'download_failed', status: r.status });

    const fileStream = fs.createWriteStream(destPath);
    let written = 0;

    await new Promise((resolve, reject) => {
      r.body.on('data', (chunk) => {
        written += chunk.length;
        if (written > max) {
          r.body.destroy(new Error('file_too_large'));
          fileStream.destroy(new Error('file_too_large'));
        }
      });
      r.body.pipe(fileStream);
      fileStream.on('finish', resolve);
      fileStream.on('error', reject);
      r.body.on('error', reject);
    }).catch((err) => {
      try { fs.unlinkSync(destPath); } catch {}
      if (err && err.message === 'file_too_large') { err.code = 413; throw err; }
      throw err;
    });

    const relPath = `/uploads/${ownerDir}/${ownerId}/${filename}`;
    const url = publicUrl(req, relPath);

    const row = await attachRow({
      companyId,
      ownerTypeEnum: ownerTypeDb,
      ownerId,
      originalname: req.body?.filename || path.basename(u.pathname || 'download'),
      mimetype: mime,
      size: written,
      relPath,
      uploadedBy,
    });

    await maybeSetVisualUrl(ownerDir, ownerId, purpose, url);

    res.json({ id: row.id, url, filename: row.filename, mime: row.mime, size: row.size, purpose });
  } catch (e) {
    if (e.code === 413) return res.status(413).json({ error: 'file_too_large' });
    res.status(500).json({ error: 'upload_failed', message: e.message });
  }
});

module.exports = router;