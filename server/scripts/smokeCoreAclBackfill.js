'use strict';

// Smoke: Core ACL backfill.
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
const { PERMISSIONS } = require('../src/constants/permissions');
const { DEFAULT_ROLE_META, DEFAULT_ROLE_SETS, DEPT_HEAD_PERMS } = require('../src/constants/aclDefaults');
const { WMS_PERMISSIONS } = require('../src/constants/wmsAclDefaults');
const { backfillCoreAcl } = require('../src/services/system/aclSyncService');

const results = [];
function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function permNamesForRole(roleId, transaction) {
  const rows = await RolePermission.findAll({
    attributes: ['permissionId'],
    where: { roleId },
    transaction,
  });
  const ids = rows.map((r) => r.permissionId);
  if (!ids.length) return new Set();
  const perms = await Permission.findAll({
    attributes: ['name'],
    where: { id: ids },
    transaction,
  });
  return new Set(perms.map((p) => p.name));
}

async function permissionIdForName(name, transaction) {
  const permission = await Permission.findOne({
    attributes: ['id'],
    where: { name },
    transaction,
  });
  if (!permission) throw new Error(`Missing permission ${name}`);
  return permission.id;
}

async function ensureRolePermission(roleId, permissionName, transaction) {
  const permissionId = await permissionIdForName(permissionName, transaction);
  await RolePermission.findOrCreate({
    where: { roleId, permissionId },
    defaults: { roleId, permissionId },
    transaction,
  });
}

function containsAll(set, names) {
  return names.every((name) => set.has(name));
}

function hasNoWriteishPermission(set) {
  return Array.from(set).every((name) => {
    if (name.includes(':read') || name === 'chat.read' || name === 'file:read' || name === 'attachment:read') {
      return true;
    }
    return !/(^|:)(create|update|delete|manage|assign|upload|issue|cancel|post|correct|convert|archive|publish|duplicate|run)$/.test(name);
  });
}

(async () => {
  const t = await sequelize.transaction();
  try {
    const catalog = new Set(PERMISSIONS);
    const roleSetNames = Object.values(DEFAULT_ROLE_SETS).flat();
    const missingFromCatalog = [...new Set([...roleSetNames, ...DEPT_HEAD_PERMS])]
      .filter((name) => !catalog.has(name));
    check(
      'all DEFAULT_ROLE_SETS and DEPT_HEAD_PERMS permissions exist in PERMISSIONS',
      missingFromCatalog.length === 0,
      missingFromCatalog.join(', ')
    );

    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await User.create({
      id: uuidv4(),
      email: `core-acl-owner-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: t });
    const admin = await User.create({
      id: uuidv4(),
      email: `core-acl-admin-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: t });
    const managerUser = await User.create({
      id: uuidv4(),
      email: `core-acl-manager-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: t });
    const employeeUser = await User.create({
      id: uuidv4(),
      email: `core-acl-user-${suffix}@example.test`,
      passwordHash: 'smoke',
      emailVerifiedAt: new Date(),
    }, { transaction: t });

    const company = await Company.create(
      { id: uuidv4(), name: `Core ACL Backfill Smoke ${suffix}`, ownerUserId: owner.id },
      { transaction: t }
    );
    const companyId = company.id;

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: admin.id, companyId, role: 'admin', status: 'active' },
      { id: uuidv4(), userId: managerUser.id, companyId, role: 'manager', status: 'active' },
      { id: uuidv4(), userId: employeeUser.id, companyId, role: 'user', status: 'active' },
    ], { transaction: t });

    const customRole = await Role.create({
      id: uuidv4(),
      companyId,
      name: `custom-${suffix}`,
      description: 'Smoke custom role',
    }, { transaction: t });
    await ensureRolePermission(customRole.id, 'company:delete', t);

    const report1 = await backfillCoreAcl({ transaction: t });
    check('first run processed companies', report1.companiesProcessed >= 1, `companies=${report1.companiesProcessed}`);
    check('viewer role created', report1.rolesCreatedByName.viewer >= 1);
    check('role permissions inserted', report1.rolePermissionsInserted > 0, `inserted=${report1.rolePermissionsInserted}`);
    check('user roles inserted', report1.userRolesInserted >= 4, `inserted=${report1.userRolesInserted}`);

    const roles = await Role.findAll({
      attributes: ['id', 'name', 'slug', 'isSystem', 'isDefault'],
      where: { companyId },
      transaction: t,
    });
    const roleBySlug = new Map(roles.filter((role) => role.slug).map((role) => [role.slug, role]));
    const defaultRoleSlugs = ['owner', 'admin', 'manager', 'employee', 'viewer'];
    check('default role set exists', defaultRoleSlugs.every((slug) => roleBySlug.has(slug)));
    check('default roles have slug', defaultRoleSlugs.every((slug) => roleBySlug.get(slug)?.slug === slug));
    check('default roles have isDefault=true', defaultRoleSlugs.every((slug) => roleBySlug.get(slug)?.isDefault === true));
    check('legacy user ACL role is not created', !roleBySlug.has('user'));
    check('owner/admin have isSystem=true',
      roleBySlug.get('owner')?.isSystem === true &&
      roleBySlug.get('admin')?.isSystem === true
    );
    check('non-system default roles have isSystem=false', ['manager', 'employee', 'viewer'].every((slug) => roleBySlug.get(slug)?.isSystem === false));
    const customRoleAfterSync = roles.find((role) => role.id === customRole.id);
    check('custom role keeps isDefault/isSystem=false',
      customRoleAfterSync?.isDefault === false &&
      customRoleAfterSync?.isSystem === false &&
      customRoleAfterSync?.slug === null
    );

    await ensureRolePermission(roleBySlug.get('admin').id, 'company:delete', t);
    await ensureRolePermission(roleBySlug.get('admin').id, 'permission:manage', t);
    await ensureRolePermission(roleBySlug.get('viewer').id, 'invoice:read', t);
    const pruneReport = await backfillCoreAcl({ transaction: t });
    check('default role prune removes obsolete grants', pruneReport.rolePermissionsDeleted >= 3, `deleted=${pruneReport.rolePermissionsDeleted}`);

    const ownerPerms = await permNamesForRole(roleBySlug.get('owner').id, t);
    const adminPerms = await permNamesForRole(roleBySlug.get('admin').id, t);
    const managerPerms = await permNamesForRole(roleBySlug.get('manager').id, t);
    const employeePerms = await permNamesForRole(roleBySlug.get('employee').id, t);
    const viewerPerms = await permNamesForRole(roleBySlug.get('viewer').id, t);

    check('owner has full catalog', containsAll(ownerPerms, PERMISSIONS));
    check('owner has company:delete', ownerPerms.has('company:delete'));
    check('owner has permission:manage', ownerPerms.has('permission:manage'));
    check('admin does NOT have company:delete', !adminPerms.has('company:delete'));
    check('admin does NOT have permission:manage', !adminPerms.has('permission:manage'));
    check('admin still has role:assign', adminPerms.has('role:assign'));
    check('admin still has permission:assign', adminPerms.has('permission:assign'));
    check('manager has expected operational rights', containsAll(managerPerms, [
      'counterparty:create',
      'counterparty:update',
      'deal:read:dept',
      'deal:update:dept',
      'task:read:dept',
      'task:update:dept',
      'document:template:manage',
      'price_list:update',
      'wms:document:post',
      'chat.write',
    ]));
    check('manager has no ACL/system/destructive settings rights',
      !managerPerms.has('role:create') &&
      !managerPerms.has('permission:assign') &&
      !managerPerms.has('permission:manage') &&
      !managerPerms.has('settings:update') &&
      !managerPerms.has('company:settings:update') &&
      !managerPerms.has('counterparty:delete')
    );
    check('employee has working baseline rights', containsAll(employeePerms, [
      'counterparty:create',
      'deal:create',
      'task:update:own',
      'document:template:read',
      'wms:inventory:read',
      'chat.write',
    ]));
    check('employee has no delete/manage/assign rights',
      !Array.from(employeePerms).some((name) => /(^|:)(delete|manage|assign)$/.test(name))
    );
    check('viewer has read-only baseline', containsAll(viewerPerms, [
      'company:read',
      'counterparty:read',
      'document:template:read',
      'price_list:read',
      'wms:reports:read',
      'chat.read',
      'attachment:read',
    ]));
    check('viewer does NOT have invoice:read', !viewerPerms.has('invoice:read'));
    check('viewer has no write/manage/assign permissions', hasNoWriteishPermission(viewerPerms));
    const customRolePerms = await permNamesForRole(customRole.id, t);
    check('custom role grants are not pruned', customRolePerms.has('company:delete'));

    const dbPerms = await Permission.findAll({
      attributes: ['name'],
      where: { name: PERMISSIONS },
      transaction: t,
    });
    const dbPermSet = new Set(dbPerms.map((perm) => perm.name));
    check('WMS permissions still exist', WMS_PERMISSIONS.every((name) => dbPermSet.has(name)));
    check('chat.read/chat.write still exist', dbPermSet.has('chat.read') && dbPermSet.has('chat.write'));
    check('attachment:* still exists',
      dbPermSet.has('attachment:read') &&
      dbPermSet.has('attachment:upload') &&
      dbPermSet.has('attachment:delete')
    );

    const rolePermissionRows = await RolePermission.findAll({
      attributes: ['roleId', 'permissionId'],
      where: { roleId: roles.map((role) => role.id) },
      transaction: t,
    });
    const uniqueRolePermissionRows = new Set(rolePermissionRows.map((row) => `${row.roleId}:${row.permissionId}`));
    check('role_permissions have no duplicates', uniqueRolePermissionRows.size === rolePermissionRows.length);

    const userRoleRows = await UserRole.findAll({
      attributes: ['userId', 'companyId', 'roleId'],
      where: { companyId },
      transaction: t,
    });
    const uniqueUserRoleRows = new Set(userRoleRows.map((row) => `${row.userId}:${row.companyId}:${row.roleId}`));
    check('user_roles have no duplicates', uniqueUserRoleRows.size === userRoleRows.length);
    check('owner assignment works via owner slug',
      userRoleRows.some((row) => row.userId === owner.id && row.roleId === roleBySlug.get('owner').id)
    );
    check('membership role user materializes employee ACL role',
      userRoleRows.some((row) => row.userId === employeeUser.id && row.roleId === roleBySlug.get('employee').id)
    );

    const report2 = await backfillCoreAcl({ transaction: t });
    check('second run creates no roles', report2.rolesCreated === 0, `created=${report2.rolesCreated}`);
    check('second run creates no role_permissions', report2.rolePermissionsInserted === 0, `inserted=${report2.rolePermissionsInserted}`);
    check('second run prunes no role_permissions', report2.rolePermissionsDeleted === 0, `deleted=${report2.rolePermissionsDeleted}`);
    check('second run creates no user_roles', report2.userRolesInserted === 0, `inserted=${report2.userRolesInserted}`);
    const rolesAfterSecondRun = await Role.findAll({
      attributes: ['id', 'slug'],
      where: { companyId },
      transaction: t,
    });
    const defaultSlugCounts = new Map();
    for (const role of rolesAfterSecondRun) {
      if (role.slug && DEFAULT_ROLE_META[role.slug]) {
        defaultSlugCounts.set(role.slug, (defaultSlugCounts.get(role.slug) || 0) + 1);
      }
    }
    check('second run creates no duplicate default slugs',
      defaultRoleSlugs.every((slug) => defaultSlugCounts.get(slug) === 1)
    );

    await t.rollback();

    const failed = results.filter((r) => !r.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((f) => f.name).join('; '));
      process.exit(1);
    }
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    try { await t.rollback(); } catch (_) { /* noop */ }
    // eslint-disable-next-line no-console
    console.error('smokeCoreAclBackfill crashed', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
})();
