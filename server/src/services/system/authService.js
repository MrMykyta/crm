const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const userService = require('../crm/userService');
const { User } = require('../../models');
const mailer = require('./mailer');
const tokenService = require('../../utils/tokenService');

const VERIF_TTL_HOURS = 24;

function makeToken() {
  return crypto.randomBytes(32).toString('hex'); // 64 символа
}

module.exports.register = async ({ email, password, firstName, lastName }, meta={}) => {
  // создай пользователя (хеш пароля оставь как в проекте)
  const verificationToken = makeToken();
  const expiresAt = new Date(Date.now() + VERIF_TTL_HOURS * 3600 * 1000);
  const { accessToken, refreshToken } = await userService.register(
    { email, password, firstName, lastName, verificationToken, expiresAt},
    { userAgent: meta.userAgent, ip: meta.ip }
  );
  

  const link = `${process.env.APP_URL}/auth/verify?token=${verificationToken}`;
  await mailer.sendMail({
    to: email,
    subject: 'Подтверждение регистрации',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;color:#2b2b2b">
      <h2 style="color:#333;margin-bottom:16px">Подтвердите email</h2>
      <p style="margin-bottom:24px">Нажмите кнопку ниже, чтобы активировать аккаунт. Ссылка действует 24 часа.</p>
      
      <p style="text-align:center;margin:32px 0">
        <a href="${link}" target="_blank"
           style="display:inline-block;padding:12px 22px;
                  background:#4b7aff;color:#fff;
                  border-radius:8px;text-decoration:none;
                  font-weight:bold;font-size:15px;">
          Подтвердить email
        </a>
      </p>

      <p style="margin-top:24px;font-size:13px;color:#666">
        Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
        <a href="${link}" target="_blank" style="color:#4b7aff">${link}</a>
      </p>

      <p style="margin-top:32px;font-size:12px;color:#999">
        Если вы не регистрировались — просто проигнорируйте это письмо.
      </p>
    </div>
    `
  });

  return { accessToken, refreshToken };
};

module.exports.resendVerificationMail = async (email) => {
  const safeEmail = String(email || '').trim().toLowerCase();
  if (!safeEmail) return { ok: true };

  const user = await User.findOne({ where: { email: safeEmail } });
  // Не раскрываем существование и статус: всегда отвечаем ok
  if (!user) return { ok: true };
  if (user.emailVerifiedAt) return { ok: true };

  const now = new Date();

  // В проекте поле могло называться по-разному — подстрахуемся
  let token = user.verificationToken;
  let expiresAt = user.verificationExpiresAt || user.expiresAt;

  const stillValid = token && expiresAt && new Date(expiresAt) > now;

  if (!stillValid) {
    token = makeToken();
    expiresAt = new Date(now.getTime() + VERIF_TTL_HOURS * 3600 * 1000);

    await user.update({
      verificationToken: token,
      verificationExpiresAt: expiresAt, // основное поле
      expiresAt,                        // на случай, если где-то используется старое имя
    });
  }

  const link = `${process.env.APP_URL}/auth/verify?token=${token}`;

  await mailer.sendMail({
    to: safeEmail,
    subject: 'Подтверждение регистрации',
    html: `
       <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;color:#2b2b2b">
      <h2 style="color:#333;margin-bottom:16px">Подтвердите email</h2>
      <p style="margin-bottom:24px">Нажмите кнопку ниже, чтобы активировать аккаунт. Ссылка действует 24 часа.</p>
      
      <p style="text-align:center;margin:32px 0">
        <a href="${link}" target="_blank"
           style="display:inline-block;padding:12px 22px;
                  background:#4b7aff;color:#fff;
                  border-radius:8px;text-decoration:none;
                  font-weight:bold;font-size:15px;">
          Подтвердить email
        </a>
      </p>

      <p style="margin-top:24px;font-size:13px;color:#666">
        Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
        <a href="${link}" target="_blank" style="color:#4b7aff">${link}</a>
      </p>

      <p style="margin-top:32px;font-size:12px;color:#999">
        Если вы не регистрировались — просто проигнорируйте это письмо.
      </p>
    </div>
    `,
  });

  return { ok: true };
};

module.exports.verifyEmail = async (token) => {
  console.log('verifyEmail', token);
  const u = await User.findOne({ where: { verificationToken: token } });
  if (!u) throw new Error('Invalid token');
  if (!u.verificationExpiresAt || u.verificationExpiresAt < new Date()) {
    throw new Error('Token expired');
  }
  await u.update({
    emailVerifiedAt: new Date(),
    verificationToken: null,
    verificationExpiresAt: null
  });
  const accessToken = tokenService.signAccessToken({ userId: u.id });
  const { token: refreshToken } = await tokenService.issueRefreshToken({
      userId: u.id
    });
  return { ok: true, accessToken, refreshToken };
};