'use strict';

const validate = require('./validate');

// Специализация validate() для проверки query-параметров.
module.exports = function validateQuery(schema, options = {}) {
  return validate(schema, 'query', options);
};
