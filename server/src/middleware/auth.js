const { verifyAccess } = require('../utils/tokenService');
const { getPermissions } = require('./permissionResolver');

module.exports.auth = async (req, res, next) => {
  try {
    const hdr = req.headers.authorization || '';
    const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : null;

    if (!token) {
      throw new Error('No token');
    }

    const payload = await verifyAccess(token);
    const userId = payload.sub;  // id пользователя
    const companyId = payload.cid; // id компании (может быть undefined/null)

    let permissions = [];

    if (userId && companyId) {
      // пользователь в контексте компании → подтягиваем его права
      permissions = await getPermissions({ userId, companyId });
    }

    const role = permissions.role || 'user';

    // если userId есть, а companyId нет — значит он просто зарегистрирован
    // и пока без прав и компании
    req.user = { id: userId, role, permissions };
    req.companyId = companyId || null;

    console.log('[auth]', `User ${userId} authenticated with role ${role} and company ${companyId || 'None'}  `);

    next();
  } catch (e) {
    console.error('[auth]', e);
    next(new Error('error token'));
  }
};
