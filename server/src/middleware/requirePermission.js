'use strict';

const authorize = require('./authorize');

// Упрощённый алиас над authorize() для проверки одного permission-а.
module.exports = function requirePermission(permission) {
  return authorize(permission);
};
