const { Op } = require('sequelize');
const { Role, Permission, RolePermission, UserRole, UserPermission } = require('../../models');

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
