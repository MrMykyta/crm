const AppError = require('./AppError');

// Ошибка уникальности email (HTTP 409 Conflict).
class NotUniqueEmail extends AppError {
  constructor (message) {
    super(409, message || 'this email were already exist');
  }
}

module.exports = NotUniqueEmail;
