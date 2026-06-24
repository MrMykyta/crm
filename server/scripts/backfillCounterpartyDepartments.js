'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Counterparty,
  CompanyDepartment,
  UserCompany,
} = require('../src/models');

const OWNER_FIELD = 'ownerId';
const RESOLUTION_STEPS = [
  { key: 'mainResponsibleUserId', label: 'mainResponsibleUserId' },
  { key: OWNER_FIELD, label: OWNER_FIELD },
  { key: 'createdBy', label: 'createdBy' },
];

function hasOwnerField() {
  return Boolean(Counterparty.rawAttributes?.[OWNER_FIELD]);
}

function getActiveResolutionSteps() {
  return RESOLUTION_STEPS.filter((step) => step.key !== OWNER_FIELD || hasOwnerField());
}

function parseArgs(argv = process.argv.slice(2)) {
  const execute = argv.includes('--execute');
  const dryRun = argv.includes('--dry-run') || !execute;
  return { dryRun, execute };
}

function percent(numerator, denominator) {
  if (!denominator) return 100;
  return Math.round((numerator / denominator) * 10000) / 100;
}

function emptyDistributionItem(department) {
  return {
    id: department.id,
    name: department.name || department.code || department.id,
    code: department.code || null,
    count: 0,
  };
}

async function loadMembershipMap(companyId) {
  const rows = await UserCompany.findAll({
    where: { companyId, status: 'active' },
    attributes: ['userId', 'departmentId'],
  });
  return rows.reduce((acc, row) => {
    if (row.userId && row.departmentId) acc.set(String(row.userId), String(row.departmentId));
    return acc;
  }, new Map());
}

async function loadDepartmentMap(companyId) {
  const departments = await CompanyDepartment.findAll({
    where: { companyId },
    paranoid: false,
    attributes: ['id', 'name', 'code'],
    order: [['name', 'ASC']],
  });
  return departments.reduce((acc, department) => {
    acc.set(String(department.id), emptyDistributionItem(department));
    return acc;
  }, new Map());
}

function resolveDepartmentId(row, membershipMap, steps = getActiveResolutionSteps()) {
  for (const step of steps) {
    const userId = row[step.key];
    if (!userId) continue;
    const departmentId = membershipMap.get(String(userId));
    if (departmentId) {
      return { departmentId, source: step.label, userId: String(userId) };
    }
  }
  return { departmentId: null, source: null, userId: null };
}

function incrementDistribution(distribution, departmentId, fallbackName = 'Unknown department') {
  if (!departmentId) return;
  const key = String(departmentId);
  const item = distribution.get(key) || {
    id: key,
    name: fallbackName,
    code: null,
    count: 0,
  };
  item.count += 1;
  distribution.set(key, item);
}

function toDistributionArray(distribution) {
  return [...distribution.values()]
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count || String(a.name).localeCompare(String(b.name)));
}

async function analyzeCompany(companyId) {
  const departments = await loadDepartmentMap(companyId);
  const membershipMap = await loadMembershipMap(companyId);
  const attributes = ['id', 'companyId', 'departmentId', 'mainResponsibleUserId', 'createdBy'];
  if (hasOwnerField()) attributes.push(OWNER_FIELD);

  const rows = await Counterparty.findAll({
    where: { companyId },
    attributes,
    order: [['createdAt', 'ASC']],
  });

  const currentDistribution = new Map([...departments.entries()].map(([id, item]) => [id, { ...item }]));
  const wouldDistribution = new Map([...departments.entries()].map(([id, item]) => [id, { ...item }]));
  const updates = [];
  let alreadyTagged = 0;
  let wouldRemainNull = 0;

  for (const row of rows) {
    const plain = row.get({ plain: true });
    if (plain.departmentId) {
      alreadyTagged += 1;
      incrementDistribution(currentDistribution, plain.departmentId);
      continue;
    }

    const resolved = resolveDepartmentId(plain, membershipMap);
    if (resolved.departmentId) {
      updates.push({
        id: plain.id,
        departmentId: resolved.departmentId,
        source: resolved.source,
        userId: resolved.userId,
      });
      incrementDistribution(wouldDistribution, resolved.departmentId);
    } else {
      wouldRemainNull += 1;
    }
  }

  const total = rows.length;
  const wouldTag = updates.length;
  const finalTagged = alreadyTagged + wouldTag;

  return {
    companyId,
    total,
    alreadyTagged,
    wouldTag,
    wouldRemainNull,
    coveragePercent: percent(finalTagged, total),
    currentCoveragePercent: percent(alreadyTagged, total),
    distribution: toDistributionArray(currentDistribution),
    wouldDistribution: toDistributionArray(wouldDistribution),
    updates,
    ownerFieldAvailable: hasOwnerField(),
    resolutionOrder: getActiveResolutionSteps().map((step) => step.label),
  };
}

async function analyzeAllCompanies() {
  const rows = await Counterparty.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('company_id')), 'companyId']],
    raw: true,
  });
  const companyIds = rows.map((row) => row.companyId).filter(Boolean);
  const companies = [];
  for (const companyId of companyIds) {
    companies.push(await analyzeCompany(companyId));
  }
  return summarizeCompanies(companies);
}

function mergeDistribution(target, items) {
  for (const item of items || []) {
    const key = String(item.id);
    const existing = target.get(key) || { ...item, count: 0 };
    existing.count += item.count || 0;
    target.set(key, existing);
  }
}

function summarizeCompanies(companies) {
  const currentDistribution = new Map();
  const wouldDistribution = new Map();
  const totals = companies.reduce((acc, company) => {
    acc.total += company.total;
    acc.alreadyTagged += company.alreadyTagged;
    acc.wouldTag += company.wouldTag;
    acc.wouldRemainNull += company.wouldRemainNull;
    mergeDistribution(currentDistribution, company.distribution);
    mergeDistribution(wouldDistribution, company.wouldDistribution);
    return acc;
  }, {
    total: 0,
    alreadyTagged: 0,
    wouldTag: 0,
    wouldRemainNull: 0,
  });

  return {
    ...totals,
    coveragePercent: percent(totals.alreadyTagged + totals.wouldTag, totals.total),
    currentCoveragePercent: percent(totals.alreadyTagged, totals.total),
    distribution: toDistributionArray(currentDistribution),
    wouldDistribution: toDistributionArray(wouldDistribution),
    companies,
    ownerFieldAvailable: hasOwnerField(),
    resolutionOrder: getActiveResolutionSteps().map((step) => step.label),
  };
}

async function executeBackfill(companyReport, { transaction } = {}) {
  let updatedRows = 0;
  for (const update of companyReport.updates) {
    const [count] = await Counterparty.update(
      { departmentId: update.departmentId },
      {
        where: {
          id: update.id,
          companyId: companyReport.companyId,
          departmentId: null,
        },
        transaction,
      }
    );
    updatedRows += count;
  }
  return updatedRows;
}

async function runBackfill({ dryRun = true, execute = false, companyId = null } = {}) {
  const runId = uuidv4();
  const timestamp = new Date().toISOString();
  const before = companyId ? summarizeCompanies([await analyzeCompany(companyId)]) : await analyzeAllCompanies();
  let updatedRows = 0;

  if (execute && !dryRun) {
    await sequelize.transaction(async (transaction) => {
      for (const companyReport of before.companies) {
        updatedRows += await executeBackfill(companyReport, { transaction });
      }
    });
  }

  const after = companyId ? summarizeCompanies([await analyzeCompany(companyId)]) : await analyzeAllCompanies();
  return {
    runId,
    timestamp,
    dryRun,
    execute: execute && !dryRun,
    updatedRows,
    skippedRows: before.alreadyTagged,
    stillNullRows: after.total - after.alreadyTagged,
    before,
    after,
  };
}

function printDistribution(title, items) {
  // eslint-disable-next-line no-console
  console.log(title);
  if (!items.length) {
    // eslint-disable-next-line no-console
    console.log('  none');
    return;
  }
  for (const item of items) {
    // eslint-disable-next-line no-console
    console.log(`  ${item.name}: ${item.count}`);
  }
}

function printBackfillReport(report) {
  const source = report.execute ? report.after : report.before;
  // eslint-disable-next-line no-console
  console.log(`Run id: ${report.runId}`);
  // eslint-disable-next-line no-console
  console.log(`Timestamp: ${report.timestamp}`);
  // eslint-disable-next-line no-console
  console.log(`Mode: ${report.execute ? 'execute' : 'dry-run'}`);
  // eslint-disable-next-line no-console
  console.log(`Resolution order: ${source.resolutionOrder.join(' -> ')}`);
  if (!source.ownerFieldAvailable) {
    // eslint-disable-next-line no-console
    console.log('Owner field: unavailable on counterparties, skipped');
  }
  // eslint-disable-next-line no-console
  console.log(`Total counterparties: ${source.total}`);
  // eslint-disable-next-line no-console
  console.log(`Already tagged: ${source.alreadyTagged}`);
  // eslint-disable-next-line no-console
  console.log(`Would tag: ${report.before.wouldTag}`);
  // eslint-disable-next-line no-console
  console.log(`Would remain NULL: ${report.before.wouldRemainNull}`);
  // eslint-disable-next-line no-console
  console.log(`Updated rows: ${report.updatedRows}`);
  // eslint-disable-next-line no-console
  console.log(`Skipped rows: ${report.skippedRows}`);
  // eslint-disable-next-line no-console
  console.log(`Still NULL rows: ${report.stillNullRows}`);
  // eslint-disable-next-line no-console
  console.log(`Coverage: ${source.coveragePercent}%`);
  printDistribution('Distribution:', source.distribution);
  printDistribution('Would tag distribution:', report.before.wouldDistribution);
}

async function main() {
  const args = parseArgs();
  const report = await runBackfill(args);
  printBackfillReport(report);
}

if (require.main === module) {
  main()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('backfillCounterpartyDepartments failed', error);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close().catch(() => {}));
}

module.exports = {
  analyzeCompany,
  analyzeAllCompanies,
  runBackfill,
  printBackfillReport,
  resolveDepartmentId,
  parseArgs,
  percent,
};
