const AppError = require('./AppError');

// Ошибка загрузки файла (HTTP 409).
class ServerError extends AppError {
  constructor (message) {
    super(409, message || 'upload error');
  }
}

module.exports = ServerError;
