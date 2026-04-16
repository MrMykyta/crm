'use strict';

// Базовый класс операционных ошибок приложения.
// Нормализует HTTP-статус, сообщение, код и дополнительные детали.
class AppError extends Error {
  // Поддерживает как новый формат (status, message, { code, details }),
  // так и legacy-сигнатуру, где code/details передавались отдельными аргументами.
  constructor(statusCode, message, options = undefined, legacyDetails = undefined) {
    const normalizedStatus =
      Number(statusCode) >= 400 && Number(statusCode) <= 599
        ? Number(statusCode)
        : Number(message) >= 400 && Number(message) <= 599
          ? Number(message)
          : 500;

    const normalizedMessage =
      typeof message === 'string'
        ? message
        : typeof statusCode === 'string'
          ? statusCode
          : 'Internal server error';

    super(normalizedMessage);
    Error.captureStackTrace(this, this.constructor);
    this.name = this.constructor.name;
    this.statusCode = normalizedStatus;
    this.isOperational = true;

    const hasOptionsObject =
      options &&
      typeof options === 'object' &&
      !Array.isArray(options);

    const code = hasOptionsObject ? options.code : options;
    const details = hasOptionsObject ? options.details : legacyDetails;

    if (typeof code !== 'undefined' && code !== null) {
      this.code = code;
    }

    if (typeof details !== 'undefined') {
      this.details = details;
    }
  }
}

module.exports = AppError;
