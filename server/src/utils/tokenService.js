const jwt = require('jsonwebtoken');
const { randomBytes } = require('crypto');
const dayjs = require('dayjs');
const { RefreshToken } = require('../models');

const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '15m';

// приоритет часов, fallback — дни (для обратной совместимости)
const REFRESH_TTL_HOURS = Number(process.env.JWT_REFRESH_TTL_HOURS || 0);
const REFRESH_TTL_DAYS  = Number(process.env.JWT_REFRESH_TTL_DAYS  || 0);
const REFRESH_TTL_MS =
  REFRESH_TTL_HOURS > 0
    ? REFRESH_TTL_HOURS * 60 * 60 * 1000
    : (REFRESH_TTL_DAYS  > 0 ? REFRESH_TTL_DAYS  * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000); // по умолчанию 30 дней

const REFRESH_EXPIRES_IN_STR =
  REFRESH_TTL_HOURS > 0
    ? `${REFRESH_TTL_HOURS}h`
    : (REFRESH_TTL_DAYS  > 0 ? `${REFRESH_TTL_DAYS}d` : '30d');

const JWT_ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (process.env.JWT_SECRET + '_r');

function newJti() {
  return randomBytes(16).toString('hex'); // 32 символа
}

async function verifyRefresh(token) {
  const payload = jwt.verify(token, JWT_REFRESH_SECRET);
  const row = await RefreshToken.findOne({ where: { jti: payload.jti } });
  if (!row) throw new Error('Refresh token not found');
  if (row.revoked_at) throw new Error('Refresh token revoked');

  // учитываем snake/camel поля — берём, что есть
  const expiresAt = row.expires_at || row.expiresAt;
  if (dayjs(expiresAt).isBefore(dayjs())) {
    throw new Error('Refresh token expired');
  }
  return payload; // { sub, jti, iat, exp }
}

function signAccessToken({ userId, activeCompanyId }) {
  const payload = { sub: userId, cid: activeCompanyId || null };
  return jwt.sign(payload, JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

async function issueRefreshToken({ userId, userAgent, ip }) {
  const jti = newJti();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);

  await RefreshToken.create({
    userId,
    jti,
    expiresAt,                // если модель с underscored: Sequelize сам сохранит в expires_at
    userAgent: userAgent || null,
    ip: ip || null,
  });

  const payload = { sub: userId, jti };
  const token = jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES_IN_STR });
  return { token, jti, expiresAt };
}

async function verifyAccess(token) {
  return jwt.verify(token, JWT_ACCESS_SECRET);
}

async function rotateRefresh(oldToken, companyId, meta = {}) {
  const payload = await verifyRefresh(oldToken);
  const current = await RefreshToken.findOne({ where: { jti: payload.jti } });
  if (!current) throw new Error('Refresh token not found');

  const newId = newJti();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  console.log('Refresh token expires:', expiresAt)
  await current.update({ revoked_at: new Date(), replaced_by: newId });

  await RefreshToken.create({
    userId: payload.sub,
    jti: newId,
    expiresAt,
    userAgent: meta.userAgent || current.userAgent,
    ip: meta.ip || current.ip,
  });

  const newRefresh = jwt.sign({ sub: payload.sub, jti: newId }, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES_IN_STR,
  });
  const newAccess = signAccessToken({ userId: payload.sub, activeCompanyId: companyId });

  return { accessToken: newAccess, refreshToken: newRefresh, expiresAt, userId: payload.sub };
}

module.exports.revokeRefresh = async (tokenOrJti) => {
  const jti =
    tokenOrJti.length > 40
      ? jwt.verify(tokenOrJti, JWT_REFRESH_SECRET).jti
      : tokenOrJti;
  const row = await RefreshToken.findOne({ where: { jti } });
  if (!row) return false;
  await row.update({ revoked_at: new Date() });
  return true;
};

module.exports.revokeAllUserRefresh = async (userId) => {
  await RefreshToken.update(
    { revoked_at: new Date() },
    { where: { user_id: userId, revoked_at: null } }
  );
};

module.exports = {
  signAccessToken,
  issueRefreshToken,
  rotateRefresh,
  verifyAccess,
};