const Joi = require('joi');

module.exports = (schema, options = {}) => {
  const defaultOpts = { abortEarly: false, stripUnknown: true, convert: true };
  const opts = { ...defaultOpts, ...options };

  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, opts);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(d => d.message),
      });
    }
    req.query = value;
    next();
  };
};
