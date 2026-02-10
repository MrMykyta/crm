// services/system/invitationService.js
'use strict';
const { Invitation, User, UserCompany, sequelize } = require('../../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');            // ← добавили
const mailer = require('./mailer');
const { parsePagination, packResult, applyCommonFilters } = require('../../utils/pagination');

const INVITE_TTL_DAYS = Number(process.env.INVITE_TTL_DAYS || 7);
const SORT_WHITELIST = ['createdAt', 'updatedAt', 'email', 'status', 'role'];

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ACCESS_TTL = process.env.JWT_ACCESS_TTL || '1h';
const REFRESH_TTL = process.env.JWT_REFRESH_TTL || '30d';

function genToken() {
  return crypto.randomBytes(24).toString('hex');
}
function expiresAtFromNow() {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 3600 * 1000);
}
function inviteLink(token) {
  const base = process.env.APP_URL || 'http://localhost:3000';
  return `${base}/invite/accept?token=${encodeURIComponent(token)}`;
}
async function sendInviteEmail({ to, token, repeat = false, companyName, invitedByName }) {
  const link = inviteLink(token);
  const subj = repeat ? 'Приглашение в компанию (повтор)' : 'Приглашение в компанию';
  const who = invitedByName ? `${invitedByName}` : 'Пользователь';
  const comp = companyName ? `в «${companyName}»` : 'в рабочее пространство';

  const html = `
  <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:20px;color:#2b2b2b">
    <h2 style="color:#333;margin-bottom:16px">${subj}</h2>
    <p style="margin-bottom:8px">${who} приглашает вас ${comp}.</p>
    <p style="margin-bottom:24px">Нажмите кнопку ниже, чтобы присоединиться. Ссылка действует ${INVITE_TTL_DAYS} дн.</p>

    <p style="text-align:center;margin:32px 0">
      <a href="${link}" target="_blank"
        style="display:inline-block;padding:12px 22px;
               background:#4b7aff;color:#fff;border-radius:8px;text-decoration:none;
               font-weight:bold;font-size:15px;">
        Присоединиться
      </a>
    </p>

    <p style="margin-top:24px;font-size:13px;color:#666">
      Если кнопка не работает, скопируйте и вставьте эту ссылку в браузер:<br>
      <a href="${link}" target="_blank" style="color:#4b7aff">${link}</a>
    </p>

    <p style="margin-top:32px;font-size:12px;color:#999">
      Если вы не ожидали это письмо — просто проигнорируйте его.
    </p>
  </div>`;
  await mailer.sendMail({ to, subject: subj, html });
}

function buildUserDTO(u) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName || null,
    lastName: u.lastName || null,
    avatarUrl: u.avatarUrl || null,
    isActive: !!u.isActive,
  };
}

function signTokens(userId, companyId) {
  const accessToken = jwt.sign(
    { sub: String(userId), companyId: String(companyId) },
    JWT_SECRET,
    { expiresIn: ACCESS_TTL }
  );
  const refreshToken = jwt.sign(
    { sub: String(userId), type: 'refresh' },
    JWT_SECRET,
    { expiresIn: REFRESH_TTL }
  );
  return { accessToken, refreshToken };
}

/** === list === */
module.exports.list = async (companyId, query = {}) => {
  const parsed = parsePagination(query, {
    sortWhitelist: SORT_WHITELIST,
    defaultSort: 'createdAt',
    defaultDir: 'DESC',
    defaultLimit: 25,
    maxLimit: 100,
  });

  const where = { companyId };
  if (query.status) where.status = query.status;
  applyCommonFilters(where, parsed, ['email', 'firstName', 'lastName']);

  const data = await Invitation.findAndCountAll({
    where,
    order: [[parsed.sort, parsed.dir]],
    limit: parsed.limit,
    offset: parsed.offset,
    distinct: true,
  });

  return packResult(data, parsed);
};

/** === create === */
module.exports.create = async (user, company, body) => {
  const { email, firstName, lastName, role = 'viewer' } = body;
  if (!email) throw new Error('email required');

  const token = genToken();
  const inv = await Invitation.create({
    companyId: company.id,
    email: email.toLowerCase(),
    firstName,
    lastName,
    role,
    invitedBy: user.id,
    token,
    expiresAt: expiresAtFromNow(),
    status: 'pending',
  });
  console.log(company.name)
  // Отправка письма не должна блокировать ответ (чтобы UI не зависал).
  sendInviteEmail({
    to: email,
    token,
    companyName: company.name,
  }).catch((e) => {
    console.error('[INVITE mail failed]', e?.message || e);
  });

  return inv;
};

/** === resend === */
module.exports.resend = async (id, companyName, invitedByName) => {
  const inv = await Invitation.findByPk(id);
  if (!inv || inv.status !== 'pending') throw new Error('not found or not pending');
  inv.token = genToken();
  inv.expiresAt = expiresAtFromNow();
  await inv.save();
  // Отправка письма не должна блокировать ответ (чтобы UI не зависал).
  sendInviteEmail({ to: inv.email, token: inv.token, repeat: true, companyName, invitedByName })
    .catch((e) => {
      console.error('[INVITE resend mail failed]', e?.message || e);
    });
  return { ok: true };
};

/** === revoke === */
module.exports.revoke = async (id) => {
  const inv = await Invitation.findByPk(id);
  if (!inv || inv.status !== 'pending') throw new Error('not found or not pending');
  inv.status = 'revoked';
  await inv.save();
  return { ok: true };
};

/** === check (публично для /invitations/check) === */
module.exports.checkByToken = async (token) => {
  const inv = await Invitation.findOne({ where: { token } });
  if (!inv) throw new Error('not_found');

  const now = new Date();
  let status = inv.status;

  if (inv.status === 'pending' && new Date(inv.expiresAt) < now) {
    inv.status = 'expired';
    await inv.save();
    status = 'expired';
  }

  // 🔹 проверяем, есть ли уже пользователь с таким email
  const user = await User.findOne({
    where: { email: inv.email.toLowerCase() },
    attributes: ['id', 'firstName', 'lastName'],
  });

  return {
    status,
    email: inv.email,
    firstName: inv.firstName,
    lastName: inv.lastName,
    companyId: inv.companyId,
    expiresAt: inv.expiresAt,
    userExists: !!user,                     // ← вот это важно для фронта
    existingUser: user ? {
      id: user.id,
      firstName: user.firstName || '',
      lastName:  user.lastName  || '',
    } : null,
  };
};

/** === accept с авто-логином === */
module.exports.accept = async (token, password, patch = {}) => {
  const inv = await Invitation.findOne({ where: { token } });
  if (!inv) throw new Error('bad token');
  if (inv.status !== 'pending') throw new Error('already processed');
  if (new Date(inv.expiresAt) < new Date()) {
    inv.status = 'expired'; await inv.save(); throw new Error('expired');
  }

  let outUser, outCompanyId;

  await sequelize.transaction(async (t) => {
    let user = await User.findOne({ where: { email: inv.email.toLowerCase() }, transaction: t });

    if (!user) {
      if (!password) throw new Error('password_required');
      const hash = await bcrypt.hash(password, 12);
      user = await User.create({
        email: inv.email.toLowerCase(),
        passwordHash: hash,
        firstName: patch.firstName ?? inv.firstName ?? null,
        lastName:  patch.lastName  ?? inv.lastName  ?? null,
        isActive: true,
      }, { transaction: t });
    } else {
      const next = {};
      if (patch.firstName != null && patch.firstName !== user.firstName) next.firstName = patch.firstName;
      if (patch.lastName  != null && patch.lastName  !== user.lastName)  next.lastName  = patch.lastName;
      if (Object.keys(next).length) await user.update(next, { transaction: t });
      if (user.isActive !== true) await user.update({ isActive: true }, { transaction: t });
    }

    // 🔧 ИЩЕМ membership С УЧЁТОМ SOFT-DELETED
    let mem = await UserCompany.findOne({
      where: { userId: user.id, companyId: inv.companyId },
      transaction: t,
      paranoid: false,    // ← видим даже удалённые
    });

    if (!mem) {
      // не было никогда — создаём
      mem = await UserCompany.create({
        userId: user.id,
        companyId: inv.companyId,
        role: inv.role,
        status: 'active',
      }, { transaction: t });
    } else {
      // было — возможно soft-deleted
      if (mem.deletedAt) {
        await mem.restore({ transaction: t });
      }
      mem.status = 'active';
      mem.role = inv.role;
      await mem.save({ transaction: t });
    }

    inv.status = 'accepted';
    inv.acceptedAt = new Date();
    await inv.save({ transaction: t });

    outUser = user;
    outCompanyId = inv.companyId;
  });

  const { accessToken, refreshToken } = signTokens(outUser.id, outCompanyId);

  return {
    ok: true,
    accessToken,
    refreshToken,
    user: buildUserDTO(outUser),
    companyId: outCompanyId,
  };
};
