// src/services/userCompanyService.js
const { sequelize, UserCompany, User, CompanyDepartment } = require('../../models');
const { invalidate } = require('../../middleware/permissionResolver');
const { Op } = require('sequelize');

// Проверяем права сетевому админ/овнер в КОНКРЕТНОЙ компании
async function requireAdminOrOwner(userId, companyId) {
  const membership = await UserCompany.findOne({
    where: { userId, companyId },
    attributes: ['role', 'status', 'departmentId', 'isLead'],
  });
  if (!membership || membership.status !== 'active') {
    return null;
  }
  return membership; // вернём сам membership (role внутри)
}

async function isAdminOrOwner(m) {
  return m && ['owner', 'admin'].includes(m.role);
}

async function ownersCount(companyId, tx) {
  return UserCompany.count({
    where: { companyId, role: 'owner', status: 'active' },
    transaction: tx,
  });
}

exports.getCompanyUsers = async (requesterId, companyId) => {
  const requester = await requireAdminOrOwner(requesterId, companyId);
  if (!await isAdminOrOwner(requester)) return null;

  return UserCompany.findAll({
    where: { companyId },
    include: [
      { model: User, as: 'user', attributes: ['id', 'email', 'firstName', 'lastName'] },
      { model: CompanyDepartment, as: 'department', attributes: ['id','name'] },
    ],
    order: [['role', 'ASC'], ['isLead','DESC'], ['createdAt','ASC']],
  });
};

exports.addUserToCompany = async (requesterId, companyId, userId, role = 'member', opts = {}) => {
  const requester = await requireAdminOrOwner(requesterId, companyId);
  if (!await isAdminOrOwner(requester)) return null;

  // admin не должен иметь возможность назначить/снять owner (только owner)
  if (requester.role !== 'owner' && role === 'owner') {
    throw new Error('Только владелец может назначать владельцев');
  }

  const payload = {
    companyId,
    userId,
    role,
    status: 'active',
    departmentId: opts.departmentId ?? null,
    isLead: !!opts.isLead
  };

  // upsert-like
  const existing = await UserCompany.findOne({ where: { companyId, userId } });
  if (existing) {
    await existing.update(payload);
    invalidate(userId, companyId);
    return existing;
  }
  invalidate(userId, companyId);
  return UserCompany.create(payload);
};

exports.updateUserRole = async (requesterId, companyId, userId, nextRole, opts = {}) => {
  const requester = await requireAdminOrOwner(requesterId, companyId);
  if (!await isAdminOrOwner(requester)) return null;

  return sequelize.transaction(async (t) => {
    const membership = await UserCompany.findOne({ where: { companyId, userId }, transaction: t });
    if (!membership) return null;

    // если хотим менять роль
    if (typeof nextRole === 'string' && nextRole !== membership.role) {
      // только owner может менять owner-роль
      if (membership.role === 'owner' && requester.role !== 'owner') {
        throw new Error('Только владелец может менять роль владельца');
      }
      // запрет понизить последнего owner
      if (membership.role === 'owner' && nextRole !== 'owner') {
        const cnt = await ownersCount(companyId, t);
        if (cnt <= 1) throw new Error('Нельзя понизить роль последнего владельца компании');
      }
      membership.role = nextRole;
    }

    // департамент/лид — можно менять и admin’у
    if (opts && Object.prototype.hasOwnProperty.call(opts, 'departmentId')) {
      membership.departmentId = opts.departmentId || null;
    }
    if (opts && Object.prototype.hasOwnProperty.call(opts, 'isLead')) {
      membership.isLead = !!opts.isLead;
    }

    await membership.save({ transaction: t });
    invalidate(userId, companyId);
    return membership;
  });
};

exports.removeUserFromCompany = async (requesterId, companyId, userId) => {
  const requester = await requireAdminOrOwner(requesterId, companyId);
  if (!await isAdminOrOwner(requester)) return null;

  return sequelize.transaction(async (t) => {
    const membership = await UserCompany.findOne({ where: { companyId, userId }, transaction: t }); // <-- fixed userId
    if (!membership) return null;

    // запрет удалить последнего owner
    if (membership.role === 'owner') {
      const cnt = await ownersCount(companyId, t);
      if (cnt <= 1) throw new Error('Нельзя удалить последнего владельца компании');
    }

    await membership.destroy({ transaction: t }); // paranoid=true
    return true;
  });
};
