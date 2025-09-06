// src/services/passwordReset.service.js
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { User, PasswordResetTokens } = require('../../models');

const RESET_TTL_HOURS = Number(process.env.PASSWORD_RESET_TTL_HOURS || 24);

function makeRawToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 символа
}
function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function requestReset(email, mailer, meta = {}) {
  // не раскрываем существование пользователя
  const user = await User.findOne({ where: { email } });
  if (!user) return { ok: true };
  // гасим старые токены
  try{
    await PasswordResetTokens.destroy({ where: { userId: user.id } });
  }catch(e){
    console.error('Dont have tokens');
  }

  const raw = makeRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + RESET_TTL_HOURS * 3600 * 1000);

  await PasswordResetTokens.create({
    userId: user.id,
    tokenHash,
    expiresAt,
    ip: meta.ip || null,
    userAgent: meta.userAgent || null,
  });

  const link = `${process.env.APP_URL}/auth/reset?token=${raw}`;
  await mailer.sendMail({
    to: email,
    subject: 'Сброс пароля',
    html: `
      <div style="font-family:Arial,sans-serif">
        <h2>Сброс пароля</h2>
        <p>Нажмите кнопку ниже, чтобы установить новый пароль (ссылка действует ${RESET_TTL_HOURS} ч.):</p>
        <p><a href="${link}" target="_blank" style="display:inline-block;padding:10px 14px;background:#4b7aff;color:#fff;border-radius:8px;text-decoration:none">Сбросить пароль</a></p>
        <p>Если вы не запрашивали сброс — просто проигнорируйте письмо.</p>
      </div>
    `
  });

  return { ok: true };
}

async function resetPassword(rawToken, newPassword) {
  if (!rawToken || !newPassword) {
    const err = new Error('Invalid payload'); err.code = 'BAD_REQUEST'; throw err;
  }
  const tokenHash = hashToken(rawToken);
  const prt = await PasswordResetTokens.findOne({ where: { tokenHash } });
  if (!prt)  { const err = new Error('Invalid or expired token'); err.code = 'INVALID'; throw err; }
  if (prt.usedAt) { const err = new Error('Token already used'); err.code = 'USED'; throw err; }
  if (prt.expiresAt < new Date()) { const err = new Error('Token expired'); err.code = 'EXPIRED'; throw err; }

  const user = await User.findByPk(prt.userId);
  if (!user) { const err = new Error('User not found'); err.code = 'NOT_FOUND'; throw err; }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await user.update({ passwordHash });

  // помечаем использованным и чистим прочие
  await prt.update({ usedAt: new Date() });
  await PasswordResetTokens.destroy({ where: { userId: user.id, tokenHash: { [Op.ne]: tokenHash } } });

  return { ok: true };
}

module.exports = { requestReset, resetPassword };