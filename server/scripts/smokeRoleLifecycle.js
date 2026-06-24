'use strict';

// Smoke: Role lifecycle management.
// NON-DESTRUCTIVE: runs in a transaction and always rolls back.

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Permission,
  Role,
  RolePermission,
  User,
  UserCompany,
  UserRole,
} = require('../src/models');
const { DEFAULT_ROLE_SETS } = require('../src/constants/aclDefaults');
const aclService = require('../src/services/system/aclService');
const {
  ensureCorePermissionCatalog,
  ensureWmsPermissionCatalog,
} = require('../src/services/system/aclSyncService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function permissionIds(names, transaction) {
  const rows = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: names },
    transaction,
  });
  const byName = new Map(rows.map((row) => [row.name, row.id]));
  const missing = names.filter((name) => !byName.has(name));
  if (missing.length) throw new Error(`Missing permissions: ${missing.join(', ')}`);
  return names.map((name) => byName.get(name));
}

async function setRolePermissions(roleId, names, transaction) {
  const ids = await permissionIds(names, transaction);
  await RolePermission.destroy({ where: { roleId }, transaction });
  await RolePermission.bulkCreate(ids.map((permissionId) => ({ roleId, permissionId })), { transaction });
}

async function rolePermSet(roleId, transaction) {
  const role = await aclService.getRole({ companyId: currentCompanyId, roleId, transaction });
  return new Set((role?.permissions || []).map((permission) => permission.name));
}

let currentCompanyId = null;

(async () => {
  const transaction = await sequelize.transaction();
  try {
    await ensureCorePermissionCatalog({ transaction });
    await ensureWmsPermissionCatalog({ transaction });

    const required = [...new Set([
      ...DEFAULT_ROLE_SETS.manager,
      'counterparty:read',
      'task:read',
      'company:delete',
    ])];
    await permissionIds(required, transaction);

    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await User.create({
      id: uuidv4(),
      email: `role-lifecycle-owner-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction });
    const user = await User.create({
      id: uuidv4(),
      email: `role-lifecycle-user-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction });
    const company = await Company.create({
      id: uuidv4(),
      name: `Role Lifecycle Smoke ${suffix}`,
      ownerUserId: owner.id,
    }, { transaction });
    currentCompanyId = company.id;
    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: user.id, companyId: company.id, role: 'user', status: 'active' },
    ], { transaction });

    const managerRole = await Role.create({
      id: uuidv4(),
      companyId: company.id,
      name: 'manager',
      slug: 'manager',
      isDefault: true,
      isSystem: false,
      description: 'Default manager role',
    }, { transaction });
    await setRolePermissions(managerRole.id, ['counterparty:read', 'company:delete'], transaction);

    const customRole = await Role.create({
      id: uuidv4(),
      companyId: company.id,
      name: 'Sales Custom',
      description: 'Custom role to clone and reassign',
      isDefault: false,
      isSystem: false,
    }, { transaction });
    await setRolePermissions(customRole.id, ['counterparty:read', 'task:read'], transaction);

    const clonedCustom = await aclService.cloneRole({
      companyId: company.id,
      roleId: customRole.id,
      transaction,
    });
    const clonedCustomPerms = await rolePermSet(clonedCustom.id, transaction);
    check('custom role clone creates a custom copy',
      clonedCustom?.name === 'Sales Custom (copy)' &&
      clonedCustom?.isDefault === false &&
      clonedCustom?.isSystem === false
    );
    check('custom role clone copies permissions and description, not assignments',
      clonedCustom?.description === customRole.description &&
      clonedCustomPerms.has('counterparty:read') &&
      clonedCustomPerms.has('task:read') &&
      await UserRole.count({ where: { companyId: company.id, roleId: clonedCustom.id }, transaction }) === 0
    );

    const clonedDefault = await aclService.cloneRole({
      companyId: company.id,
      roleId: managerRole.id,
      transaction,
    });
    check('default role clone creates custom copy',
      clonedDefault?.name === 'manager (copy)' &&
      clonedDefault?.slug === null &&
      clonedDefault?.isDefault === false &&
      clonedDefault?.isSystem === false
    );

    const resetManager = await aclService.resetDefaultRole({
      companyId: company.id,
      roleId: managerRole.id,
      transaction,
    });
    const resetPerms = new Set((resetManager.permissions || []).map((permission) => permission.name));
    check('reset default role restores matrix seed',
      DEFAULT_ROLE_SETS.manager.every((name) => resetPerms.has(name)) &&
      !resetPerms.has('company:delete'),
      `count=${resetPerms.size}`
    );

    await UserRole.create({
      userId: user.id,
      companyId: company.id,
      roleId: customRole.id,
    }, { transaction });
    try {
      await aclService.deleteRole({ companyId: company.id, roleId: customRole.id, transaction });
      check('assigned custom role delete is blocked', false);
    } catch (error) {
      check('assigned custom role delete is blocked', error.code === 'ROLE_ASSIGNED_USERS', `code=${error.code}`);
    }

    const reassignResult = await aclService.reassignAndDeleteRole({
      companyId: company.id,
      roleId: customRole.id,
      targetRoleId: clonedCustom.id,
      transaction,
    });
    const sourceStillExists = await Role.findByPk(customRole.id, { transaction });
    const targetAssignment = await UserRole.findOne({
      where: { userId: user.id, companyId: company.id, roleId: clonedCustom.id },
      transaction,
    });
    check('reassign flow moves users and deletes source role',
      reassignResult.reassignedCount === 1 &&
      !sourceStillExists &&
      Boolean(targetAssignment)
    );

    const temporaryRole = await Role.create({
      id: uuidv4(),
      companyId: company.id,
      name: 'Temporary Custom',
      description: 'Unassigned lifecycle role',
      isDefault: false,
      isSystem: false,
    }, { transaction });
    const deleted = await aclService.deleteRole({ companyId: company.id, roleId: temporaryRole.id, transaction });
    check('unassigned custom role can be deleted', deleted === 1);

    const diff = await aclService.getRoleDiff({ companyId: company.id, roleId: managerRole.id, transaction });
    check('role diff reports no changes after reset',
      Array.isArray(diff?.added) && diff.added.length === 0 &&
      Array.isArray(diff?.removed) && diff.removed.length === 0
    );

    const failed = results.filter((result) => !result.ok);
    await transaction.rollback();
    await sequelize.close();

    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error(`Role lifecycle smoke failed: ${failed.map((result) => result.name).join('; ')}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log('Role lifecycle smoke passed.');
    process.exit(0);
  } catch (error) {
    await transaction.rollback().catch(() => {});
    await sequelize.close().catch(() => {});
    // eslint-disable-next-line no-console
    console.error('Role lifecycle smoke failed with exception:', error);
    process.exit(1);
  }
})();
