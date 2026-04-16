'use strict';

const { v4: uuidv4 } = require('uuid');
const logger = require('../lib/logger');

// Проставляет requestId и логирует факт завершения HTTP-запроса с базовыми метриками.
module.exports = function requestContext(req, res, next) {
  const requestId = req.headers['x-request-id'] || uuidv4();
  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', req.requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    const elapsedMs = Date.now() - startedAt;
    logger.info('HTTP request completed', {
      requestId: req.requestId,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode: res.statusCode,
      elapsedMs,
      userId: req.user?.id || null,
      companyId: req.companyId || req.user?.companyId || null,
    });
  });

  next();
};
