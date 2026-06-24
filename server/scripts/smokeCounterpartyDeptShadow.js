'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  CompanyDepartment,
  Counterparty,
  Permission,
  User,
  UserCompany,
  UserPermission,
} = require('../src/models');
const permissionResolver = require('../src/middleware/permissionResolver');
const { isCounterpartyDeptScopeEnabled, isDeptScopeEnabled } = require('../src/acl');
const {
  computeAccessScope,
  buildCounterpartyWhereFromAccessScope,
} = require('../src/acl');
const {
  buildShadowReport,
  buildUserDiff,
  normalizeCounterpartyWhere,
  summarizeCompany,
  summarizeReport,
} = require('./reportCounterpartyDeptScopeShadow');

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
    email: `counterparty-shadow-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function ensurePermission(name) {
  const [permission] = await Permission.findOrCreate({
    where: { name },
    defaults: { id: uuidv4(), name, description: `Smoke permission ${name}` },
  });
  return permission;
}

async function grant(userId, companyId, name, effect = 'allow') {
  const permission = await ensurePermission(name);
  await UserPermission.create({
    userId,
    companyId,
    permissionId: permission.id,
    effect,
  });
  permissionResolver.invalidate(userId, companyId);
}

async function createCounterparty(companyId, suffix, label, patch = {}) {
  return Counterparty.create({
    id: uuidv4(),
    companyId,
    shortName: `Shadow ${label} ${suffix}`,
    fullName: `Shadow ${label} ${suffix}`,
    type: 'client',
    status: 'active',
    isCompany: true,
    ...patch,
  });
}

function findUser(report, userId) {
  return report.companies
    .flatMap((company) => company.users)
    .find((user) => user.userId === userId);
}

async function listCompanyCounterpartyIds(companyId) {
  const rows = await Counterparty.findAll({
    where: { companyId },
    attributes: ['id'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  return rows.map((row) => String(row.id));
}

async function listSyntheticFutureIds({ companyId, userId, role = 'user', departmentId = null, permissions, allIds, nullVisible }) {
  const scope = await computeAccessScope({
    user: { id: userId },
    companyId,
    action: 'counterparty:read',
    role,
    membership: departmentId ? { departmentId } : null,
    permissions,
    entityScopeEnabled: true,
    getRequesterDepartments: async () => (departmentId ? [departmentId] : []),
  });
  if (scope.deny) return [];
  if (scope.company) return [...allIds];

  const where = normalizeCounterpartyWhere(buildCounterpartyWhereFromAccessScope(scope, { nullVisible }));
  const rows = await Counterparty.findAll({
    where: { companyId, ...where },
    attributes: ['id'],
    order: [['createdAt', 'ASC']],
    raw: true,
  });
  return rows.map((row) => String(row.id));
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const owner = await createUser('owner', suffix);
    const admin = await createUser('admin', suffix);
    const companyReader = await createUser('company', suffix);
    const ownDept = await createUser('own-dept', suffix);
    const deptOnly = await createUser('dept', suffix);
    const denied = await createUser('denied', suffix);
    const outsider = await createUser('outsider', suffix);
    created.userIds.push(owner.id, admin.id, companyReader.id, ownDept.id, deptOnly.id, denied.id, outsider.id);

    const company = await Company.create({
      id: uuidv4(),
      name: `Counterparty Shadow Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    const otherCompany = await Company.create({
      id: uuidv4(),
      name: `Counterparty Shadow Other ${suffix}`,
      ownerUserId: outsider.id,
    });
    created.companyIds.push(company.id, otherCompany.id);

    const deptA = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Sales ${suffix}`,
      code: `sales-${suffix.slice(-8)}`,
      isActive: true,
    });
    const deptB = await CompanyDepartment.create({
      id: uuidv4(),
      companyId: company.id,
      name: `Warehouse ${suffix}`,
      code: `wh-${suffix.slice(-8)}`,
      isActive: true,
    });

    await UserCompany.bulkCreate([
      { id: uuidv4(), userId: owner.id, companyId: company.id, role: 'owner', status: 'active' },
      { id: uuidv4(), userId: admin.id, companyId: company.id, role: 'admin', status: 'active' },
      { id: uuidv4(), userId: companyReader.id, companyId: company.id, role: 'user', status: 'active' },
      { id: uuidv4(), userId: ownDept.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptA.id },
      { id: uuidv4(), userId: deptOnly.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptA.id },
      { id: uuidv4(), userId: denied.id, companyId: company.id, role: 'user', status: 'active', departmentId: deptA.id },
      { id: uuidv4(), userId: outsider.id, companyId: otherCompany.id, role: 'owner', status: 'active' },
    ]);

    await grant(companyReader.id, company.id, 'counterparty:read');
    await grant(ownDept.id, company.id, 'counterparty:read:own');
    await grant(ownDept.id, company.id, 'counterparty:read:dept');
    await grant(deptOnly.id, company.id, 'counterparty:read:dept');
    await grant(denied.id, company.id, 'counterparty:read:dept');
    await grant(denied.id, company.id, 'counterparty:read', 'deny');

    const cpDept = await createCounterparty(company.id, suffix, 'dept-a', { departmentId: deptA.id });
    await createCounterparty(company.id, suffix, 'dept-b', { departmentId: deptB.id });
    const cpOwn = await createCounterparty(company.id, suffix, 'own', { departmentId: deptB.id, mainResponsibleUserId: ownDept.id, createdBy: ownDept.id });
    const cpNull = await createCounterparty(company.id, suffix, 'null');
    const cpOtherCompany = await createCounterparty(otherCompany.id, suffix, 'other-company');

    const beforeCount = await Counterparty.count({ where: { companyId: company.id } });
    const reportNullTrue = await buildShadowReport({ companyId: company.id, nullVisible: true });
    const reportNullFalse = await buildShadowReport({ companyId: company.id, nullVisible: false });
    const afterCount = await Counterparty.count({ where: { companyId: company.id } });
    const allCompanyIds = await listCompanyCounterpartyIds(company.id);

    const companyUser = findUser(reportNullTrue, companyReader.id);
    const deniedUser = findUser(reportNullTrue, denied.id);
    const ownerUser = findUser(reportNullTrue, owner.id);
    const adminUser = findUser(reportNullTrue, admin.id);
    const syntheticCompanyIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: companyReader.id,
      permissions: { allow: ['counterparty:read'] },
      allIds: allCompanyIds,
      nullVisible: true,
    });
    const syntheticOwnDeptIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: ownDept.id,
      departmentId: deptA.id,
      permissions: { allow: ['counterparty:read:own', 'counterparty:read:dept'] },
      allIds: allCompanyIds,
      nullVisible: false,
    });
    const syntheticDeptTrueIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: deptOnly.id,
      departmentId: deptA.id,
      permissions: { allow: ['counterparty:read:dept'] },
      allIds: allCompanyIds,
      nullVisible: true,
    });
    const syntheticDeptFalseIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: deptOnly.id,
      departmentId: deptA.id,
      permissions: { allow: ['counterparty:read:dept'] },
      allIds: allCompanyIds,
      nullVisible: false,
    });
    const syntheticDenyIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: denied.id,
      departmentId: deptA.id,
      permissions: { allow: ['counterparty:read', 'counterparty:read:dept'], deny: ['counterparty:read'] },
      allIds: allCompanyIds,
      nullVisible: true,
    });
    const syntheticOwnerIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: owner.id,
      role: 'owner',
      permissions: { allow: [] },
      allIds: allCompanyIds,
      nullVisible: false,
    });
    const syntheticAdminIds = await listSyntheticFutureIds({
      companyId: company.id,
      userId: admin.id,
      role: 'admin',
      permissions: { allow: [] },
      allIds: allCompanyIds,
      nullVisible: false,
    });

    check('current flat read sees all company counterparties', companyUser?.currentCount === 4, `current=${companyUser?.currentCount}`);
    check('future company access sees all', syntheticCompanyIds.length === 4, `future=${syntheticCompanyIds.length}`);
    check(
      'future own+dept sees own union dept',
      syntheticOwnDeptIds.length === 2 &&
        syntheticOwnDeptIds.includes(cpDept.id) &&
        syntheticOwnDeptIds.includes(cpOwn.id),
      `future=${syntheticOwnDeptIds.length}`
    );
    check('future dept-only nullVisible=true includes NULL rows', syntheticDeptTrueIds.length === 2 && syntheticDeptTrueIds.includes(cpNull.id));
    check('future dept-only nullVisible=false excludes NULL rows', syntheticDeptFalseIds.length === 1 && !syntheticDeptFalseIds.includes(cpNull.id));
    check('direct deny produces zero future rows', syntheticDenyIds.length === 0 && deniedUser?.futureCount === 0);
    check('owner/admin see all', syntheticOwnerIds.length === 4 && syntheticAdminIds.length === 4 && ownerUser?.futureCount === 4 && adminUser?.futureCount === 4);
    check('shadow detects no-loss case', reportNullTrue.shadowStatus === 'PASS' && reportNullTrue.totalLostRows === 0);

    const syntheticLoss = summarizeReport({
      nullVisible: false,
      companies: [summarizeCompany({
        companyId: company.id,
        totalCounterparties: 3,
        users: [buildUserDiff({
          userId: 'loss-user',
          email: 'loss@example.test',
          currentIds: ['a', 'b', 'c'],
          futureIds: ['a'],
        })],
      })],
    });
    check('shadow detects loss case', syntheticLoss.shadowStatus === 'FAIL' && syntheticLoss.totalLostRows === 2);
    check(
      'cross-company isolation',
      reportNullTrue.totalCounterparties === 4 &&
        !syntheticCompanyIds.includes(cpOtherCompany.id) &&
        !syntheticOwnDeptIds.includes(cpOtherCompany.id)
    );
    check('script is read-only', beforeCount === afterCount);
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
    console.error('smokeCounterpartyDeptShadow crashed', error);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await Counterparty.destroy({ where: { companyId: created.companyIds }, force: true });
        await UserPermission.destroy({ where: { companyId: created.companyIds } });
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await CompanyDepartment.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds } });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('smokeCounterpartyDeptShadow cleanup failed', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
