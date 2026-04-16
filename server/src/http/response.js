'use strict';

// Отправляет успешный JSON-ответ в формате { data } со статусом 200.
function ok(res, data) {
  return res.status(200).json({ data });
}

// Отправляет успешный JSON-ответ в формате { data } со статусом 201.
function created(res, data) {
  return res.status(201).json({ data });
}

// Отправляет пустой ответ со статусом 204 (без тела).
function noContent(res) {
  return res.status(204).send();
}

// Формирует унифицированный ответ с ошибкой:
// { message, code?, details? }.
// Поддерживает legacy-сигнатуру и объектный формат параметров.
function fail(res, status, message, details, code) {
  const hasOptionsObject =
    details &&
    typeof details === 'object' &&
    !Array.isArray(details) &&
    (Object.prototype.hasOwnProperty.call(details, 'details') ||
      Object.prototype.hasOwnProperty.call(details, 'code'));

  const resolvedDetails = hasOptionsObject ? details.details : details;
  const resolvedCode = hasOptionsObject ? details.code : code;
  const payload = { message };
  if (typeof resolvedCode !== 'undefined' && resolvedCode !== null) {
    payload.code = resolvedCode;
  }
  if (typeof resolvedDetails !== 'undefined') {
    payload.details = resolvedDetails;
  }
  return res.status(status).json(payload);
}

module.exports = {
  ok,
  created,
  noContent,
  fail,
};
