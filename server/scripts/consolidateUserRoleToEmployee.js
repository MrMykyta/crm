'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Permission,
  Role,
  RolePermission,
  UserRole,
} = require('../src/models');

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function isLegacyUserRole(role) {
  return normalize(role?.slug) === 'user' || normalize(role?.name) === 'user';
}

function isEmployeeRole(role) {
  return normalize(role?.slug) === 'employee' || normalize(role?.name) === 'employee';
}

function roleSort(a, b) {
  return new Date(a.createdAt || 0) - new Date(b.createdAt || 0) || String(a.id).localeCompare(String(b.id));
}

function userRoleKey(row) {
  return `${row.userId}:${row.companyId}:${row.roleId}`;
}

async function ensureEmployeeRole({ companyId, roles, report, transaction }) {
  const existing = roles.filter(isEmployeeRole).sort(roleSort)[0] || null;
  if (existing) {
    const patch = {};
    if (existing.slug !== 'employee') patch.slug = 'employee';
    if (existing.isDefault !== true) patch.isDefault = true;
    if (existing.isSystem !== false) patch.isSystem = false;
    if (Object.keys(patch).length) {
      await existing.update(patch, { transaction });
      report.employeeRolesUpdated += 1;
    }
    return existing;
  }

  const role = await Role.create({
    id: uuidv4(),
    companyId,
    slug: 'employee',
    name: 'Employee',
    isSystem: false,
    isDefault: true,
    description: 'Default employee role',
  }, { transaction });
  report.employeeRolesCreated += 1;
  return role;
}

async function copyRolePermissions({ sourceRoleIds, targetRoleId, report, transaction }) {
  const sourceRows = await RolePermission.findAll({
    attributes: ['roleId', 'permissionId'],
    where: { roleId: sourceRoleIds },
    transaction,
  });
  if (!sourceRows.length) return;

  const targetRows = await RolePermission.findAll({
    attributes: ['permissionId'],
    where: { roleId: targetRoleId },
    transaction,
  });
  const targetPermissionIds = new Set(targetRows.map((row) => String(row.permissionId)));
  const rowsToCreate = [];

  for (const row of sourceRows) {
    const permissionId = String(row.permissionId);
    if (targetPermissionIds.has(permissionId)) {
      report.rolePermissionsSkippedExisting += 1;
      continue;
    }
    rowsToCreate.push({ roleId: targetRoleId, permissionId: row.permissionId });
    targetPermissionIds.add(permissionId);
  }

  if (rowsToCreate.length) {
    await RolePermission.bulkCreate(rowsToCreate, { ignoreDuplicates: true, transaction });
    report.rolePermissionsMoved += rowsToCreate.length;
  }
}

async function moveUserRoles({ companyId, sourceRoleIds, targetRoleId, report, transaction }) {
  const legacyAssignments = await UserRole.findAll({
    attributes: ['userId', 'companyId', 'roleId'],
    where: { companyId, roleId: sourceRoleIds },
    transaction,
  });
  if (!legacyAssignments.length) return;

  const employeeAssignments = await UserRole.findAll({
    attributes: ['userId', 'companyId', 'roleId'],
    where: { companyId, roleId: targetRoleId },
    transaction,
  });
  const existing = new Set(employeeAssignments.map(userRoleKey));
  const rowsToCreate = [];

  for (const row of legacyAssignments) {
    const next = { userId: row.userId, companyId: row.companyId, roleId: targetRoleId };
    const key = userRoleKey(next);
    if (existing.has(key)) {
      report.userRolesSkippedExisting += 1;
      continue;
    }
    rowsToCreate.push(next);
    existing.add(key);
  }

  if (rowsToCreate.length) {
    await UserRole.bulkCreate(rowsToCreate, { ignoreDuplicates: true, transaction });
    report.userRolesMoved += rowsToCreate.length;
  }

  const deleted = await UserRole.destroy({
    where: { companyId, roleId: sourceRoleIds },
    transaction,
  });
  report.legacyUserRoleAssignmentsDeleted += deleted;
}

async function deleteOrHideLegacyRoles({ companyId, legacyRoles, report, transaction }) {
  for (const role of legacyRoles) {
    const remainingAssignments = await UserRole.count({
      where: { companyId, roleId: role.id },
      transaction,
    });
    if (remainingAssignments > 0) {
      await role.update({
        isDefault: false,
        isSystem: false,
        description: role.description || 'Legacy ACL user role retired; hidden after Employee consolidation.',
      }, { transaction });
      report.legacyUserRolesHidden += 1;
      continue;
    }

    try {
      const deleted = await Role.destroy({
        where: { id: role.id, companyId },
        transaction,
      });
      report.legacyUserRolesDeleted += deleted;
    } catch (error) {
      await role.update({
        isDefault: false,
        isSystem: false,
        description: role.description || 'Legacy ACL user role retired; hidden after Employee consolidation.',
      }, { transaction });
      report.legacyUserRolesHidden += 1;
      report.warnings.push({
        companyId,
        roleId: role.id,
        type: 'legacy_user_role_delete_failed_hidden',
        message: error.message,
      });
    }
  }
}

async function consolidateUserRoleToEmployee({ execute = false, transaction: externalTransaction = null } = {}) {
  const ownTransaction = !externalTransaction;
  const transaction = externalTransaction || await sequelize.transaction();
  const report = {
    mode: execute ? 'execute' : 'dry-run',
    companiesProcessed: 0,
    companiesWithLegacyUserRole: 0,
    employeeRolesCreated: 0,
    employeeRolesUpdated: 0,
    rolePermissionsMoved: 0,
    rolePermissionsSkippedExisting: 0,
    userRolesMoved: 0,
    userRolesSkippedExisting: 0,
    legacyUserRoleAssignmentsDeleted: 0,
    legacyUserRolesDeleted: 0,
    legacyUserRolesHidden: 0,
    warnings: [],
  };

  try {
    await Permission.findAll({ attributes: ['id'], limit: 1, transaction });
    const companies = await Company.findAll({ attributes: ['id'], transaction });
    report.companiesProcessed = companies.length;

    for (const company of companies) {
      const companyId = company.id;
      const roles = await Role.findAll({
        where: { companyId },
        order: [['createdAt', 'ASC'], ['id', 'ASC']],
        transaction,
      });
      const legacyRoles = roles.filter(isLegacyUserRole).sort(roleSort);
      if (!legacyRoles.length) continue;

      report.companiesWithLegacyUserRole += 1;
      const employeeRole = await ensureEmployeeRole({ companyId, roles, report, transaction });
      const sourceRoleIds = legacyRoles.map((role) => role.id).filter((id) => id !== employeeRole.id);
      if (!sourceRoleIds.length) continue;

      await copyRolePermissions({
        sourceRoleIds,
        targetRoleId: employeeRole.id,
        report,
        transaction,
      });
      await moveUserRoles({
        companyId,
        sourceRoleIds,
        targetRoleId: employeeRole.id,
        report,
        transaction,
      });
      await deleteOrHideLegacyRoles({
        companyId,
        legacyRoles: legacyRoles.filter((role) => role.id !== employeeRole.id),
        report,
        transaction,
      });
    }

    if (ownTransaction) {
      if (execute) {
        await transaction.commit();
      } else {
        await transaction.rollback();
      }
    }

    return report;
  } catch (error) {
    if (ownTransaction) {
      try { await transaction.rollback(); } catch (_) { /* noop */ }
    }
    throw error;
  }
}

async function main() {
  const execute = process.argv.includes('--execute');
  try {
    const report = await consolidateUserRoleToEmployee({ execute });
    // eslint-disable-next-line no-console
    console.log(`[acl:consolidate:user-role] ${execute ? 'EXECUTE' : 'DRY-RUN'} OK`);
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(report, null, 2));
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[acl:consolidate:user-role] FAILED', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  consolidateUserRoleToEmployee,
  isLegacyUserRole,
};
