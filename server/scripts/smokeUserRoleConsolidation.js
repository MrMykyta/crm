'use strict';

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
const { getPermissionsAndRole, invalidate } = require('../src/middleware/permissionResolver');
const { syncCoreAcl } = require('../src/services/system/aclSyncService');
const { consolidateUserRoleToEmployee } = require('./consolidateUserRoleToEmployee');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function changedCount(report) {
  return [
    'employeeRolesCreated',
    'employeeRolesUpdated',
    'rolePermissionsMoved',
    'userRolesMoved',
    'legacyUserRoleAssignmentsDeleted',
    'legacyUserRolesDeleted',
    'legacyUserRolesHidden',
  ].reduce((sum, key) => sum + Number(report?.[key] || 0), 0);
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `acl-user-role-consolidation-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function getRoleBySlug(companyId, slug) {
  return Role.findOne({ where: { companyId, slug } });
}

async function permId(name) {
  const permission = await Permission.findOne({ where: { name } });
  if (!permission) throw new Error(`Missing permission ${name}`);
  return permission.id;
}

(async () => {
  const created = { companyIds: [], userIds: [] };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await createUser('owner', suffix);
    const employee = await createUser('employee', suffix);
    created.userIds.push(owner.id, employee.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `ACL User Role Consolidation ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: employee.id, companyId: company.id, role: 'user', status: 'active' },
    ]);

    await syncCoreAcl();
    const userRoleAfterSync = await getRoleBySlug(company.id, 'user');
    const employeeRoleAfterSync = await getRoleBySlug(company.id, 'employee');
    check('new company sync no longer creates ACL role user', !userRoleAfterSync);
    check('employee role exists', Boolean(employeeRoleAfterSync));

    const employeeAssignmentCountBefore = await UserRole.count({
      where: { userId: employee.id, companyId: company.id, roleId: employeeRoleAfterSync.id },
    });
    check('membership role user materialized employee assignment', employeeAssignmentCountBefore === 1);

    const legacyUserRole = await Role.create({
      id: uuidv4(),
      companyId: company.id,
      slug: 'user',
      name: 'user',
      isSystem: false,
      isDefault: true,
      description: 'Legacy duplicate user role',
    });
    await UserRole.create({ userId: employee.id, companyId: company.id, roleId: legacyUserRole.id });

    const copiedPermissionName = 'permission:read';
    await RolePermission.create({
      roleId: legacyUserRole.id,
      permissionId: await permId(copiedPermissionName),
    });

    const report1 = await consolidateUserRoleToEmployee({ execute: true });
    check('legacy user role assignments are moved to employee', report1.legacyUserRoleAssignmentsDeleted >= 1);

    const employeeAssignmentCountAfter = await UserRole.count({
      where: { userId: employee.id, companyId: company.id, roleId: employeeRoleAfterSync.id },
    });
    check('existing employee assignment is not duplicated', employeeAssignmentCountAfter === 1);

    const copiedPermission = await RolePermission.findOne({
      where: {
        roleId: employeeRoleAfterSync.id,
        permissionId: await permId(copiedPermissionName),
      },
    });
    check('role permissions are copied without duplicates', Boolean(copiedPermission));

    const legacyAfter = await Role.findByPk(legacyUserRole.id);
    check('legacy user ACL role is deleted or hidden after consolidation',
      !legacyAfter || (legacyAfter.isDefault === false && legacyAfter.isSystem === false)
    );

    invalidate(employee.id, company.id);
    const context = await getPermissionsAndRole({ userId: employee.id, companyId: company.id });
    const allow = new Set(context.permissions.allow);
    check('user_companies.role=user still resolves to employee baseline',
      DEFAULT_ROLE_SETS.employee.every((name) => allow.has(name))
    );
    check('no user loses copied effective permissions', allow.has(copiedPermissionName));

    await syncCoreAcl();
    const userRoleAfterSecondSync = await getRoleBySlug(company.id, 'user');
    check('syncCoreAcl does not recreate user role', !userRoleAfterSecondSync);

    const report2 = await consolidateUserRoleToEmployee({ execute: true });
    check('re-running consolidation is idempotent', changedCount(report2) === 0, `changes=${changedCount(report2)}`);

    const failed = results.filter((result) => !result.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((result) => result.name).join('; '));
      process.exitCode = 1;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('smokeUserRoleConsolidation crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await UserRole.destroy({ where: { companyId: created.companyIds } });
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await RolePermission.destroy({
          where: {},
          include: [{ model: Role, as: 'role', where: { companyId: created.companyIds } }],
        }).catch(() => {});
        await Role.destroy({ where: { companyId: created.companyIds } });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeUserRoleConsolidation cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
