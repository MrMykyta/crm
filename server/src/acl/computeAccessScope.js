'use strict';

const { getPermissionsAndRole } = require('../middleware/permissionResolver');

function toSet(value) {
  if (!value) return new Set();
  if (value instanceof Set) return value;
  if (Array.isArray(value)) return new Set(value);
  if (typeof value === 'object') return new Set(Object.keys(value).filter((key) => value[key]));
  return new Set();
}

function makeIndex(permissions) {
  if (Array.isArray(permissions)) {
    return { allow: new Set(permissions), deny: new Set() };
  }
  return {
    allow: toSet(permissions?.allow),
    deny: toSet(permissions?.deny),
  };
}

function emptyScope() {
  return {
    deny: false,
    company: false,
    dept: false,
    departmentIds: [],
    own: false,
    ownUserId: null,
  };
}

function normalizeIds(ids) {
  return [...new Set((Array.isArray(ids) ? ids : [ids]).filter(Boolean).map(String))];
}

async function loadContext({ user, companyId, role, membership, permissions }) {
  if (permissions) {
    return {
      role: role || null,
      membership: membership || null,
      idx: makeIndex(permissions),
    };
  }

  const loaded = await getPermissionsAndRole({ userId: user.id, companyId });
  return {
    role: loaded.role || role || null,
    membership: loaded.membership || membership || null,
    idx: makeIndex(loaded.permissions),
  };
}

async function resolveDepartmentIds({ getRequesterDepartments, membership }) {
  if (typeof getRequesterDepartments === 'function') {
    const ids = await Promise.resolve(getRequesterDepartments());
    return normalizeIds(ids);
  }
  return normalizeIds(membership?.departmentIds || membership?.departmentId || []);
}

async function computeAccessScope({
  user,
  companyId,
  action,
  permissions,
  role,
  membership,
  getRequesterDepartments,
  entityScopeEnabled = false,
} = {}) {
  if (!user?.id || !companyId || !action) {
    return { ...emptyScope(), deny: true };
  }

  const context = await loadContext({ user, companyId, role, membership, permissions });
  const { idx } = context;
  const scope = emptyScope();

  if (context.role === 'owner' || context.role === 'admin') {
    return { ...scope, company: true };
  }

  if (idx.deny.has(action)) {
    return { ...scope, deny: true };
  }

  if (idx.allow.has(action)) {
    return { ...scope, company: true };
  }

  if (!entityScopeEnabled) {
    return scope;
  }

  const ownAction = `${action}:own`;
  const deptAction = `${action}:dept`;

  if (idx.allow.has(ownAction) && !idx.deny.has(ownAction)) {
    scope.own = true;
    scope.ownUserId = String(user.id);
  }

  if (idx.allow.has(deptAction) && !idx.deny.has(deptAction)) {
    const departmentIds = await resolveDepartmentIds({
      getRequesterDepartments,
      membership: context.membership,
    });
    if (departmentIds.length) {
      scope.dept = true;
      scope.departmentIds = departmentIds;
    }
  }

  return scope;
}

module.exports = {
  computeAccessScope,
};
