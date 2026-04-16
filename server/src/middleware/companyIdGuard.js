'use strict';

const AppError = require('../errors/AppError');

// Блокирует попытки передать companyId с клиента (body/query/params), чтобы контекст не подменяли вручную.
module.exports.companyIdGuard = (req, res, next) => {
  try {
    const hasBody = req.body && Object.prototype.hasOwnProperty.call(req.body, 'companyId');
    const hasQuery = req.query && Object.prototype.hasOwnProperty.call(req.query, 'companyId');
    const hasParams = req.params && Object.prototype.hasOwnProperty.call(req.params, 'companyId');

    if (hasBody || hasQuery || hasParams) {
      return next(
        new AppError(400, 'VALIDATION_ERROR: companyId is not allowed in request', {
          code: 'VALIDATION_ERROR',
        })
      );
    }

    next();
  } catch (e) {
    next(e);
  }
};
