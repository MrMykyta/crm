'use strict';

// Runtime smoke for WMS-POLICY-1 Default MAIN Warehouse Bootstrap.
//
// Creates a real smoke user/company through companyService.createWithOwner and verifies
// that MAIN warehouse exists immediately. This script does not create locations.
//
// Run:
//   node scripts/smokeMainWarehouseBootstrap.js

const crypto = require('crypto');
const { sequelize, User, Warehouse, Location } = require('../src/models');
const companyService = require('../src/services/crm/companyService');
const { ensureMainWarehouse, resolveDefaultWarehouseId } = require('../src/services/wms/warehouseResolver');

const results = [];

function check(name, cond, extra) {
  const ok = !!cond;
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

(async () => {
  let exitCode = 0;

  try {
    await sequelize.authenticate();

    const suffix = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const user = await User.create({
      email: `smoke-main-warehouse-${suffix}@example.com`,
      passwordHash: crypto.randomUUID(),
      firstName: 'Smoke',
      lastName: 'Warehouse',
      isActive: true,
      emailVerifiedAt: new Date(),
      createdBy: null,
    });

    const company = await companyService.createWithOwner(user.id, {
      name: `Smoke MAIN Warehouse ${suffix}`,
    });

    const main = await Warehouse.findOne({
      where: { companyId: company.id, code: 'MAIN' },
    });
    check('company create -> MAIN warehouse exists', main && main.companyId === company.id, `companyId=${company.id}`);
    check('MAIN warehouse is active', main && main.isActive === true, `isActive=${main && main.isActive}`);
    check('MAIN warehouse name is Main Warehouse', main && main.name === 'Main Warehouse', `name=${main && main.name}`);

    const again = await ensureMainWarehouse(company.id);
    const mainCount = await Warehouse.count({ where: { companyId: company.id, code: 'MAIN' } });
    check('ensureMainWarehouse is idempotent', again && main && again.id === main.id && mainCount === 1,
      `again=${again && again.id} count=${mainCount}`);

    const resolvedId = await resolveDefaultWarehouseId(company.id);
    check('resolveDefaultWarehouseId still resolves MAIN', main && resolvedId === main.id,
      `resolved=${resolvedId} expected=${main && main.id}`);

    const locationCount = await Location.count({ where: { companyId: company.id } });
    check('bootstrap creates no location', locationCount === 0, `locations=${locationCount}`);
  } catch (error) {
    exitCode = 1;
    check('script execution', false, error && error.message);
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    await sequelize.close();
  }

  const failed = results.filter((result) => !result.ok);
  // eslint-disable-next-line no-console
  console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} checks passed.`);
  process.exit(exitCode || (failed.length ? 1 : 0));
})();
