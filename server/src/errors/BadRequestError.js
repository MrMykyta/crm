const AppError = require('./AppError');

// Ошибка валидации входных данных (HTTP 400).
class BadRequestError extends AppError {
  constructor (message) {
    super(400, message || 'bad request');
  }
}

module.exports = BadRequestError;
