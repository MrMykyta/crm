'use strict';

const AppError = require('../errors/AppError');

// Валидирует req.body/req.query по Joi-схеме и прокидывает нормализованную ошибку в AppError.
module.exports = function validate(schema, source = 'body', options = {}) {
  const defaultOptions = {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  };
  const merged = { ...defaultOptions, ...options };

  return (req, _res, next) => {
    const target = req[source] || {};
    const { error, value } = schema.validate(target, merged);

    if (error) {
      return next(
        new AppError(
          400,
          'Validation failed',
          {
            code: 'VALIDATION_ERROR',
            details: error.details.map((d) => d.message),
          }
        )
      );
    }

    if (source === 'query') {
      req.validatedQuery = value;
      if (req.query && typeof req.query === 'object') {
        Object.keys(req.query).forEach((key) => {
          delete req.query[key];
        });
        Object.assign(req.query, value);
      }
      return next();
    }

    req[source] = value;
    return next();
  };
};
