// src/acl/authorize.js
'use strict';
const { check } = require('../acl');
const AppError = require('../errors/AppError');
const logger = require('../lib/logger');

// Проверяет, требуется ли для набора permission-ов company-контекст.
const needsCompany = (required) => {
  const arr = Array.isArray(required) ? required : [required];
  return arr.some(x => /^company:|^member:/.test(String(x)));
};

// Проверяет доступ к маршруту через ACL и возвращает 401/403 при запрете.
module.exports = (required, opts = {}) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return next(new AppError(401, 'Unauthorized', { code: 'UNAUTHORIZED' }));
      }
      if (needsCompany(required) && !req.companyId) {
        return next(
          new AppError(400, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' })
        );
      }

      const ok = await check({
        user: req.user,
        companyId: req.companyId,
        required,
        opts: {
          anyOf:   opts.anyOf,
          allOf:   opts.allOf,
          ownCheck:  opts.ownCheck  ? () => opts.ownCheck(req, req.user)  : undefined,
          deptCheck: opts.deptCheck ? () => opts.deptCheck(req, req.user) : undefined,
        }
      });

      if (!ok) {
        return next(new AppError(403, 'Authorize Forbidden', { code: 'FORBIDDEN' }));
      }
      return next();
    } catch (e) {
      logger.error('[authorize] failed', {
        requestId: req?.requestId || null,
        message: e?.message || 'Unknown error',
      });
      return next(e);
    }
  };
};
