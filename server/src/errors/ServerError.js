const AppError = require('./AppError');

// Общая серверная ошибка (HTTP 500).
class ServerError extends AppError {
  constructor (message) {
    super(500, message || 'server error');
  }
}

module.exports = ServerError;
