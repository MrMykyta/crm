'use strict';

// Оборачивает async-обработчик и автоматически передаёт ошибки в next().
module.exports = function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
};
