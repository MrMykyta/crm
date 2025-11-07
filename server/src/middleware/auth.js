// middleware/auth.js
'use strict';

const { verifyAccess } = require('../utils/tokenService');
const { getPermissionsAndRole } = require('./permissionResolver'); // ← берём новый резолвер
const TokenError = require('../errors/TokenError');

module.exports.auth = async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    console.log('[auth] hdr', hdr,'[auth] token:', token);
    if (!token) throw new TokenError('No token');

    const payload = await verifyAccess(token);
    const userId = payload.sub;
    const companyId = payload.cid || null;

    // Значения по умолчанию (вне контекста компании)
    let role = 'user';
    let permissions = { allow: [], deny: [] };
    let membership = null;

    if (userId && companyId) {
      const ctx = await getPermissionsAndRole({ userId, companyId });
      role = ctx.role || 'user';
      permissions = ctx.permissions || { allow: [], deny: [] };
      membership = ctx.membership || null;
    }

    req.user = { id: userId, role, permissions, membership };
    req.companyId = companyId;

    // опционально, оставить на время отладки:
    //  console.log('[auth]', { userId, role, companyId, allow: permissions.allow.length, deny: permissions.deny.length, permissions: permissions.allow });

    next();
  } catch (e) {
    // не светим детали наружу, но не ломаем поток
    next(new TokenError('error token'));
  }
};