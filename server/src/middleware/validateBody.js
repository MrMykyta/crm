'use strict';

const validate = require('./validate');

// Специализация validate() для проверки тела запроса.
module.exports = function validateBody(schema, options = {}) {
  return validate(schema, 'body', options);
};
