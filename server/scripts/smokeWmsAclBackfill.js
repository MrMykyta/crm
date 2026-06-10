'use strict';

// Smoke: WMS ACL backfill.
// NON-DESTRUCTIVE: всё выполняется в одной транзакции и ВСЕГДА откатывается.
//
// Проверяет:
//  - каталог permissions содержит все WMS-права;
//  - owner/admin получают все WMS-права;
//  - manager получает операционный набор, но НЕ costing/settings;
//  - employee/user получают только read, НЕ document:post;
//  - viewer — только read, без manage/post;
//  - finance — read + costing:manage;
//  - кастомная роль не получает ничего (без over-grant);
//  - кастомные (ручные) права роли сохраняются;
//  - повторный запуск идемпотентен (0 новых grants).

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Role,
  Permission,
  RolePermission,
} = require('../src/models');
const {
  WMS_PERMISSIONS,
  WMS_READONLY,
  WMS_FINANCE,
} = require('../src/constants/wmsAclDefaults');
const {
  ensureWmsPermissionCatalog,
  backfillWmsRolePermissions,
} = require('../src/services/system/aclSyncService');

const results = [];
function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} — ${name}${extra ? ` :: ${extra}` : ''}`);
}

const MANAGER_EXPECTED = [
  'wms:read',
  'wms:warehouse:manage',
  'wms:location:manage',
  'wms:document:create',
  'wms:document:update',
  'wms:document:post',
  'wms:document:correct',
  'wms:inventory:read',
  'wms:inventory:count',
  'wms:reservation:manage',
  'wms:picking:manage',
  'wms:reports:read',
];

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

(async () => {
  const t = await sequelize.transaction();
  try {
    const suffix = Date.now();
    const company = await Company.create(
      { name: `WMS ACL Backfill Smoke ${suffix}` },
      { transaction: t }
    );
    const companyId = company.id;

    // Роли, имитирующие существующую (pre-Phase) компанию: WMS-прав ещё нет.
    const roleDefs = ['owner', 'admin', 'manager', 'employee', 'user', 'viewer', 'finance', 'salescustom'];
    const roleByName = {};
    for (const name of roleDefs) {
      roleByName[name] = await Role.create(
        { id: uuidv4(), companyId, name, description: `smoke ${name}` },
        { transaction: t }
      );
    }

    // Каталог WMS-прав (внутри транзакции; в реальной БД они уже есть).
    const { permIdByName } = await ensureWmsPermissionCatalog({ transaction: t });
    check(
      'catalog contains all WMS permissions',
      WMS_PERMISSIONS.every((p) => permIdByName.has(p)),
      `${permIdByName.size}/${WMS_PERMISSIONS.length}`
    );

    // Кастомное (ручное) право manager-у — должно сохраниться после backfill.
    const customPerm = await Permission.findOne({
      where: { name: 'counterparty:read' },
      transaction: t,
    });
    let customPermId = customPerm && customPerm.id;
    if (!customPermId) {
      const created = await Permission.create(
        { id: uuidv4(), name: 'counterparty:read', description: null },
        { transaction: t }
      );
      customPermId = created.id;
    }
    await RolePermission.findOrCreate({
      where: { roleId: roleByName.manager.id, permissionId: customPermId },
      defaults: { roleId: roleByName.manager.id, permissionId: customPermId },
      transaction: t,
    });

    // 1-й прогон backfill.
    const report1 = await backfillWmsRolePermissions({ transaction: t });
    check('first run added grants (>0)', report1.grantsAdded > 0, `added=${report1.grantsAdded}`);
    check(
      'custom role skipped (no over-grant)',
      report1.skippedRoleNames.includes('salescustom'),
      `skipped=${JSON.stringify(report1.skippedRoleNames)}`
    );

    // Проверки по ролям.
    const owner = await permNamesForRole(roleByName.owner.id, t);
    const admin = await permNamesForRole(roleByName.admin.id, t);
    const manager = await permNamesForRole(roleByName.manager.id, t);
    const employee = await permNamesForRole(roleByName.employee.id, t);
    const user = await permNamesForRole(roleByName.user.id, t);
    const viewer = await permNamesForRole(roleByName.viewer.id, t);
    const finance = await permNamesForRole(roleByName.finance.id, t);
    const salescustom = await permNamesForRole(roleByName.salescustom.id, t);

    check('owner has ALL WMS perms', WMS_PERMISSIONS.every((p) => owner.has(p)));
    check('admin has ALL WMS perms', WMS_PERMISSIONS.every((p) => admin.has(p)));

    check(
      'manager has operational set',
      MANAGER_EXPECTED.every((p) => manager.has(p)),
      `${MANAGER_EXPECTED.filter((p) => manager.has(p)).length}/${MANAGER_EXPECTED.length}`
    );
    check('manager does NOT have wms:costing:manage', !manager.has('wms:costing:manage'));
    check('manager does NOT have wms:settings:update', !manager.has('wms:settings:update'));
    check('manager custom perm preserved (counterparty:read)', manager.has('counterparty:read'));

    check('employee read-only set', WMS_READONLY.every((p) => employee.has(p)));
    check('employee does NOT have wms:document:post', !employee.has('wms:document:post'));
    check('user read-only set', WMS_READONLY.every((p) => user.has(p)));
    check('user does NOT have wms:document:post', !user.has('wms:document:post'));

    check('viewer read-only set', WMS_READONLY.every((p) => viewer.has(p)));
    check(
      'viewer has NO manage/post perms',
      !viewer.has('wms:document:post') &&
        !viewer.has('wms:warehouse:manage') &&
        !viewer.has('wms:costing:manage')
    );

    check('finance set = read + costing', WMS_FINANCE.every((p) => finance.has(p)));
    check('finance does NOT have wms:document:post', !finance.has('wms:document:post'));

    check('custom role got NO WMS perms', WMS_PERMISSIONS.every((p) => !salescustom.has(p)));

    // 2-й прогон — идемпотентность.
    const report2 = await backfillWmsRolePermissions({ transaction: t });
    check('second run is idempotent (0 new grants)', report2.grantsAdded === 0, `added=${report2.grantsAdded}`);

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
    console.error('smokeWmsAclBackfill crashed', error);
    await sequelize.close().catch(() => {});
    process.exit(1);
  }
})();
