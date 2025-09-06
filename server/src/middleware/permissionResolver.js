// auth/permissionResolver.js
const { Op } = require('sequelize');
const { UserCompany, UserRole, RolePermission, Permission, UserPermission } = require('../models');
const { DEPT_HEAD_PERMS } = require('../constants/aclDefaults');

const CACHE_TTL = 60_000; // 60s
const cache = new Map();
const key = (u, c) => `${u}:${c}`;

module.exports.invalidate = (userId, companyId) => cache.delete(key(userId, companyId));

async function load({ userId, companyId }) {
  // 0) членство (роль в компании + отдел + флажок лида)
  const membership = await UserCompany.findOne({
    where: { userId, companyId },
    attributes: ['role', 'departmentId', 'isLead']
  });
  if (!membership) {
    return { role: null, permissions: [] };
  }

  // 1) права из ACL-ролей (user_roles -> role_permissions -> permissions)
  const rowsUserRoles = await UserRole.findAll({
    where: { userId, companyId },
    attributes: ['roleId']
  });
  const roleIds = rowsUserRoles.map(r => r.roleId);

  const rowsRolePerms = roleIds.length
    ? await RolePermission.findAll({
        where: { roleId: { [Op.in]: roleIds } },
        include: [{ model: Permission, as: 'permission', attributes: ['name'] }]
      })
    : [];

  const perms = new Set(rowsRolePerms.map(rp => rp.permission.name));

  // 2) индивидуальные allow-права пользователя
  const rowsUserPerms = await UserPermission.findAll({
    where: { userId },
    include: [{ model: Permission, as: 'permission', attributes: ['name'] }]
  });
  rowsUserPerms.forEach(up => perms.add(up.permission.name));

  // 3) 🔥 если пользователь — ЛИД ОТДЕЛА → добавить dept-* права
  if (membership.isLead && membership.departmentId) {
    for (const p of DEPT_HEAD_PERMS) perms.add(p);
  }

  return { role: membership.role, permissions: Array.from(perms) };
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

// обратная совместимость с твоим текущим кодом
module.exports.getPermissions = async ({ userId, companyId }) => {
  const permissions = await module.exports.getPermissionsAndRole({ userId, companyId });
  return permissions;
};
