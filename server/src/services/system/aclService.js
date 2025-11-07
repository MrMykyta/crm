const { Op } = require('sequelize');
const { User, Role, Permission, RolePermission,CompanyDepartment, UserPermission, UserRole, UserCompany } = require('../../models');

const toPublicUser = (u) => u ? ({
  id: u.id, email: u.email, firstName: u.firstName || '', lastName: u.lastName || '', avatarUrl: u.avatarUrl || null,
}) : null;

module.exports.createRole = async ({ companyId, name, description }) => {
  if (!companyId || !name) throw new Error('companyId & name required');
  return Role.create({ companyId, name, description });
};

module.exports.listRoles = async ({ companyId, query = {} }) => {
  const where = { companyId };
  if (query.q) where.name = { [Op.iLike]: `%${query.q}%` };

  return Role.findAll({
    where,
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    order: [['name', 'ASC']]
  });
};

module.exports.getRole = async ({ companyId, roleId }) => {
  return Role.findOne({
    where: { id: roleId, companyId },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }]
  });
};

module.exports.updateRole = async ({ companyId, roleId, data }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId } });
  if (!role) return null;
  await role.update({ name: data.name ?? role.name, description: data.description ?? role.description });
  return this.getRole({ companyId, roleId });
};

module.exports.deleteRole = async ({ companyId, roleId }) => {
  return Role.destroy({ where: { id: roleId, companyId } });
};

// ---- role ↔ permission
module.exports.assignPermToRole = async ({ companyId, roleId, permId }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId } });
  if (!role) throw new Error('Role not found in company');
  await RolePermission.findOrCreate({ where: { roleId, permissionId: permId } });
};

module.exports.removePermFromRole = async ({ companyId, roleId, permId }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId } });
  if (!role) throw new Error('Role not found in company');
  await RolePermission.destroy({ where: { roleId, permissionId: permId } });
};

// ---- user ↔ role
module.exports.assignRoleToUser = async ({ userId, companyId, roleId }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId } });
  if (!role) throw new Error('Role not found in company');
  await UserRole.findOrCreate({ where: { userId, companyId, roleId } });
};

module.exports.removeRoleFromUser = async ({ userId, companyId, roleId }) => {
  await UserRole.destroy({ where: { userId, companyId, roleId } });
};

// ---- user ↔ permission (extra)
module.exports.grantPermToUser = async ({ userId, permId }) => {
  await UserPermission.findOrCreate({ where: { userId, permissionId: permId } });
};

module.exports.revokePermFromUser = async ({ userId, permId }) => {
  await UserPermission.destroy({ where: { userId, permissionId: permId } });
};

// ---- permissions (global)
module.exports.createPermission = async ({ name, description }) => {
  if (!name) throw new Error('name required');
  return Permission.create({ name, description });
};

module.exports.listPermissions = async ({ query = {} }) => {
  const where = {};
  if (query.q) where.name = { [Op.iLike]: `%${query.q}%` };
  return Permission.findAll({ where, order: [['name', 'ASC']] });
};
module.exports.getPermission = async (permId) => Permission.findByPk(permId);

module.exports.updatePermission = async (permId, data) => {
  const p = await Permission.findByPk(permId);
  if (!p) return null;
  await p.update({ name: data.name ?? p.name, description: data.description ?? p.description });
  return p;
};

module.exports.deletePermission = async (permId) => Permission.destroy({ where: { id: permId } });

module.exports.getUserPermissionSummary = async ({ companyId, userId }) => {
  // 0) сам пользователь (краткая публичная инфа)
  const u = await User.findByPk(userId, {
    attributes: ['id','email','firstName','lastName','avatarUrl']
  });
  if (!u) return null;

  const userPublic = {
    id: u.id,
    email: u.email,
    firstName: u.firstName || '',
    lastName : u.lastName  || '',
    avatarUrl: u.avatarUrl || null,
  };

  // 1) членство (для UI: статус/департамент/роль по membership)
  let membership = null;
  if (companyId) {
    const m = await UserCompany.findOne({
      where: { userId, companyId },
      attributes: ['role','status','isLead','createdAt'],
      include: [{ model: CompanyDepartment, as:'department', attributes: ['id','name'] }]
    });
    if (m) {
      membership = {
        role: m.role,
        status: m.status,
        isLead: !!m.isLead,
        createdAt: m.createdAt,
        department: m.department ? { id: m.department.id, name: m.department.name } : null,
      };
    }
  }

  // 2) роли пользователя (company-scoped user_roles)
  let roles = [];
  if (companyId) {
    const userRoles = await UserRole.findAll({
      where: { userId, companyId },
      include: [{ model: Role, as: 'role', attributes: ['id','name','description'] }]
    });
    roles = userRoles
      .map(ur => ur.role)
      .filter(Boolean)
      .map(r => ({ id: r.id, name: r.name, description: r.description || null }));
  }

  // 2.1) fallback: если явных UserRole нет, но в membership есть role — пробуем найти такую роль в компании
  if (companyId && roles.length === 0 && membership?.role) {
    const virtual = await Role.findOne({
      where: { companyId, name: membership.role },
      attributes: ['id','name','description']
    });
    if (virtual) {
      roles = [{ id: virtual.id, name: virtual.name, description: virtual.description || null }];
    }
  }

  // 3) каталог всех пермишенов
  const allPerms = await Permission.findAll({
    attributes: ['id','name','description'],
    order: [['name','ASC']]
  });

  // 4) пермишены, пришедшие через роли
  let rolePermSet = new Set();
  if (roles.length) {
    const roleIds = [...new Set(roles.map(r => r.id))];
    const rp = await RolePermission.findAll({
      where: { roleId: { [Op.in]: roleIds } },
      attributes: ['permissionId']
    });
    rolePermSet = new Set(rp.map(x => x.permissionId));
  }

  // 5) индивидуальные overrides пользователя (company-scoped!) — allow/deny
  //    В миграции companyId обязателен, поэтому фильтруем по нему.
  const up = await UserPermission.findAll({
    where: { userId, companyId },
    attributes: ['permissionId', 'effect'] // effect: 'allow' | 'deny'
  });

  const userAllowSet = new Set(up.filter(x => x.effect === 'allow').map(x => x.permissionId));
  const userDenySet  = new Set(up.filter(x => x.effect === 'deny' ).map(x => x.permissionId));

  // 6) финальная разметка: приоритет userDeny > userAllow > role
  const permissions = allPerms.map(p => {
    const viaRole      = rolePermSet.has(p.id);
    const viaUserAllow = userAllowSet.has(p.id);
    const viaUserDeny  = userDenySet.has(p.id);

    let effective = false;
    if (viaUserDeny) {
      effective = false;            // deny всегда выключает
    } else if (viaUserAllow) {
      effective = true;             // allow включает независимо от ролей
    } else {
      effective = viaRole;          // иначе наследуемся от роли
    }

    return {
      id: p.id,
      name: p.name,
      description: p.description || null,
      viaRole,
      viaUserAllow,
      viaUserDeny,
      effective,
    };
  });

  return {
    user: userPublic,
    membership,
    roles,
    permissions,
  };
};


module.exports.allowPermForUser = async ({ userId, companyId, permId }) => {
  if (!companyId) throw new Error('companyId required');
  const [row, created] = await UserPermission.findOrCreate({
    where: { userId, companyId, permissionId: permId },
    defaults: { effect: 'allow' },
  });
  if (!created && row.effect !== 'allow') {
    await row.update({ effect: 'allow' });
  }
};

// effect = 'deny'
module.exports.denyPermForUser = async ({ userId, companyId, permId }) => {
  if (!companyId) throw new Error('companyId required');
  const [row, created] = await UserPermission.findOrCreate({
    where: { userId, companyId, permissionId: permId },
    defaults: { effect: 'deny' },
  });
  if (!created && row.effect !== 'deny') {
    await row.update({ effect: 'deny' });
  }
};

// убрать override (вернуться к наследованию от ролей)
module.exports.clearPermOverride = async ({ userId, companyId, permId }) => {
  if (!companyId) throw new Error('companyId required');
  await UserPermission.destroy({ where: { userId, companyId, permissionId: permId } });
};