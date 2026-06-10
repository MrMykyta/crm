'use strict';

// ACL sync service — безопасная (additive-only, idempotent) синхронизация WMS-прав
// для уже существующих компаний/ролей.
//
// Гарантии:
//  - НИЧЕГО не удаляет: ни role_permissions, ни user_permissions (кастомные override).
//  - Только ДОБАВЛЯЕТ недостающие WMS-права ролям согласно их default-набору
//    (см. constants/wmsAclDefaults.js).
//  - Idempotent: повторный запуск не создаёт дубликатов и не добавляет ничего нового.
//  - Кастомные/неизвестные роли пропускаются — лишние права не выдаются.
//
// Используется script `npm run acl:sync:wms` и smoke-проверкой. Аналогичная по логике
// data-миграция выполняет backfill автоматически при деплое.

const { v4: uuidv4 } = require('uuid');
const { sequelize, Permission, Role, RolePermission } = require('../../models');
const { WMS_PERMISSIONS, wmsDefaultsForRole } = require('../../constants/wmsAclDefaults');

/**
 * Гарантирует наличие всех WMS-прав в глобальном каталоге `permissions`.
 * @returns {Promise<{created: string[], permIdByName: Map<string,string>}>}
 */
async function ensureWmsPermissionCatalog({ transaction } = {}) {
  const existing = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: WMS_PERMISSIONS },
    transaction,
  });
  const existingNames = new Set(existing.map((p) => p.name));

  const toInsert = WMS_PERMISSIONS
    .filter((name) => !existingNames.has(name))
    .map((name) => ({ id: uuidv4(), name, description: null }));

  if (toInsert.length) {
    // ignoreDuplicates на случай гонки/повторного запуска (name UNIQUE).
    await Permission.bulkCreate(toInsert, { ignoreDuplicates: true, transaction });
  }

  const all = await Permission.findAll({
    attributes: ['id', 'name'],
    where: { name: WMS_PERMISSIONS },
    transaction,
  });

  return {
    created: toInsert.map((r) => r.name),
    permIdByName: new Map(all.map((p) => [p.name, p.id])),
  };
}

/**
 * Бэкфилл WMS-прав для всех существующих ролей всех компаний.
 * Additive-only: добавляются только недостающие grants.
 *
 * @returns {Promise<object>} отчёт о выполнении
 */
async function backfillWmsRolePermissions({ transaction } = {}) {
  const { created, permIdByName } = await ensureWmsPermissionCatalog({ transaction });

  const roles = await Role.findAll({
    attributes: ['id', 'name', 'companyId'],
    transaction,
  });

  const report = {
    permissionsCreated: created,
    rolesProcessed: 0,
    rolesSkipped: 0,
    grantsAdded: 0,
    addedByRoleName: {},
    skippedRoleNames: [],
  };

  const companies = new Set();
  const newRows = [];

  for (const role of roles) {
    const wmsPerms = wmsDefaultsForRole(role.name);
    if (!wmsPerms.length) {
      // неизвестная/кастомная роль — не выдаём лишних прав
      report.rolesSkipped += 1;
      if (!report.skippedRoleNames.includes(role.name)) {
        report.skippedRoleNames.push(role.name);
      }
      continue;
    }

    report.rolesProcessed += 1;
    companies.add(String(role.companyId));

    // Существующие права роли — чтобы добавить только diff и не перетереть кастомные.
    const existing = await RolePermission.findAll({
      attributes: ['permissionId'],
      where: { roleId: role.id },
      transaction,
    });
    const existingSet = new Set(existing.map((rp) => String(rp.permissionId)));

    let added = 0;
    for (const permName of wmsPerms) {
      const permissionId = permIdByName.get(permName);
      if (permissionId && !existingSet.has(String(permissionId))) {
        newRows.push({ roleId: role.id, permissionId });
        added += 1;
      }
    }
    if (added) {
      report.addedByRoleName[role.name] = (report.addedByRoleName[role.name] || 0) + added;
    }
  }

  if (newRows.length) {
    // composite PK (role_id, permission_id) → ignoreDuplicates = ON CONFLICT DO NOTHING.
    await RolePermission.bulkCreate(newRows, { ignoreDuplicates: true, transaction });
    report.grantsAdded = newRows.length;
  }

  report.companiesAffected = companies.size;
  return report;
}

/**
 * Точка входа: выполняет полный WMS ACL backfill в одной транзакции.
 * @returns {Promise<object>} отчёт
 */
async function syncWmsAcl() {
  return sequelize.transaction((transaction) => backfillWmsRolePermissions({ transaction }));
}

module.exports = {
  ensureWmsPermissionCatalog,
  backfillWmsRolePermissions,
  syncWmsAcl,
};
