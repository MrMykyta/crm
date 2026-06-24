'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  CompanyDepartment,
  Counterparty,
  User,
  UserCompany,
} = require('../src/models');
const counterpartyService = require('../src/services/crm/counterpartyService');
const { isCounterpartyDeptScopeEnabled, isDeptScopeEnabled } = require('../src/acl');
const { runBackfill } = require('./backfillCounterpartyDepartments');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `counterparty-backfill-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function createCounterparty(companyId, suffix, label, patch = {}) {
  return Counterparty.create({
    id: uuidv4(),
    companyId,
    shortName: `BF ${label} ${suffix}`,
    fullName: `Backfill ${label} ${suffix}`,
    type: 'client',
    status: 'active',
    isCompany: true,
    ...patch,
  });
}

async function departmentOf(counterpartyId) {
  const row = await Counterparty.findByPk(counterpartyId, { attributes: ['departmentId'] });
  return row?.departmentId || null;
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await createUser('owner', suffix);
    const responsible = await createUser('responsible', suffix);
    const creator = await createUser('creator', suffix);
    const unassigned = await createUser('unassigned', suffix);
    created.userIds.push(owner.id, responsible.id, creator.id, unassigned.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Counterparty Department Backfill Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    created.companyIds.push(company.id);

    const sales = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Sales ${suffix}`,
      code: `sales-${suffix.slice(-8)}`,
      isActive: true,
    });
    const accounting = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Accounting ${suffix}`,
      code: `acct-${suffix.slice(-8)}`,
      isActive: true,
    });
    const warehouse = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Warehouse ${suffix}`,
      code: `wh-${suffix.slice(-8)}`,
      isActive: true,
    });

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: responsible.id, companyId: company.id, role: 'user', status: 'active', departmentId: sales.id },
      { id: uuidv4(), userId: creator.id, companyId: company.id, role: 'user', status: 'active', departmentId: accounting.id },
      { id: uuidv4(), userId: unassigned.id, companyId: company.id, role: 'user', status: 'active' },
    ]);

    const existing = await createCounterparty(company.id, suffix, 'existing', {
      departmentId: warehouse.id,
      mainResponsibleUserId: responsible.id,
      createdBy: creator.id,
    });
    const byResponsible = await createCounterparty(company.id, suffix, 'responsible', {
      mainResponsibleUserId: responsible.id,
      createdBy: creator.id,
    });
    const byCreator = await createCounterparty(company.id, suffix, 'creator', {
      createdBy: creator.id,
    });
    const remainsNull = await createCounterparty(company.id, suffix, 'null', {
      mainResponsibleUserId: unassigned.id,
    });

    const visibilityBefore = await counterpartyService.list(company.id, { limit: 100 });
    const dryRun = await runBackfill({ dryRun: true, execute: false, companyId: company.id });
    check('dry-run reports rows to tag', dryRun.before.wouldTag === 2, `wouldTag=${dryRun.before.wouldTag}`);
    check('dry-run does not change data', await departmentOf(byResponsible.id) === null && await departmentOf(byCreator.id) === null);

    const execute = await runBackfill({ dryRun: false, execute: true, companyId: company.id });
    check('execute updates only resolvable NULL rows', execute.updatedRows === 2, `updated=${execute.updatedRows}`);
    check('responsible priority fills department', await departmentOf(byResponsible.id) === sales.id);
    check('creator fallback fills department', await departmentOf(byCreator.id) === accounting.id);
    check('existing departmentId is not overwritten', await departmentOf(existing.id) === warehouse.id);
    check('unresolvable row remains NULL', await departmentOf(remainsNull.id) === null);

    const secondExecute = await runBackfill({ dryRun: false, execute: true, companyId: company.id });
    check('repeated execute is idempotent', secondExecute.updatedRows === 0, `updated=${secondExecute.updatedRows}`);
    check('coverage grows or stays the same', execute.after.currentCoveragePercent >= dryRun.before.currentCoveragePercent);

    const visibilityAfter = await counterpartyService.list(company.id, { limit: 100 });
    check('counterparty visibility count is unchanged', visibilityAfter.total === visibilityBefore.total);
    check('dept scope flags remain off', isDeptScopeEnabled() === false && isCounterpartyDeptScopeEnabled() === false);

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
    console.error('smokeCounterpartyDepartmentBackfill crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await Counterparty.destroy({ where: { companyId: created.companyIds }, force: true });
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await CompanyDepartment.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeCounterpartyDepartmentBackfill cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
