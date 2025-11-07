// auth/permissionResolver.js
'use strict';

const { Op } = require('sequelize');
const {
  UserCompany,
  UserRole,
  RolePermission,
  Permission,
  UserPermission,
} = require('../models');

const { DEFAULT_ROLE_SETS, DEPT_HEAD_PERMS } = require('../constants/aclDefaults');

const CACHE_TTL = 60_000; // 60s
const cache = new Map();
const key = (u, c) => `${u}:${c}`;

module.exports.invalidate = (userId, companyId) => cache.delete(key(userId, companyId));

async function load({ userId, companyId }) {
  // 0) membership (роль/департамент/лид/статус)
  const membership = await UserCompany.findOne({
    where: { userId, companyId },
    attributes: ['role', 'departmentId', 'isLead', 'status'],
  });

  if (!membership || membership.status !== 'active') {
    return {
      role: null,
      membership: null,
      permissions: { allow: [], deny: [] },
    };
  }

  const role = membership.role || null;

  // Начинаем собирать множества allow/deny
  const allow = new Set();
  const deny  = new Set();

  // 1) БАЗОВЫЕ ПРАВА ПО РОЛИ ЧЛЕНСТВА (owner/admin/manager/user и т.д.)
  const baseSet = DEFAULT_ROLE_SETS?.[role];
  if (Array.isArray(baseSet)) {
    for (const p of baseSet) allow.add(p);
  }

  // 2) ACL-РОЛИ: user_roles -> role_permissions -> permissions.name
  const rowsUserRoles = await UserRole.findAll({
    where: { userId, companyId },
    attributes: ['roleId'],
  });
  const roleIds = rowsUserRoles.map(r => r.roleId);

  if (roleIds.length) {
    const rowsRolePerms = await RolePermission.findAll({
      where: { roleId: { [Op.in]: roleIds } },
      include: [{ model: Permission, as: 'permission', attributes: ['name'] }],
    });
    for (const rp of rowsRolePerms) {
      const name = rp.permission?.name;
      if (name) allow.add(name);
    }
  }

  // 3) ПЕРСОНАЛЬНЫЕ ОВЕРРАЙДЫ ПОЛЬЗОВАТЕЛЯ (company-scoped)
  const rowsUserPerms = await UserPermission.findAll({
    where: { userId, companyId }, // важно: company-scoped
    include: [{ model: Permission, as: 'permission', attributes: ['name'] }],
  });

  for (const up of rowsUserPerms) {
    const name = up.permission?.name;
    if (!name) continue;
    if (up.effect === 'deny') {
      deny.add(name);      // deny приоритетнее, логика в acl/check
    } else {
      allow.add(name);     // effect === 'allow' (или default)
    }
  }

  // 4) ДОБАВКА ДЛЯ ЛИДЕРА ОТДЕЛА
  if (membership.isLead && membership.departmentId) {
    for (const p of DEPT_HEAD_PERMS) allow.add(p);
  }

  return {
    role,
    membership: {
      role,
      departmentId: membership.departmentId || null,
      isLead: !!membership.isLead,
      status: membership.status,
    },
    permissions: {
      allow: Array.from(allow),
      deny : Array.from(deny),
    },
  };
}

module.exports.getPermissionsAndRole = async ({ userId, companyId }) => {
  const k = key(userId, companyId);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && now - hit.t < CACHE_TTL) return hit.v;

  const v = await load({ userId, companyId });
  cache.set(k, { t: now, v });
  return v;
};

// Обратная совместимость
module.exports.getPermissions = async ({ userId, companyId }) => {
  return module.exports.getPermissionsAndRole({ userId, companyId });
};