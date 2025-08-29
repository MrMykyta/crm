const Joi = require('joi');

module.exports = (schema, options = {}) => {
  // По умолчанию: собираем все ошибки, режем лишние поля
  const defaultOpts = { abortEarly: false, stripUnknown: true, convert: true };
  const opts = { ...defaultOpts, ...options };

  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, opts);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message),
      });
    }
    req.body = value;
    next();
  };
};
