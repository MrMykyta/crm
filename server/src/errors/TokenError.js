const AppError = require('./AppError');

// Ошибка авторизации/токена (HTTP 401).
class TokenError extends AppError {
  constructor (message) {
    super(401, message || 'Unauthorized', { code: 'UNAUTHORIZED' });
  }
}

module.exports = TokenError;
