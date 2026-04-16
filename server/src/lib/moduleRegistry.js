'use strict';

const modules = [];

// Регистрирует модуль по id и mountPath.
// Если модуль с таким id уже есть — обновляет его router/mountPath.
function registerModule(definition) {
  const { id, mountPath, router } = definition || {};

  if (!id || !mountPath || !router) {
    throw new Error('registerModule requires id, mountPath and router');
  }

  const existing = modules.find((m) => m.id === id);
  if (existing) {
    existing.mountPath = mountPath;
    existing.router = router;
    return existing;
  }

  const entry = { id, mountPath, router };
  modules.push(entry);
  return entry;
}

// Монтирует все зарегистрированные модули в Express-приложение под общим префиксом.
function mountAll(app, prefix = '/api') {
  modules.forEach((mod) => {
    app.use(`${prefix}${mod.mountPath}`, mod.router);
  });
}

// Возвращает снимок текущего списка зарегистрированных модулей.
function listModules() {
  return [...modules];
}

module.exports = {
  registerModule,
  mountAll,
  listModules,
};
