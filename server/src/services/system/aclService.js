const { Op } = require('sequelize');
const { sequelize, User, Role, Permission, RolePermission,CompanyDepartment, UserPermission, UserRole, UserCompany } = require('../../models');
const { DEFAULT_ROLE_SETS } = require('../../constants/aclDefaults');
const { listRoleTemplates, getRoleTemplate } = require('../../constants/roleTemplates');

// toPublicUser: выполняет вспомогательную бизнес-логику сервиса.
const toPublicUser = (u) => u ? ({
  id: u.id, email: u.email, firstName: u.firstName || '', lastName: u.lastName || '', avatarUrl: u.avatarUrl || null,
}) : null;

const normalizeRoleKey = (value) => String(value || '').trim().toLowerCase();
const hasRoleKey = (role, key) => normalizeRoleKey(role?.slug) === key || normalizeRoleKey(role?.name) === key;
const isOwnerRole = (role) => hasRoleKey(role, 'owner');
const isAdminRole = (role) => hasRoleKey(role, 'admin');
const sameId = (a, b) => String(a || '') === String(b || '');
const RESETTABLE_DEFAULT_ROLE_SLUGS = new Set(['manager', 'employee', 'viewer']);

const aclGuardError = (code, message, status = 409) => {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
};

async function uniqueRoleName({ companyId, baseName, transaction }) {
  const roles = await Role.findAll({
    attributes: ['name'],
    where: { companyId },
    transaction,
  });
  const existing = new Set(roles.map((role) => normalizeRoleKey(role.name)));
  if (!existing.has(normalizeRoleKey(baseName))) return baseName;

  const firstCopy = `${baseName} (copy)`;
  if (!existing.has(normalizeRoleKey(firstCopy))) return firstCopy;

  let index = 2;
  while (existing.has(normalizeRoleKey(`${baseName} (copy ${index})`))) {
    index += 1;
  }
  return `${baseName} (copy ${index})`;
}

async function permissionRowsForNames(names, transaction) {
  const uniqueNames = [...new Set(names || [])];
  const permissions = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: uniqueNames },
    transaction,
  });
  const permissionByName = new Map(permissions.map((permission) => [permission.name, permission]));
  const missing = uniqueNames.filter((name) => !permissionByName.has(name));
  if (missing.length) {
    throw aclGuardError('ROLE_PERMISSION_MISSING', `Missing permissions: ${missing.join(', ')}`, 500);
  }
  return uniqueNames.map((name) => permissionByName.get(name));
}

async function setRolePermissions({ roleId, permissionNames, transaction }) {
  const permissions = await permissionRowsForNames(permissionNames, transaction);
  await RolePermission.destroy({ where: { roleId }, transaction });
  if (permissions.length) {
    await RolePermission.bulkCreate(
      permissions.map((permission) => ({ roleId, permissionId: permission.id })),
      { ignoreDuplicates: true, transaction }
    );
  }
}

async function countRoleAssignments({ companyId, roleId, transaction }) {
  return UserRole.count({ where: { companyId, roleId }, transaction });
}

const loadRoleForCompany = async ({ companyId, roleId, transaction }) => {
  const role = await Role.findOne({ where: { id: roleId }, transaction });
  if (!role) throw new Error('Role not found in company');
  if (!sameId(role.companyId, companyId)) {
    throw aclGuardError('ROLE_COMPANY_MISMATCH', 'Role does not belong to this company.', 400);
  }
  return role;
};

const ensureActiveCompanyMember = async ({ userId, companyId, transaction }) => {
  const membership = await UserCompany.findOne({
    where: { userId, companyId, status: 'active' },
    transaction,
  });
  if (!membership) {
    throw aclGuardError('USER_COMPANY_MISMATCH', 'User is not an active member of this company.', 400);
  }
  return membership;
};

const activeOwnerUserIdsAfterRoleRemoval = async ({ companyId, removedUserId, removedRoleId, transaction }) => {
  const memberships = await UserCompany.findAll({
    attributes: ['userId', 'role'],
    where: { companyId, status: 'active' },
    transaction,
  });

  const activeUserIds = new Set(memberships.map((membership) => String(membership.userId)));
  const ownerUserIds = new Set(
    memberships
      .filter((membership) => normalizeRoleKey(membership.role) === 'owner')
      .map((membership) => String(membership.userId))
  );

  const roles = await Role.findAll({
    attributes: ['id', 'slug', 'name'],
    where: { companyId },
    transaction,
  });
  const ownerRoleIds = roles
    .filter((role) => isOwnerRole(role))
    .map((role) => role.id);

  if (ownerRoleIds.length) {
    const userRoles = await UserRole.findAll({
      attributes: ['userId', 'roleId'],
      where: { companyId, roleId: { [Op.in]: ownerRoleIds } },
      transaction,
    });
    for (const userRole of userRoles) {
      if (sameId(userRole.userId, removedUserId) && sameId(userRole.roleId, removedRoleId)) continue;
      if (activeUserIds.has(String(userRole.userId))) ownerUserIds.add(String(userRole.userId));
    }
  }

  return ownerUserIds;
};

// createRole: создаёт новую запись и возвращает результат.
module.exports.createRole = async ({ companyId, name, description }) => {
  if (!companyId || !name) throw new Error('companyId & name required');
  return Role.create({ companyId, name, description });
};

module.exports.listRoleTemplates = async () => listRoleTemplates();

module.exports.createRoleFromTemplate = async ({ companyId, templateId, transaction: providedTransaction }) => {
  if (!companyId || !templateId) throw new Error('companyId & templateId required');
  const template = getRoleTemplate(templateId);
  if (!template) throw aclGuardError('ROLE_TEMPLATE_NOT_FOUND', 'Role template not found.', 404);

  const createFromTemplate = async (transaction) => {
    const permissions = await Permission.findAll({
      where: { name: template.permissions },
      attributes: ['id', 'name'],
      transaction,
    });
    const permissionByName = new Map(permissions.map((permission) => [permission.name, permission]));
    const missing = template.permissions.filter((name) => !permissionByName.has(name));
    if (missing.length) {
      throw aclGuardError('ROLE_TEMPLATE_PERMISSION_MISSING', `Role template references missing permissions: ${missing.join(', ')}`, 500);
    }

    const roleName = await uniqueRoleName({ companyId, baseName: template.name, transaction });
    const role = await Role.create({
      companyId,
      name: roleName,
      description: template.description,
      slug: null,
      isSystem: false,
      isDefault: false,
    }, { transaction });

    await RolePermission.bulkCreate(
      template.permissions.map((name) => ({
        roleId: role.id,
        permissionId: permissionByName.get(name).id,
      })),
      { ignoreDuplicates: true, transaction }
    );

    return module.exports.getRole({ companyId, roleId: role.id, transaction });
  };

  return providedTransaction
    ? createFromTemplate(providedTransaction)
    : sequelize.transaction(createFromTemplate);
};

module.exports.cloneRole = async ({ companyId, roleId, transaction: providedTransaction }) => {
  if (!companyId || !roleId) throw new Error('companyId & roleId required');

  const clone = async (transaction) => {
    const source = await module.exports.getRole({ companyId, roleId, transaction });
    if (!source) return null;
    if (source.isSystem) {
      throw aclGuardError('ROLE_CLONE_FORBIDDEN', 'System roles cannot be cloned.', 403);
    }

    const roleName = await uniqueRoleName({ companyId, baseName: source.name, transaction });
    const nextRole = await Role.create({
      companyId,
      name: roleName,
      description: source.description || null,
      slug: null,
      isSystem: false,
      isDefault: false,
    }, { transaction });

    const permissionNames = (source.permissions || []).map((permission) => permission.name).filter(Boolean);
    await setRolePermissions({ roleId: nextRole.id, permissionNames, transaction });
    return module.exports.getRole({ companyId, roleId: nextRole.id, transaction });
  };

  return providedTransaction ? clone(providedTransaction) : sequelize.transaction(clone);
};

module.exports.resetDefaultRole = async ({ companyId, roleId, transaction: providedTransaction }) => {
  if (!companyId || !roleId) throw new Error('companyId & roleId required');

  const reset = async (transaction) => {
    const role = await loadRoleForCompany({ companyId, roleId, transaction });
    const slug = normalizeRoleKey(role.slug || role.name);
    if (!role.isDefault || role.isSystem || !RESETTABLE_DEFAULT_ROLE_SLUGS.has(slug)) {
      throw aclGuardError('ROLE_RESET_FORBIDDEN', 'Only non-system default roles can be reset.', 403);
    }
    const permissionNames = DEFAULT_ROLE_SETS[slug];
    if (!Array.isArray(permissionNames)) {
      throw aclGuardError('ROLE_RESET_SEED_MISSING', 'Default role seed is missing.', 500);
    }
    await setRolePermissions({ roleId: role.id, permissionNames, transaction });
    return module.exports.getRole({ companyId, roleId: role.id, transaction });
  };

  return providedTransaction ? reset(providedTransaction) : sequelize.transaction(reset);
};

module.exports.getRoleDiff = async ({ companyId, roleId, templateId, transaction }) => {
  const role = await module.exports.getRole({ companyId, roleId, transaction });
  if (!role) return null;

  let reference = null;
  let referencePermissions = [];
  if (templateId) {
    const template = getRoleTemplate(templateId);
    if (!template) throw aclGuardError('ROLE_TEMPLATE_NOT_FOUND', 'Role template not found.', 404);
    reference = { type: 'template', id: template.id, name: template.name };
    referencePermissions = template.permissions;
  } else {
    const slug = normalizeRoleKey(role.slug || role.name);
    referencePermissions = DEFAULT_ROLE_SETS[slug] || [];
    reference = { type: 'default', id: slug, name: role.name };
  }

  const current = new Set((role.permissions || []).map((permission) => permission.name).filter(Boolean));
  const expected = new Set(referencePermissions);
  return {
    roleId: role.id,
    reference,
    added: [...current].filter((name) => !expected.has(name)).sort(),
    removed: [...expected].filter((name) => !current.has(name)).sort(),
  };
};

// listRoles: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.listRoles = async ({ companyId, query = {} }) => {
  const where = { companyId };
  if (query.q) where.name = { [Op.iLike]: `%${query.q}%` };

  return Role.findAll({
    where,
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    order: [['name', 'ASC']]
  });
};

// getRole: возвращает данные по входным параметрам сервиса.
module.exports.getRole = async ({ companyId, roleId, transaction }) => {
  return Role.findOne({
    where: { id: roleId, companyId },
    include: [{ model: Permission, as: 'permissions', through: { attributes: [] } }],
    transaction,
  });
};

// updateRole: обновляет запись и возвращает актуальные данные.
module.exports.updateRole = async ({ companyId, roleId, data, transaction }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId }, transaction });
  if (!role) return null;
  await role.update({ name: data.name ?? role.name, description: data.description ?? role.description }, { transaction });
  return module.exports.getRole({ companyId, roleId, transaction });
};

// deleteRole: удаляет запись с учётом бизнес-ограничений.
module.exports.deleteRole = async ({ companyId, roleId, transaction: providedTransaction }) => {
  const remove = async (transaction) => {
    const role = await loadRoleForCompany({ companyId, roleId, transaction });
    if (role.isSystem || role.isDefault) {
      throw aclGuardError('ROLE_DELETE_FORBIDDEN', 'Only custom roles can be deleted.', 403);
    }
    const assignedCount = await countRoleAssignments({ companyId, roleId, transaction });
    if (assignedCount > 0) {
      const err = aclGuardError('ROLE_ASSIGNED_USERS', `This role is assigned to ${assignedCount} users.`, 409);
      err.assignedCount = assignedCount;
      throw err;
    }
    await RolePermission.destroy({ where: { roleId }, transaction });
    return Role.destroy({ where: { id: roleId, companyId }, transaction });
  };

  return providedTransaction ? remove(providedTransaction) : sequelize.transaction(remove);
};

module.exports.reassignAndDeleteRole = async ({ companyId, roleId, targetRoleId, transaction: providedTransaction }) => {
  if (!companyId || !roleId || !targetRoleId) throw new Error('companyId, roleId & targetRoleId required');
  if (sameId(roleId, targetRoleId)) {
    throw aclGuardError('ROLE_REASSIGN_TARGET_INVALID', 'Target role must be different.', 400);
  }

  const reassignAndDelete = async (transaction) => {
    const source = await loadRoleForCompany({ companyId, roleId, transaction });
    await loadRoleForCompany({ companyId, roleId: targetRoleId, transaction });
    if (source.isSystem || source.isDefault) {
      throw aclGuardError('ROLE_DELETE_FORBIDDEN', 'Only custom roles can be deleted.', 403);
    }

    const assignments = await UserRole.findAll({
      attributes: ['userId'],
      where: { companyId, roleId },
      transaction,
    });
    for (const assignment of assignments) {
      await UserRole.findOrCreate({
        where: { userId: assignment.userId, companyId, roleId: targetRoleId },
        defaults: { userId: assignment.userId, companyId, roleId: targetRoleId },
        transaction,
      });
    }
    await UserRole.destroy({ where: { companyId, roleId }, transaction });
    await RolePermission.destroy({ where: { roleId }, transaction });
    await Role.destroy({ where: { id: roleId, companyId }, transaction });
    return { deleted: true, reassignedCount: assignments.length, targetRoleId };
  };

  return providedTransaction
    ? reassignAndDelete(providedTransaction)
    : sequelize.transaction(reassignAndDelete);
};

// ---- role ↔ permission
module.exports.assignPermToRole = async ({ companyId, roleId, permId }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId } });
  if (!role) throw new Error('Role not found in company');
  await RolePermission.findOrCreate({ where: { roleId, permissionId: permId } });
};

// removePermFromRole: удаляет запись с учётом бизнес-ограничений.
module.exports.removePermFromRole = async ({ companyId, roleId, permId }) => {
  const role = await Role.findOne({ where: { id: roleId, companyId } });
  if (!role) throw new Error('Role not found in company');
  await RolePermission.destroy({ where: { roleId, permissionId: permId } });
};

// ---- user ↔ role
module.exports.assignRoleToUser = async ({ userId, companyId, roleId }) => {
  await sequelize.transaction(async (transaction) => {
    await loadRoleForCompany({ companyId, roleId, transaction });
    await ensureActiveCompanyMember({ userId, companyId, transaction });
    await UserRole.findOrCreate({ where: { userId, companyId, roleId }, transaction });
  });
};

// removeRoleFromUser: удаляет запись с учётом бизнес-ограничений.
module.exports.removeRoleFromUser = async ({ userId, companyId, roleId, currentUserId }) => {
  await sequelize.transaction(async (transaction) => {
    const role = await loadRoleForCompany({ companyId, roleId, transaction });
    await ensureActiveCompanyMember({ userId, companyId, transaction });

    if (sameId(currentUserId, userId) && (isOwnerRole(role) || isAdminRole(role))) {
      throw aclGuardError(
        'SELF_DEMOTION_FORBIDDEN',
        'You cannot remove your own owner/admin access.',
        403
      );
    }

    if (isOwnerRole(role)) {
      const ownerUserIds = await activeOwnerUserIdsAfterRoleRemoval({
        companyId,
        removedUserId: userId,
        removedRoleId: roleId,
        transaction,
      });
      if (ownerUserIds.size === 0) {
        throw aclGuardError(
          'LAST_OWNER_REQUIRED',
          'Company must have at least one owner.',
          409
        );
      }
    }

    // TODO: Last admin protection is not enforced because owner is the authoritative company recovery role.
    await UserRole.destroy({ where: { userId, companyId, roleId }, transaction });
  });
};

// ---- user ↔ permission (extra)
module.exports.grantPermToUser = async ({ userId, permId }) => {
  await UserPermission.findOrCreate({ where: { userId, permissionId: permId } });
};

// revokePermFromUser: выполняет вспомогательную бизнес-логику сервиса.
module.exports.revokePermFromUser = async ({ userId, permId }) => {
  await UserPermission.destroy({ where: { userId, permissionId: permId } });
};

// ---- permissions (global)
module.exports.createPermission = async ({ name, description }) => {
  if (!name) throw new Error('name required');
  return Permission.create({ name, description });
};

// listPermissions: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.listPermissions = async ({ query = {} }) => {
  const where = {};
  if (query.q) where.name = { [Op.iLike]: `%${query.q}%` };
  return Permission.findAll({ where, order: [['name', 'ASC']] });
};
// getPermission: возвращает данные по входным параметрам сервиса.
module.exports.getPermission = async (permId) => Permission.findByPk(permId);

// updatePermission: обновляет запись и возвращает актуальные данные.
module.exports.updatePermission = async (permId, data) => {
  const p = await Permission.findByPk(permId);
  if (!p) return null;
  await p.update({ name: data.name ?? p.name, description: data.description ?? p.description });
  return p;
};

// deletePermission: удаляет запись с учётом бизнес-ограничений.
module.exports.deletePermission = async (permId) => Permission.destroy({ where: { id: permId } });

// getUserPermissionSummary: возвращает данные по входным параметрам сервиса.
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
      include: [{ model: Role, as: 'role', attributes: ['id','name','slug','isSystem','isDefault','description'] }]
    });
    roles = userRoles
      .map(ur => ur.role)
      .filter(Boolean)
      .map(r => ({
        id: r.id,
        name: r.name,
        slug: r.slug || null,
        isSystem: !!r.isSystem,
        isDefault: !!r.isDefault,
        description: r.description || null,
      }));
  }

  // 2.1) fallback: если явных UserRole нет, но в membership есть role — пробуем найти такую роль в компании
  if (companyId && roles.length === 0 && membership?.role) {
    const virtual = await Role.findOne({
      where: {
        companyId,
        [Op.or]: [
          { slug: membership.role },
          { name: membership.role },
        ],
      },
      attributes: ['id','name','slug','isSystem','isDefault','description']
    });
    if (virtual) {
      roles = [{
        id: virtual.id,
        name: virtual.name,
        slug: virtual.slug || null,
        isSystem: !!virtual.isSystem,
        isDefault: !!virtual.isDefault,
        description: virtual.description || null,
      }];
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


// allowPermForUser: выполняет вспомогательную бизнес-логику сервиса.
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
