const AppError = require('./AppError');

// Ошибка неверного пароля (HTTP 406).
class UncorrectPassword extends AppError {
  constructor (message) {
    super(406, message || 'uncorrect password');
  }
}

module.exports = UncorrectPassword;
