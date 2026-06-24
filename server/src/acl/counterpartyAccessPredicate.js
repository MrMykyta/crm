'use strict';

const { Op } = require('sequelize');

function impossibleWhere() {
  return { id: { [Op.eq]: null } };
}

function buildCounterpartyOwnPredicate(userId) {
  if (!userId) return impossibleWhere();
  return {
    [Op.or]: [
      { mainResponsibleUserId: userId },
      { ownerId: userId },
      { createdBy: userId },
    ],
  };
}

function buildCounterpartyDeptPredicate(departmentIds = [], { nullVisible = true } = {}) {
  const ids = [...new Set((Array.isArray(departmentIds) ? departmentIds : [departmentIds]).filter(Boolean))];
  if (!ids.length) {
    return nullVisible ? { departmentId: null } : impossibleWhere();
  }

  const branches = [{ departmentId: { [Op.in]: ids } }];
  if (nullVisible) branches.push({ departmentId: null });

  return branches.length === 1 ? branches[0] : { [Op.or]: branches };
}

function buildCounterpartyWhereFromAccessScope(scope, { nullVisible = true } = {}) {
  if (!scope || scope.deny) return impossibleWhere();
  if (scope.company) return {};

  const branches = [];
  if (scope.dept) {
    branches.push(buildCounterpartyDeptPredicate(scope.departmentIds, { nullVisible }));
  }
  if (scope.own && scope.ownUserId) {
    branches.push(buildCounterpartyOwnPredicate(scope.ownUserId));
  }

  if (!branches.length) return impossibleWhere();
  return branches.length === 1 ? branches[0] : { [Op.or]: branches };
}

module.exports = {
  buildCounterpartyOwnPredicate,
  buildCounterpartyDeptPredicate,
  buildCounterpartyWhereFromAccessScope,
};
