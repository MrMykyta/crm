'use strict';

const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');
const ApplicationError = require('../../errors/ApplicationError');
const fileService = require('../../services/system/fileService');
const { File } = require('../../models');
const { STORAGE_ROOT, SIGNING_SECRET, SIGNED_URL_TTL_SEC } = require('../../config/files');

const INLINE_PREVIEW_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'video/mp4',
  'video/webm',
]);

function parseSignedQuery(req) {
  const { id } = req.params;
  const expStr = String(req.query?.exp || '').trim();
  const cid = String(req.query?.cid || '');
  const sig = String(req.query?.sig || '');

  if (!id || !expStr || !cid || !sig) {
    throw new ApplicationError('Unauthorized', 403);
  }

  const exp = Number(expStr);
  if (!Number.isInteger(exp)) {
    throw new ApplicationError('Unauthorized', 403);
  }

  const now = Math.floor(Date.now() / 1000);
  const maxExp = now + Number(SIGNED_URL_TTL_SEC || 0) + 60;
  if (exp < now - 30 || exp > maxExp) {
    throw new ApplicationError('Signed URL expired', 403);
  }

  const expected = signInlineUrl(id, exp, cid);
  if (!timingSafeEqual(expected, sig)) {
    throw new ApplicationError('Unauthorized', 403);
  }

  return { id, exp, cid };
}

function absolutePath(storagePath) {
  // storagePath хранится как относительный путь от STORAGE_ROOT
  return path.join(STORAGE_ROOT, storagePath);
}

function dispositionForMime(mime = '') {
  if (!mime) return 'attachment';
  if (mime.startsWith('image/') || mime.startsWith('video/') || mime.startsWith('audio/')) {
    return 'inline';
  }
  return 'attachment';
}

function signInlineUrl(id, exp, cid) {
  return crypto
    .createHmac('sha256', SIGNING_SECRET)
    .update(`${id}.${exp}.${cid}`)
    .digest('hex');
}

function timingSafeEqual(a, b) {
  try {
    const ba = Buffer.from(String(a));
    const bb = Buffer.from(String(b));
    if (ba.length !== bb.length) return false;
    return crypto.timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function normalizeOwnerType(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const lower = raw.toLowerCase();
  return lower === 'chatmessage' ? 'chatMessage' : lower;
}

module.exports.upload = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new ApplicationError('Company context required', 403);
    }
    if (!req.file) {
      throw new ApplicationError('VALIDATION_ERROR: file is required', 400);
    }

    const ownerType = normalizeOwnerType(req.body?.ownerType);
    const ownerId = String(req.body?.ownerId || '').trim();
    const purpose = String(req.body?.purpose || 'file').trim().toLowerCase();
    const visibility = String(req.body?.visibility || 'private').trim().toLowerCase();

    const data = await fileService.createFromUpload({
      file: req.file,
      ownerType,
      ownerId,
      purpose,
      visibility,
      companyId: user.companyId,
      user,
    });

    res.status(201).json({ data });
  } catch (err) {
    if (req.file?.path) {
      try { await fsp.unlink(req.file.path); } catch {}
    }
    next(err);
  }
};

module.exports.list = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new ApplicationError('Company context required', 403);
    }

    const { ownerType, ownerId, purpose } = req.query || {};

    const data = await fileService.list({
      companyId: user.companyId,
      user,
      ownerType: ownerType ? normalizeOwnerType(ownerType) : undefined,
      ownerId: ownerId ? String(ownerId) : undefined,
      purpose: purpose ? String(purpose) : undefined,
    });

    res.json({ data });
  } catch (err) {
    next(err);
  }
};

module.exports.signedUrl = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new ApplicationError('Company context required', 403);
    }

    const { id } = req.params;
    if (!id) throw new ApplicationError('VALIDATION_ERROR: id required', 400);

    const row = await fileService.getPrivateForDownload({
      companyId: user.companyId,
      user,
      id,
    });

    if (row.visibility === 'public') {
      throw new ApplicationError('VALIDATION_ERROR: public files use /api/public-files', 400);
    }
    if (!row.mime || !INLINE_PREVIEW_MIME.has(row.mime)) {
      throw new ApplicationError('VALIDATION_ERROR: inline preview not allowed for this mime', 415);
    }

    const expiresInSec = Math.max(60, Number(SIGNED_URL_TTL_SEC || 86400));
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const cid = user.companyId;
    const sig = signInlineUrl(id, exp, cid);

    res.json({
      data: {
        url: `/api/files/${id}/inline?exp=${exp}&cid=${encodeURIComponent(
          cid
        )}&sig=${sig}`,
        expiresInSec,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.signedDownload = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new ApplicationError('Company context required', 403);
    }

    const { id } = req.params;
    if (!id) throw new ApplicationError('VALIDATION_ERROR: id required', 400);

    const row = await fileService.getPrivateForDownload({
      companyId: user.companyId,
      user,
      id,
    });

    if (row.visibility === 'public') {
      throw new ApplicationError('VALIDATION_ERROR: public files use /api/public-files', 400);
    }

    const expiresInSec = Math.max(60, Number(SIGNED_URL_TTL_SEC || 86400));
    const exp = Math.floor(Date.now() / 1000) + expiresInSec;
    const cid = user.companyId;
    const sig = signInlineUrl(id, exp, cid);

    res.json({
      data: {
        url: `/api/files/${id}/download-inline?exp=${exp}&cid=${encodeURIComponent(
          cid
        )}&sig=${sig}`,
        expiresInSec,
      },
    });
  } catch (err) {
    next(err);
  }
};

module.exports.downloadPrivate = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new ApplicationError('Unauthorized', 401);
    }

    const { id } = req.params;
    const row = await fileService.getPrivateForDownload({
      companyId: user.companyId,
      user,
      id,
    });

    const absPath = absolutePath(row.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new ApplicationError('File missing', 404);
    }

    res.setHeader('Content-Type', row.mime);
    res.setHeader(
      'Content-Disposition',
      `${dispositionForMime(row.mime)}; filename="${encodeURIComponent(row.filename)}"`
    );

    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports.inline = async (req, res, next) => {
  try {
    const { id, exp, cid } = parseSignedQuery(req);

    const row = await File.findByPk(id);
    if (!row || row.deletedAt) {
      throw new ApplicationError('File not found', 404);
    }
    if (String(row.companyId) !== String(cid)) {
      throw new ApplicationError('Unauthorized', 403);
    }
    if (row.visibility === 'public') {
      throw new ApplicationError('VALIDATION_ERROR: public files use /api/public-files', 400);
    }
    if (!row.mime || !INLINE_PREVIEW_MIME.has(row.mime)) {
      throw new ApplicationError('VALIDATION_ERROR: inline preview not allowed for this mime', 415);
    }

    const absPath = absolutePath(row.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new ApplicationError('File missing', 404);
    }

    res.setHeader('Content-Type', row.mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(row.filename)}"`
    );
    res.setHeader('Cache-Control', `private, max-age=${Math.max(0, exp - Math.floor(Date.now() / 1000))}`);

    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports.downloadInline = async (req, res, next) => {
  try {
    const { id, exp, cid } = parseSignedQuery(req);

    const row = await File.findByPk(id);
    if (!row || row.deletedAt) {
      throw new ApplicationError('File not found', 404);
    }
    if (String(row.companyId) !== String(cid)) {
      throw new ApplicationError('Unauthorized', 403);
    }
    if (row.visibility === 'public') {
      throw new ApplicationError('VALIDATION_ERROR: public files use /api/public-files', 400);
    }

    const absPath = absolutePath(row.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new ApplicationError('File missing', 404);
    }

    res.setHeader('Content-Type', row.mime);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(row.filename)}"`
    );
    res.setHeader('Cache-Control', `private, max-age=${Math.max(0, exp - Math.floor(Date.now() / 1000))}`);

    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports.downloadPublic = async (req, res, next) => {
  try {
    const { publicKey } = req.params;
    if (!publicKey) throw new ApplicationError('File not found', 404);

    const row = await fileService.getPublicForDownload({ publicKey: String(publicKey) });
    const absPath = absolutePath(row.storagePath);
    if (!fs.existsSync(absPath)) {
      throw new ApplicationError('File missing', 404);
    }

    res.setHeader('Content-Type', row.mime);
    res.setHeader(
      'Content-Disposition',
      `${dispositionForMime(row.mime)}; filename="${encodeURIComponent(row.filename)}"`
    );

    fs.createReadStream(absPath).pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports.remove = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user || !user.companyId) {
      throw new ApplicationError('Company context required', 403);
    }

    const { id } = req.params;
    await fileService.remove({ companyId: user.companyId, user, id });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
