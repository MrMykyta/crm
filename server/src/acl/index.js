'use strict';

const { getPermissionsAndRole } = require('../middleware/permissionResolver');

// Приводит разные форматы permissions к Set:
// - массив ['a', 'b']
// - объект { a: true, b: false }
// - уже готовый Set.
function toSet(x) {
  if (!x) return new Set();
  if (x instanceof Set) return x;
  if (Array.isArray(x)) return new Set(x);
  if (typeof x === 'object') return new Set(Object.keys(x).filter(k => x[k]));
  return new Set();
}

// Нормализует permissions в единый индекс allow/deny.
// Поддерживает старый формат массива и новый формат { allow, deny }.
function makeIndex(permissions) {
  if (Array.isArray(permissions)) {
    // старый формат ["p1","p2"]
    return { allow: new Set(permissions), deny: new Set() };
  }
  return {
    allow: toSet(permissions?.allow),
    deny : toSet(permissions?.deny),
  };
}

// Строит список permission-ключей для базы и скоупов (:own, :dept).
function expand(base, { own=false, dept=false } = {}) {
  const arr = [base];
  if (own)  arr.push(`${base}:own`);
  if (dept) arr.push(`${base}:dept`);
  return arr;
}

// Проверяет, есть ли хотя бы один явный deny среди ключей.
function isDeniedAny(idx, names)  { return names.some(n => idx.deny.has(n)); }
// Проверяет, есть ли хотя бы один allow среди ключей.
function isAllowedAny(idx, names) { return names.some(n => idx.allow.has(n)); }

// Загружает роль и permissions пользователя в компании
// и возвращает их в виде готового ACL-контекста.
async function resolveContext({ userId, companyId }) {
  const { role, permissions, membership } = await getPermissionsAndRole({ userId, companyId });
  const idx = makeIndex(permissions);
  return { role, idx, membership: membership || null };
}

// Проверяет доступ к одному базовому permission.
// Порядок проверки:
// 1) owner => всегда true
// 2) base allow/deny
// 3) scoped allow для :own (через ownCheck)
// 4) scoped allow для :dept (через deptCheck)
async function checkOne({ user, companyId, base, ownCheck, deptCheck }) {
  const { role, idx } = await resolveContext({ userId: user.id, companyId });

  // владелец — абсолютный доступ
  if (role === 'owner') return true;

  // ---- 1) БАЗОВЫЙ СКОУП ----
  // deny только на базу блокирует только базовую ветку
  if (!idx.deny.has(base) && idx.allow.has(base)) {
    return true;
  }

  // ---- 2) :OWN СКОУП ----
  if (ownCheck && idx.allow.has(`${base}:own`) && !idx.deny.has(`${base}:own`)) {
    const ok = await Promise.resolve(ownCheck());
    if (ok) return true;
  }

  // ---- 3) :DEPT СКОУП ----
  if (deptCheck && idx.allow.has(`${base}:dept`) && !idx.deny.has(`${base}:dept`)) {
    const ok = await Promise.resolve(deptCheck());
    if (ok) return true;
  }

  // Если хотим, чтобы общий DENY на базу валил и scoped-пути — раскомментируй:
  // if (idx.deny.has(base) || idx.deny.has(`${base}:own`) || idx.deny.has(`${base}:dept`)) return false;

  return false;
}

// Универсальная ACL-проверка:
// - required: один ключ или массив (any)
// - opts.anyOf: хотя бы один из списка
// - opts.allOf: все из списка
// scoped-проверки пробрасываются в checkOne.
async function check({ user, companyId, required, opts = {} }) {
  const need = Array.isArray(required) ? required : [required];
  const { anyOf, allOf, ownCheck, deptCheck } = opts;

  // Привязывает общие параметры проверки к одному permission-ключу.
  const bound = (base) => checkOne({ user, companyId, base, ownCheck, deptCheck });
  if (Array.isArray(anyOf) && anyOf.length) {
    for (const p of anyOf) if (await bound(p)) return true;
    return false;
  }
  if (Array.isArray(allOf) && allOf.length) {
    for (const p of allOf) if (!(await bound(p))) return false;
    return true;
  }
  for (const p of need) if (await bound(p)) return true;
  return false;
}

// Проверяет ACL и бросает Error(403), если доступ запрещён.
// Сервисы могут использовать единый try/catch поверх assert.
async function assert({ user, companyId, required, opts }) {
  const ok = await check({ user, companyId, required, opts });
  if (!ok) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

// Определяет итоговый департаментный скоуп для выборок:
// - canAll=true: есть полный доступ по base
// - canAll=false + deptLimitId: доступ ограничен департаментом
// - при запрете может бросить 403 (по throwIfDenied).
async function computeDeptScope({ user, companyId, base, getRequesterDept, throwIfDenied = true }) {
  const allowAll = await check({ user, companyId, required: base });
  if (allowAll) return { canAll: true, deptLimitId: null };

  const allowDept = await check({
    user, companyId, required: base,
    // Здесь нам важен сам факт наличия :dept права;
    // конкретное ограничение вернётся через getRequesterDept().
    opts: { deptCheck: async () => true },
  });

  if (!allowDept) {
    if (throwIfDenied) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    return { canAll: false, deptLimitId: null };
  }

  const deptId = await Promise.resolve(getRequesterDept());
  if (!deptId) {
    if (throwIfDenied) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    return { canAll: false, deptLimitId: null };
  }

  return { canAll: false, deptLimitId: deptId };
}

module.exports = { makeIndex, resolveContext, check, assert, computeDeptScope };
