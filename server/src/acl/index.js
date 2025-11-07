'use strict';

const { getPermissionsAndRole } = require('../middleware/permissionResolver');

function toSet(x) {
  if (!x) return new Set();
  if (x instanceof Set) return x;
  if (Array.isArray(x)) return new Set(x);
  if (typeof x === 'object') return new Set(Object.keys(x).filter(k => x[k]));
  return new Set();
}

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

function expand(base, { own=false, dept=false } = {}) {
  const arr = [base];
  if (own)  arr.push(`${base}:own`);
  if (dept) arr.push(`${base}:dept`);
  return arr;
}

function isDeniedAny(idx, names)  { return names.some(n => idx.deny.has(n)); }
function isAllowedAny(idx, names) { return names.some(n => idx.allow.has(n)); }

async function resolveContext({ userId, companyId }) {
  const { role, permissions, membership } = await getPermissionsAndRole({ userId, companyId });
  const idx = makeIndex(permissions);
  return { role, idx, membership: membership || null };
}

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

async function check({ user, companyId, required, opts = {} }) {
  const need = Array.isArray(required) ? required : [required];
  const { anyOf, allOf, ownCheck, deptCheck } = opts;
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

// бросает только здесь — чтобы сервисы могли использовать try/catch
async function assert({ user, companyId, required, opts }) {
  const ok = await check({ user, companyId, required, opts });
  if (!ok) {
    const err = new Error('Forbidden');
    err.status = 403;
    throw err;
  }
}

async function computeDeptScope({ user, companyId, base, getRequesterDept, throwIfDenied = true }) {
  const allowAll = await check({ user, companyId, required: base });
  if (allowAll) return { canAll: true, deptLimitId: null };

  const allowDept = await check({
    user, companyId, required: base,
    opts: { deptCheck: async () => true }
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