const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const dayjs = require('dayjs');
const { RefreshToken } = require('../models');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
const JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '_r');

function newJti() {
  return randomBytes(16).toString('hex'); // 32 символа
}

async function verifyRefresh (token) {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET);
  // проверим jti в БД (не отозван ли, не истёк ли)
  const row = await RefreshToken.findOne({ where: { jti: payload.jti } });
  if (!row) {
    throw new Error('Refresh token not found');
  }
  if (row.revoked_at) {
    throw new Error('Refresh token revoked');
  }
  if (dayjs(row.expires_at).isBefore(dayjs())) {
    throw new Error('Refresh token expired');
  }
  return payload; // { sub, jti, iat, exp }
}


function signAccessToken({ userId, activeCompanyId }){
  const payload = { sub: userId, cid: activeCompanyId || null };
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}


async function issueRefreshToken({ userId, userAgent, ip }){
  const jti = newJti();
  const expiresAt = dayjs().add(REFRESH_TTL_DAYS, 'day').toDate();

  // записываем JTI в БД
  await RefreshToken.create({
    userId,
    jti,
    expiresAt,
    userAgent: userAgent || null,
    ip: ip || null
  });

  const payload = { sub: userId, jti };
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
  return { token, jti, expiresAt };
}

async function verifyAccess(token){
  return jwt.verify(token, JWT_ACCESS_SECRET);
}

async function rotateRefresh(oldToken, meta = {}) {
  const payload = await verifyRefresh(oldToken); // бросит ошибку если недействителен
  const current = await RefreshToken.findOne({ where: { jti: payload.jti } });
  if (!current) {
    throw new Error('Refresh token not found');
  }

  // помечаем старый как отозванный
  const newId = newJti();
  const expiresAt = dayjs().add(REFRESH_TTL_DAYS, 'day').toDate();
  await current.update({ revoked_at: new Date(), replaced_by: newId });

  // создаём новый
  await RefreshToken.create({
    userId: payload.sub,
    jti: newId,
    expiresAt,
    userAgent: meta.userAgent || current.userAgent,
    ip: meta.ip || current.ip
  });

  const newRefresh = jwt.sign({ sub: payload.sub, jti: newId }, JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
  const newAccess = signAccessToken({ userId: payload.sub, activeCompanyId: meta.activeCompanyId });

  return { accessToken: newAccess, refreshToken: newRefresh, expiresAt };
}

module.exports.revokeRefresh = async (tokenOrJti) => {
  const jti = tokenOrJti.length > 40 ? jwt.verify(tokenOrJti, JWT_REFRESH_SECRET).jti : tokenOrJti;
  const row = await RefreshToken.findOne({ where: { jti } });
  if (!row) {
    return false;
  }
  await row.update({ revoked_at: new Date() });
  return true;
}

module.exports.revokeAllUserRefresh = async (userId) => {
  await RefreshToken.update({ revoked_at: new Date() }, { where: { user_id: userId, revoked_at: null } });
}

module.exports = {
  signAccessToken,
  issueRefreshToken,
  rotateRefresh,
  verifyAccess
}