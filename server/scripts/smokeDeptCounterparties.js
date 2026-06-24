'use strict';

const { Op } = require('sequelize');
const {
  computeAccessScope,
  isCounterpartyDeptScopeEnabled,
  isDeptScopeNullVisible,
  buildCounterpartyOwnPredicate,
  buildCounterpartyDeptPredicate,
  buildCounterpartyWhereFromAccessScope,
} = require('../src/acl');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function setFlags(values) {
  const previous = {};
  for (const key of Object.keys(values)) {
    previous[key] = process.env[key];
    if (values[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = String(values[key]);
    }
  }
  return () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

function symbolValue(object, symbol) {
  return object?.[symbol];
}

function matchesCondition(condition, value) {
  if (condition && typeof condition === 'object' && !(condition instanceof Date)) {
    if (Object.prototype.hasOwnProperty.call(condition, Op.eq)) {
      return value === condition[Op.eq];
    }
    if (Object.prototype.hasOwnProperty.call(condition, Op.in)) {
      return condition[Op.in].includes(value);
    }
  }
  return value === condition;
}

function matchesWhere(where, row) {
  const orBranches = symbolValue(where, Op.or);
  if (Array.isArray(orBranches) && !orBranches.some((branch) => matchesWhere(branch, row))) {
    return false;
  }

  return Object.entries(where).every(([key, condition]) => matchesCondition(condition, row[key]));
}

function composeCompanyWhere(companyId, predicate) {
  return { companyId, ...predicate };
}

async function scopeFor({ role = 'user', allow = [], deny = [], departments = [], flags = true, userId = 'user-a' } = {}) {
  const restore = setFlags({
    DEPT_SCOPE_ENABLED: flags ? 'true' : 'false',
    DEPT_SCOPE_COUNTERPARTIES: flags ? 'true' : 'false',
  });
  try {
    return await computeAccessScope({
      user: { id: userId },
      companyId: 'company-a',
      action: 'counterparty:read',
      role,
      membership: { departmentId: departments[0] || null },
      permissions: { allow, deny },
      entityScopeEnabled: isCounterpartyDeptScopeEnabled(),
      getRequesterDepartments: async () => departments,
    });
  } finally {
    restore();
  }
}

(async () => {
  try {
    let scope = await scopeFor({
      allow: ['counterparty:read', 'counterparty:read:own', 'counterparty:read:dept'],
      departments: ['dept-a'],
      flags: false,
    });
    check('flag off preserves current flat counterparty:read behavior', scope.company && !scope.own && !scope.dept && !scope.deny);

    scope = await scopeFor({
      allow: ['counterparty:read', 'counterparty:read:dept'],
      departments: ['dept-a'],
    });
    check('role company + dept resolves to company scope', scope.company && !scope.dept && !scope.own);

    scope = await scopeFor({
      allow: ['counterparty:read:own', 'counterparty:read:dept'],
      departments: ['dept-a'],
    });
    check('role own + dept resolves to own union dept', scope.own && scope.dept && scope.departmentIds.includes('dept-a') && scope.ownUserId === 'user-a');

    scope = await scopeFor({
      allow: ['counterparty:read:dept'],
      departments: ['dept-a'],
    });
    check('role none + dept resolves to dept only', !scope.company && !scope.own && scope.dept && scope.departmentIds.length === 1);

    scope = await scopeFor({
      allow: ['counterparty:read:dept'],
      deny: ['counterparty:read'],
      departments: ['dept-a'],
    });
    check('direct deny + dept resolves to deny', scope.deny && !scope.company && !scope.dept && !scope.own);

    scope = await scopeFor({
      allow: ['counterparty:read'],
      deny: ['counterparty:read'],
      departments: ['dept-a'],
    });
    check('direct deny + company resolves to deny', scope.deny && !scope.company && !scope.dept && !scope.own);

    const ownerScope = await scopeFor({ role: 'owner', deny: ['counterparty:read'], flags: true });
    const adminScope = await scopeFor({ role: 'admin', deny: ['counterparty:read'], flags: true });
    check('owner/admin resolve to company access', ownerScope.company && !ownerScope.deny && adminScope.company && !adminScope.deny);

    const restoreNullTrue = setFlags({ DEPT_SCOPE_NULL_VISIBLE: undefined });
    const nullVisibleDefault = isDeptScopeNullVisible();
    restoreNullTrue();
    const nullVisiblePredicate = buildCounterpartyDeptPredicate(['dept-a'], { nullVisible: true });
    const nullHiddenPredicate = buildCounterpartyDeptPredicate(['dept-a'], { nullVisible: false });
    check('NULL department policy defaults to visible', nullVisibleDefault === true);
    check('NULL department policy true includes NULL', matchesWhere(nullVisiblePredicate, { departmentId: null }));
    check('NULL department policy false excludes NULL', !matchesWhere(nullHiddenPredicate, { departmentId: null }));

    scope = await scopeFor({
      allow: ['counterparty:read:dept'],
      departments: ['dept-a'],
      flags: false,
    });
    check('lead/dept boost is not active while flags are off', !scope.company && !scope.dept && !scope.own && !scope.deny);

    const ownPredicate = buildCounterpartyOwnPredicate('user-a');
    check(
      'own predicate includes mainResponsibleUserId/ownerId/createdBy',
      matchesWhere(ownPredicate, { mainResponsibleUserId: 'user-a' }) &&
        matchesWhere(ownPredicate, { ownerId: 'user-a' }) &&
        matchesWhere(ownPredicate, { createdBy: 'user-a' }) &&
        !matchesWhere(ownPredicate, { createdBy: 'other-user' })
    );

    const scopedWhere = buildCounterpartyWhereFromAccessScope({
      deny: false,
      company: false,
      dept: true,
      departmentIds: ['dept-a'],
      own: true,
      ownUserId: 'user-a',
    });
    const composed = composeCompanyWhere('company-a', scopedWhere);
    check('predicate helper keeps companyId composition with caller', composed.companyId === 'company-a' && matchesWhere(composed, { companyId: 'company-a', departmentId: 'dept-a' }));
    check('counterparty where deny produces impossible predicate', !matchesWhere(buildCounterpartyWhereFromAccessScope({ deny: true }), { id: 'row-a' }));
    check('counterparty where company scope returns empty predicate for caller AND', Object.keys(buildCounterpartyWhereFromAccessScope({ company: true })).length === 0);

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
    console.error('smokeDeptCounterparties crashed', error);
    process.exitCode = 1;
  }
})();
