const AppError = require('./AppError');

// Ошибка отсутствия пользователя (HTTP 404).
class UserNotFoundError extends AppError {
  constructor (message) {
    super(404, message || 'user with email not found');
  }
}

module.exports = UserNotFoundError;
