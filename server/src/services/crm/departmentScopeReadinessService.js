const { Op } = require('sequelize');
const { CompanyDepartment, Counterparty, User, UserCompany } = require('../../models');
const { computeAccessScope, buildCounterpartyWhereFromAccessScope } = require('../../acl');

const READ_ACTION = 'counterparty:read';
const READY_COVERAGE_PERCENT = 95;

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

async function currentVisibleCount({ userId, companyId, totalCounterparties }) {
  const scope = await computeAccessScope({
    user: { id: userId },
    companyId,
    action: READ_ACTION,
    entityScopeEnabled: false,
  });
  return scope.deny || !scope.company ? 0 : totalCounterparties;
}

async function futureVisibleCount({ userId, companyId, departmentId, totalCounterparties, nullVisible }) {
  const scope = await computeAccessScope({
    user: { id: userId },
    companyId,
    action: READ_ACTION,
    entityScopeEnabled: true,
    getRequesterDepartments: async () => (departmentId ? [departmentId] : []),
  });
  if (scope.deny) return 0;
  if (scope.company) return totalCounterparties;

  const where = normalizeCounterpartyWhere(buildCounterpartyWhereFromAccessScope(scope, { nullVisible }));
  return Counterparty.count({ where: { companyId, ...where } });
}

async function summarizeShadow(companyId, memberships, totalCounterparties, nullVisible) {
  let lostRows = 0;
  let usersWithLosses = 0;

  for (const membership of memberships) {
    const currentCount = await currentVisibleCount({
      userId: membership.userId,
      companyId,
      totalCounterparties,
    });
    const futureCount = await futureVisibleCount({
      userId: membership.userId,
      companyId,
      departmentId: membership.departmentId,
      totalCounterparties,
      nullVisible,
    });
    const lost = Math.max(0, currentCount - futureCount);
    if (lost > 0) {
      usersWithLosses += 1;
      lostRows += lost;
    }
  }

  return {
    status: lostRows === 0 ? 'PASS' : 'FAIL',
    lostRows,
    usersWithLosses,
  };
}

function buildReadiness({
  totalCounterparties,
  taggedCounterparties,
  untaggedCounterparties,
  coveragePercent,
  activeDepartments,
  usersTotal,
  usersWithDepartment,
  usersWithoutDepartment,
  counterpartiesWithResponsible,
  counterpartiesWithCreator,
  shadow,
}) {
  const blockers = [];
  const warnings = [];
  const nextSteps = [];

  if (activeDepartments === 0) {
    blockers.push('create_departments');
    nextSteps.push('create_departments');
  }

  if (usersTotal > 0 && usersWithDepartment === 0) {
    blockers.push('assign_users_to_departments');
    nextSteps.push('assign_users_to_departments');
  } else if (usersWithoutDepartment > 0) {
    warnings.push('users_without_department');
    nextSteps.push('assign_remaining_users');
  }

  if (totalCounterparties > 0 && taggedCounterparties === 0 && counterpartiesWithResponsible === 0 && counterpartiesWithCreator === 0) {
    blockers.push('counterparties_need_department_signals');
    nextSteps.push('tag_counterparties_or_responsible_users');
  } else if (untaggedCounterparties > 0 || coveragePercent < READY_COVERAGE_PERCENT) {
    warnings.push('counterparty_coverage_low');
    nextSteps.push('tag_counterparties_or_responsible_users');
  }

  if (shadow.nullVisibleTrue.status !== 'PASS') {
    blockers.push('shadow_null_visible_true_losses');
    nextSteps.push('review_shadow_losses');
  }
  if (shadow.nullVisibleFalse.status !== 'PASS') {
    warnings.push('shadow_null_visible_false_losses');
    nextSteps.push('review_shadow_losses');
  }

  nextSteps.push('run_readiness_check');
  nextSteps.push('enable_department_visibility_later');

  const uniqueNextSteps = [...new Set(nextSteps)];
  let status = 'ready';
  if (blockers.length) {
    status = 'not_ready';
  } else if (
    warnings.length ||
    usersWithoutDepartment > 0 ||
    (totalCounterparties > 0 && coveragePercent < READY_COVERAGE_PERCENT)
  ) {
    status = 'warning';
  }

  return {
    status,
    blockers,
    warnings,
    nextSteps: uniqueNextSteps,
  };
}

module.exports.getCounterpartyReadiness = async (companyId) => {
  const totalCounterparties = await Counterparty.count({ where: { companyId } });
  const taggedCounterparties = await Counterparty.count({
    where: { companyId, departmentId: { [Op.ne]: null } },
  });
  const untaggedCounterparties = Math.max(0, totalCounterparties - taggedCounterparties);
  const coveragePercent = totalCounterparties
    ? Number(((taggedCounterparties / totalCounterparties) * 100).toFixed(2))
    : 100;

  const [totalDepartments, activeDepartments] = await Promise.all([
    CompanyDepartment.count({ where: { companyId }, paranoid: false }),
    CompanyDepartment.count({ where: { companyId, isActive: true } }),
  ]);

  const memberships = await UserCompany.findAll({
    where: { companyId, status: 'active' },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id'],
      required: true,
    }],
    attributes: ['userId', 'departmentId'],
    raw: true,
  });
  const usersTotal = memberships.length;
  const usersWithDepartment = memberships.filter((membership) => Boolean(membership.departmentId)).length;
  const usersWithoutDepartment = Math.max(0, usersTotal - usersWithDepartment);

  const [counterpartiesWithResponsible, counterpartiesWithCreator] = await Promise.all([
    Counterparty.count({ where: { companyId, mainResponsibleUserId: { [Op.ne]: null } } }),
    Counterparty.count({ where: { companyId, createdBy: { [Op.ne]: null } } }),
  ]);
  const counterpartiesWithoutSignals = await Counterparty.count({
    where: {
      companyId,
      departmentId: null,
      mainResponsibleUserId: null,
      createdBy: null,
    },
  });

  const shadow = {
    nullVisibleTrue: await summarizeShadow(companyId, memberships, totalCounterparties, true),
    nullVisibleFalse: await summarizeShadow(companyId, memberships, totalCounterparties, false),
  };

  const readiness = buildReadiness({
    totalCounterparties,
    taggedCounterparties,
    untaggedCounterparties,
    coveragePercent,
    activeDepartments,
    usersTotal,
    usersWithDepartment,
    usersWithoutDepartment,
    counterpartiesWithResponsible,
    counterpartiesWithCreator,
    shadow,
  });

  return {
    totalCounterparties,
    taggedCounterparties,
    untaggedCounterparties,
    coveragePercent,
    totalDepartments,
    activeDepartments,
    usersTotal,
    usersWithDepartment,
    usersWithoutDepartment,
    counterpartiesWithResponsible,
    counterpartiesWithCreator,
    counterpartiesWithoutSignals,
    shadow,
    readiness,
  };
};

module.exports._private = {
  buildReadiness,
  normalizeCounterpartyWhere,
};
