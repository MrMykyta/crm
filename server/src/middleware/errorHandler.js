'use strict';

const multer = require('multer');
const AppError = require('../errors/AppError');
const logger = require('../lib/logger');
const { fail } = require('../http/response');

const isProd = process.env.NODE_ENV === 'production';

// Приводит статус ошибки к валидному HTTP-коду (400-599), иначе отдаёт 500.
function normalizeStatus(err) {
  const candidates = [err?.statusCode, err?.status, err?.code];
  let statusCode = 500;
  for (const value of candidates) {
    const parsed = Number(value);
    if (parsed >= 400 && parsed <= 599) {
      statusCode = parsed;
      break;
    }
  }

  if (statusCode >= 400 && statusCode <= 599) {
    return statusCode;
  }
  return 500;
}

// Подбирает безопасный текст ошибки (в production скрывает внутренние детали для 500).
function normalizeMessage(err, statusCode) {
  if (statusCode === 500 && isProd) {
    return 'Internal server error';
  }
  return err?.message || 'Internal server error';
}

// Извлекает машиночитаемый код ошибки, если он задан строкой.
function normalizeCode(err) {
  if (!err) return undefined;
  const code = err.code;
  if (typeof code === 'string' && code.trim()) {
    return code.trim();
  }
  return undefined;
}

// Единая обработка ошибок API: логирование + нормализованный JSON-ответ.
module.exports = (err, req, res, _next) => {
  const statusCode = normalizeStatus(err);
  const code = normalizeCode(err);

  logger.error('HTTP request failed', {
    requestId: req?.requestId || null,
    method: req?.method || null,
    url: req?.originalUrl || req?.url || null,
    statusCode,
    code: code || null,
    errorName: err?.name || 'Error',
    errorMessage: err?.message || 'Unknown error',
    ...(isProd ? {} : { stack: err?.stack || null }),
  });

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return fail(res, 413, 'File too large', undefined, 'UPLOAD_FILE_TOO_LARGE');
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      return fail(res, 415, 'Unsupported file type', undefined, 'UPLOAD_UNSUPPORTED_FILE');
    }
    return fail(res, 400, err.message || 'Upload error', undefined, 'UPLOAD_ERROR');
  }

  if (err?.name === 'FetchError' || /fetch/i.test(String(err?.message || ''))) {
    return fail(res, 502, 'Failed to fetch remote file', undefined, 'FETCH_ERROR');
  }

  if (err instanceof AppError) {
    return fail(res, statusCode, normalizeMessage(err, statusCode), {
      code,
      details: err.details,
    });
  }

  const details = !isProd && err?.stack ? { stack: err.stack } : undefined;
  return fail(res, statusCode, normalizeMessage(err, statusCode), {
    code,
    details,
  });
};
