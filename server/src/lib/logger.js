'use strict';

// Нормализует уровень лога к верхнему регистру для единообразного префикса.
function formatLevel(level) {
  return String(level || 'info').toUpperCase();
}

// Базовый вывод лога с timestamp, уровнем и optional meta-объектом.
function baseLog(consoleMethod, level, message, meta) {
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${formatLevel(level)}]`;
  if (typeof meta === 'undefined') {
    console[consoleMethod](`${prefix} ${message}`);
    return;
  }
  console[consoleMethod](`${prefix} ${message}`, meta);
}

// Выводит информационное сообщение.
function info(message, meta) {
  baseLog('log', 'info', message, meta);
}

// Выводит предупреждение.
function warn(message, meta) {
  baseLog('warn', 'warn', message, meta);
}

// Выводит сообщение об ошибке.
function error(message, meta) {
  baseLog('error', 'error', message, meta);
}

module.exports = {
  info,
  warn,
  error,
};
