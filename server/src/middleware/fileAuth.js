'use strict';

const ApplicationError = require('../errors/ApplicationError');
const { verifyAccess } = require('../utils/tokenService');
const { getPermissionsAndRole } = require('./permissionResolver');

// Auth for file download: supports Authorization header OR ?token=... (for <img src>)
module.exports = async (req, _res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const bearer = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;
    const token = bearer || (req.query?.token ? String(req.query.token) : null);

    if (!token) {
      return next(new ApplicationError('Unauthorized', 401));
    }

    const payload = await verifyAccess(token);
    const userId = payload.sub;
    const companyId = payload.cid || null;

    if (!userId || !companyId) {
      return next(new ApplicationError('Unauthorized', 401));
    }

    const ctx = await getPermissionsAndRole({ userId, companyId });
    req.user = {
      id: userId,
      role: ctx.role || 'user',
      permissions: ctx.permissions || { allow: [], deny: [] },
      membership: ctx.membership || null,
      companyId,
    };

    return next();
  } catch (e) {
    return next(new ApplicationError('Unauthorized', 401));
  }
};
