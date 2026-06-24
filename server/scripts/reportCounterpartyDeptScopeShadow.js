'use strict';

const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize,
  Counterparty,
  User,
  UserCompany,
} = require('../src/models');
const {
  computeAccessScope,
  buildCounterpartyWhereFromAccessScope,
} = require('../src/acl');

const ACTION = 'counterparty:read';

function parseArgs(argv = process.argv.slice(2)) {
  const rawNullVisible = argv
    .find((arg) => arg.startsWith('--null-visible='))
    ?.split('=')[1];
  return {
    nullVisible: rawNullVisible === undefined ? true : String(rawNullVisible).toLowerCase() === 'true',
  };
}

function idSet(rows) {
  return new Set((rows || []).map((row) => String(row.id || row)));
}

function diffSets(left, right) {
  return [...left].filter((id) => !right.has(id));
}

function sampleIds(ids, limit = 5) {
  return ids.slice(0, limit);
}

function hasOwnKeys(value) {
  if (!value || typeof value !== 'object') return false;
  return Object.keys(value).length > 0 || Object.getOwnPropertySymbols(value).length > 0;
}

function impossibleWhere() {
  return { id: { [Op.eq]: null } };
}

function normalizeCounterpartyWhere(where = {}) {
  if (!hasOwnKeys(where)) return {};

  const supportsOwnerId = Boolean(Counterparty.rawAttributes.ownerId);

  function strip(node) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;

    const next = {};
    for (const key of [...Object.keys(node), ...Object.getOwnPropertySymbols(node)]) {
      if (key === 'ownerId' && !supportsOwnerId) continue;

      if (key === Op.or || key === Op.and) {
        const branches = (Array.isArray(node[key]) ? node[key] : [])
          .map(strip)
          .filter(hasOwnKeys);
        if (branches.length) next[key] = branches;
        continue;
      }

      if (node[key] === null) {
        next[key] = null;
        continue;
      }

      const value = strip(node[key]);
      if (value === undefined) continue;
      if (typeof value === 'object' && !Array.isArray(value) && !hasOwnKeys(value)) continue;
      next[key] = value;
    }
    return hasOwnKeys(next) ? next : null;
  }

  return strip(where) || impossibleWhere();
}

async function listCounterpartyIds(companyId, where = {}) {
  const rows = await Counterparty.findAll({
    where: { companyId, ...where },
    attributes: ['id'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  return rows.map((row) => String(row.id));
}

async function listCompanyIds() {
  const rows = await Counterparty.findAll({
    attributes: [[sequelize.fn('DISTINCT', sequelize.col('company_id')), 'companyId']],
    raw: true,
  });
  return rows.map((row) => row.companyId).filter(Boolean);
}

async function listActiveMemberships(companyId) {
  return UserCompany.findAll({
    where: { companyId, status: 'active' },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'email'],
      required: true,
    }],
    order: [['createdAt', 'ASC']],
  });
}

async function currentVisibleIds({ userId, companyId, allIds }) {
  const scope = await computeAccessScope({
    user: { id: userId },
    companyId,
    action: ACTION,
    entityScopeEnabled: false,
  });
  if (scope.deny || !scope.company) return [];
  return [...allIds];
}

async function futureVisibleIds({ userId, companyId, departmentId, allIds, nullVisible }) {
  const scope = await computeAccessScope({
    user: { id: userId },
    companyId,
    action: ACTION,
    entityScopeEnabled: true,
    getRequesterDepartments: async () => (departmentId ? [departmentId] : []),
  });
  if (scope.deny) return [];
  if (scope.company) return [...allIds];

  const where = normalizeCounterpartyWhere(buildCounterpartyWhereFromAccessScope(scope, { nullVisible }));
  return listCounterpartyIds(companyId, where);
}

function buildUserDiff({ userId, email, currentIds, futureIds }) {
  const currentSet = idSet(currentIds);
  const futureSet = idSet(futureIds);
  const lost = diffSets([...currentSet], futureSet);
  const gained = diffSets([...futureSet], currentSet);
  return {
    userId,
    email: email || null,
    currentCount: currentSet.size,
    futureCount: futureSet.size,
    lostCount: lost.length,
    gainedCount: gained.length,
    lostSampleIds: sampleIds(lost),
    gainedSampleIds: sampleIds(gained),
  };
}

function summarizeCompany({ companyId, totalCounterparties, users }) {
  const totals = users.reduce((acc, user) => {
    if (user.currentCount > 0) acc.usersWithCurrentAccess += 1;
    if (user.futureCount > 0) acc.usersWithFutureAccess += 1;
    if (user.lostCount > 0) acc.usersWithLosses += 1;
    if (user.gainedCount > 0) acc.usersWithGains += 1;
    acc.totalLostRows += user.lostCount;
    acc.totalGainedRows += user.gainedCount;
    return acc;
  }, {
    usersWithCurrentAccess: 0,
    usersWithFutureAccess: 0,
    totalLostRows: 0,
    totalGainedRows: 0,
    usersWithLosses: 0,
    usersWithGains: 0,
  });

  return {
    companyId,
    totalCounterparties,
    activeUsersChecked: users.length,
    ...totals,
    users,
  };
}

function summarizeReport({ nullVisible, companies }) {
  const totals = companies.reduce((acc, company) => {
    acc.totalCounterparties += company.totalCounterparties;
    acc.activeUsersChecked += company.activeUsersChecked;
    acc.usersWithCurrentAccess += company.usersWithCurrentAccess;
    acc.usersWithFutureAccess += company.usersWithFutureAccess;
    acc.totalLostRows += company.totalLostRows;
    acc.totalGainedRows += company.totalGainedRows;
    acc.usersWithLosses += company.usersWithLosses;
    acc.usersWithGains += company.usersWithGains;
    return acc;
  }, {
    totalCounterparties: 0,
    activeUsersChecked: 0,
    usersWithCurrentAccess: 0,
    usersWithFutureAccess: 0,
    totalLostRows: 0,
    totalGainedRows: 0,
    usersWithLosses: 0,
    usersWithGains: 0,
  });

  return {
    runId: uuidv4(),
    timestamp: new Date().toISOString(),
    nullVisible,
    shadowStatus: totals.totalLostRows === 0 ? 'PASS' : 'FAIL',
    ...totals,
    companies,
  };
}

async function analyzeCompany(companyId, { nullVisible = true } = {}) {
  const allIds = await listCounterpartyIds(companyId);
  const memberships = await listActiveMemberships(companyId);
  const users = [];

  for (const membership of memberships) {
    const userId = membership.userId;
    const currentIds = await currentVisibleIds({ userId, companyId, allIds });
    const futureIds = await futureVisibleIds({
      userId,
      companyId,
      departmentId: membership.departmentId,
      allIds,
      nullVisible,
    });
    users.push(buildUserDiff({
      userId,
      email: membership.user?.email,
      currentIds,
      futureIds,
    }));
  }

  return summarizeCompany({
    companyId,
    totalCounterparties: allIds.length,
    users,
  });
}

async function buildShadowReport({ nullVisible = true, companyId = null } = {}) {
  const companyIds = companyId ? [companyId] : await listCompanyIds();
  const companies = [];
  for (const id of companyIds) {
    companies.push(await analyzeCompany(id, { nullVisible }));
  }
  return summarizeReport({ nullVisible, companies });
}

function printUser(user) {
  // eslint-disable-next-line no-console
  console.log(`  user=${user.userId} email=${user.email || '-'} current=${user.currentCount} future=${user.futureCount} lost=${user.lostCount} gained=${user.gainedCount}`);
  if (user.lostSampleIds.length) {
    // eslint-disable-next-line no-console
    console.log(`    lostSampleIds=${user.lostSampleIds.join(',')}`);
  }
  if (user.gainedSampleIds.length) {
    // eslint-disable-next-line no-console
    console.log(`    gainedSampleIds=${user.gainedSampleIds.join(',')}`);
  }
}

function printShadowReport(report) {
  // eslint-disable-next-line no-console
  console.log(`Run id: ${report.runId}`);
  // eslint-disable-next-line no-console
  console.log(`Timestamp: ${report.timestamp}`);
  // eslint-disable-next-line no-console
  console.log(`Null visible: ${report.nullVisible}`);
  // eslint-disable-next-line no-console
  console.log(`SHADOW_STATUS=${report.shadowStatus}`);
  // eslint-disable-next-line no-console
  console.log(`Total counterparties: ${report.totalCounterparties}`);
  // eslint-disable-next-line no-console
  console.log(`Active users checked: ${report.activeUsersChecked}`);
  // eslint-disable-next-line no-console
  console.log(`Users with current access: ${report.usersWithCurrentAccess}`);
  // eslint-disable-next-line no-console
  console.log(`Users with future access: ${report.usersWithFutureAccess}`);
  // eslint-disable-next-line no-console
  console.log(`Total lost rows: ${report.totalLostRows}`);
  // eslint-disable-next-line no-console
  console.log(`Total gained rows: ${report.totalGainedRows}`);
  // eslint-disable-next-line no-console
  console.log(`Users with losses: ${report.usersWithLosses}`);
  // eslint-disable-next-line no-console
  console.log(`Users with gains: ${report.usersWithGains}`);

  for (const company of report.companies) {
    // eslint-disable-next-line no-console
    console.log(`\nCompany ${company.companyId}`);
    // eslint-disable-next-line no-console
    console.log(`  totalCounterparties=${company.totalCounterparties}`);
    // eslint-disable-next-line no-console
    console.log(`  activeUsersChecked=${company.activeUsersChecked}`);
    // eslint-disable-next-line no-console
    console.log(`  usersWithCurrentAccess=${company.usersWithCurrentAccess}`);
    // eslint-disable-next-line no-console
    console.log(`  usersWithFutureAccess=${company.usersWithFutureAccess}`);
    // eslint-disable-next-line no-console
    console.log(`  totalLostRows=${company.totalLostRows}`);
    // eslint-disable-next-line no-console
    console.log(`  totalGainedRows=${company.totalGainedRows}`);
    // eslint-disable-next-line no-console
    console.log(`  usersWithLosses=${company.usersWithLosses}`);
    // eslint-disable-next-line no-console
    console.log(`  usersWithGains=${company.usersWithGains}`);
    company.users.forEach(printUser);
  }

  if (report.shadowStatus === 'FAIL') {
    const losses = report.companies
      .flatMap((company) => company.users.map((user) => ({ companyId: company.companyId, ...user })))
      .filter((user) => user.lostCount > 0)
      .sort((a, b) => b.lostCount - a.lostCount)
      .slice(0, 10);
    // eslint-disable-next-line no-console
    console.log('\nSuggested actions:');
    // eslint-disable-next-line no-console
    console.log('- keep DEPT_SCOPE_NULL_VISIBLE=true');
    // eslint-disable-next-line no-console
    console.log('- improve backfill coverage');
    // eslint-disable-next-line no-console
    console.log('- do not enable scope');
    // eslint-disable-next-line no-console
    console.log('- investigate user permissions');
    losses.forEach((user) => {
      // eslint-disable-next-line no-console
      console.log(`- loss user=${user.userId} company=${user.companyId} lost=${user.lostCount} sample=${user.lostSampleIds.join(',')}`);
    });
  }
}

async function main() {
  const args = parseArgs();
  const report = await buildShadowReport(args);
  printShadowReport(report);
}

if (require.main === module) {
  main()
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error('reportCounterpartyDeptScopeShadow failed', error);
      process.exitCode = 1;
    })
    .finally(() => sequelize.close().catch(() => {}));
}

module.exports = {
  parseArgs,
  buildShadowReport,
  analyzeCompany,
  buildUserDiff,
  summarizeCompany,
  summarizeReport,
  normalizeCounterpartyWhere,
  printShadowReport,
};
