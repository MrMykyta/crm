'use strict';

const ApplicationError = require('../errors/ApplicationError');

module.exports.companyIdGuard = (req, res, next) => {
  try {
    const hasBody = req.body && Object.prototype.hasOwnProperty.call(req.body, 'companyId');
    const hasQuery = req.query && Object.prototype.hasOwnProperty.call(req.query, 'companyId');
    const hasParams = req.params && Object.prototype.hasOwnProperty.call(req.params, 'companyId');

    if (hasBody || hasQuery || hasParams) {
      return next(new ApplicationError('VALIDATION_ERROR: companyId is not allowed in request', 400));
    }

    next();
  } catch (e) {
    next(e);
  }
};
