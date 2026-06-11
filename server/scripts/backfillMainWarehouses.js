'use strict';

// Backfill MAIN warehouses for existing companies.
//
// Dry run by default:
//   node scripts/backfillMainWarehouses.js
//
// Apply changes explicitly:
//   node scripts/backfillMainWarehouses.js --write
//
// This script creates/activates warehouses only. It never creates locations.

const { sequelize, Company, Warehouse, Location } = require('../src/models');
const { ensureMainWarehouse, DEFAULT_MAIN_WAREHOUSE } = require('../src/services/wms/warehouseResolver');

const WRITE = process.argv.includes('--write');

async function inspectCompany(company, transaction) {
  const main = await Warehouse.findOne({
    where: { companyId: company.id, code: DEFAULT_MAIN_WAREHOUSE.code },
    transaction,
  });

  if (!main) {
    return { company, action: 'create' };
  }

  if (!main.isActive) {
    return { company, action: 'activate', warehouseId: main.id };
  }

  return { company, action: 'skip', warehouseId: main.id };
}

(async () => {
  let exitCode = 0;

  try {
    await sequelize.authenticate();

    const companies = await Company.findAll({
      attributes: ['id', 'name'],
      order: [['createdAt', 'ASC']],
    });

    const plan = [];
    for (const company of companies) {
      plan.push(await inspectCompany(company));
    }

    const actionable = plan.filter((item) => item.action !== 'skip');

    // eslint-disable-next-line no-console
    console.log(`MAIN warehouse backfill (${WRITE ? 'write' : 'dry-run'})`);
    // eslint-disable-next-line no-console
    console.log(`Companies: ${companies.length}; create/activate: ${actionable.length}`);

    for (const item of actionable) {
      // eslint-disable-next-line no-console
      console.log(`${item.action.toUpperCase()} MAIN for company ${item.company.id} (${item.company.name})`);
    }

    if (!WRITE) {
      // eslint-disable-next-line no-console
      console.log('No changes written. Re-run with --write to apply.');
      return;
    }

    await sequelize.transaction(async (transaction) => {
      for (const item of actionable) {
        await ensureMainWarehouse(item.company.id, { transaction });
      }
    });

    const createdLocationCount = await Location.count({
      include: [{
        model: Warehouse,
        as: 'warehouse',
        required: true,
        where: { code: DEFAULT_MAIN_WAREHOUSE.code },
      }],
    });

    // eslint-disable-next-line no-console
    console.log(`Applied MAIN warehouse backfill. Locations under MAIN warehouses: ${createdLocationCount}`);
  } catch (error) {
    exitCode = 1;
    // eslint-disable-next-line no-console
    console.error(error);
  } finally {
    await sequelize.close();
    process.exit(exitCode);
  }
})();
