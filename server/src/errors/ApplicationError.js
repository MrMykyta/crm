'use strict';

const AppError = require('./AppError');

// Deprecated compatibility layer: use AppError directly for new code.
class ApplicationError extends AppError {
  // Совместимая обёртка над AppError для старого кода.
  constructor(message, status, code, details) {
    super(
      status || 500,
      message || 'Something went wrong. Please try again',
      { code, details }
    );
  }
}

module.exports = ApplicationError;
