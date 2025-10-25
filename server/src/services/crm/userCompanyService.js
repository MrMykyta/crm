// src/services/userCompanyService.js
'use strict';

const { sequelize, UserCompany, User, CompanyDepartment } = require('../../models');
const { invalidate } = require('../../middleware/permissionResolver');
const { Op, fn, col, where, literal } = require('sequelize');
const { parsePagination, packResult } = require('../../utils/pagination');

// --- helpers ---

// Проверяем право в контексте КОНКРЕТНОЙ компании
async function requireMembership(userId, companyId) {
  return UserCompany.findOne({
    where: { userId, companyId },
    attributes: ['role', 'status', 'departmentId', 'isLead'],
  });
}
function isAdminOrOwner(m) {
  return m && m.status === 'active' && ['owner', 'admin'].includes(m.role);
}

async function ownersCount(companyId, tx) {
  return UserCompany.count({
    where: { companyId, role: 'owner', status: 'active' },
    transaction: tx,
  });
}

// --- LIST USERS (для ListPage) ---
// поддержка query:
// - page/limit/sort/dir (parsePagination)
// - role(s)  (?role=admin&role=viewer) или ?roles[]=... (зависит от твоего normalize на фронте)
// - status(es)
// - departmentId
// - search — по email, firstName, lastName (ILIKE)
exports.listUsers = async (requesterId, companyId, query = {}) => {
  const membership = await requireMembership(requesterId, companyId);
  if (!isAdminOrOwner(membership)) return null;

  const parsed = parsePagination(query, {
    sortWhitelist: ['createdAt', 'updatedAt', 'role', 'status', 'isLead', 'departmentId'],
    defaultSort: 'createdAt',
    defaultDir: 'DESC',
    defaultLimit: 25,
    maxLimit: 100,
  });

  const whereUC = { companyId };
  // фильтры-одиночки
  if (query.role) whereUC.role = query.role;
  if (query.status) whereUC.status = query.status;
  if (query.departmentId) whereUC.departmentId = query.departmentId;

  // множественные из parsePagination
  if (parsed.roles?.length) whereUC.role = { [Op.in]: parsed.roles };
  if (parsed.statuses?.length) whereUC.status = { [Op.in]: parsed.statuses };

  // Поиск по связанному User
  const search = (parsed.search || '').trim();
  const whereUser = {};
  if (search) {
    // PostgreSQL: ILIKE (если MySQL — замени на Op.substring)
    whereUser[Op.or] = [
      { email: { [Op.iLike]: `%${search}%` } },
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName: { [Op.iLike]: `%${search}%` } },
      // ФИО целиком (first + space + last)
      where(fn('concat_ws', ' ', col('user.first_name'), col('user.last_name')), {
        [Op.iLike]: `%${search}%`,
      }),
    ];
  }

  const data = await UserCompany.findAndCountAll({
    where: whereUC,
    include: [
      {
        model: User,
        as: 'user',
        required: true,
        attributes: ['id', 'email', 'firstName', 'lastName', 'lastLoginAt', 'isActive', 'avatarUrl'],
        where: whereUser,
      },
      {
        model: CompanyDepartment,
        as: 'department',
        attributes: ['id', 'name'],
        required: false,
      },
    ],
    // сортировка по полям UserCompany (разрешённым) — если нужно сортировать по user.email, можно добавить ветку
    order: [[parsed.sort, parsed.dir]],
    limit: parsed.limit,
    offset: parsed.offset,
    distinct: true, // чтобы count был корректный
  });

  // Нормализуем вывод под ListPage: items со сведёнными полями, total/page/limit
  const items = (data.rows || []).map((uc) => ({
    userId: uc.userId,
    email: uc.user?.email,
    firstName: uc.user?.firstName,
    lastName: uc.user?.lastName,
    role: uc.role,
    status: uc.status,
    department: uc.department ? { id: uc.department.id, name: uc.department.name } : null,
    isLead: uc.isLead,
    lastLoginAt: uc.user?.lastLoginAt,
    avatarUrl: uc.user?.avatarUrl,
    createdAt: uc.createdAt,
  }));

  return packResult(
    { rows: items, count: data.count },
    parsed
  );
};

// --- ADD USER (присоединить существующего к компании) ---
// payload: { userId, role, departmentId?, isLead? }
exports.addUserToCompany = async (requesterId, companyId, userId, role = 'viewer', opts = {}) => {
  const membership = await requireMembership(requesterId, companyId);
  if (!isAdminOrOwner(membership)) return null;

  if (membership.role !== 'owner' && role === 'owner') {
    throw new Error('Только владелец может назначать владельцев');
  }

  const payload = {
    companyId,
    userId,
    role,
    status: 'active',
    departmentId: opts.departmentId ?? null,
    isLead: !!opts.isLead,
  };

  const existing = await UserCompany.findOne({ where: { companyId, userId }, paranoid: false });
  if (existing) {
    if (existing.deletedAt) {
      await existing.restore();  // вернули запись
    }
    await existing.update({
      role,
      status: 'active',
      departmentId: opts.departmentId ?? null,
      isLead: !!opts.isLead,
    });
    invalidate(userId, companyId);
    return existing;
  }

  const created = await UserCompany.create({
    companyId,
    userId,
    role,
    status: 'active',
    departmentId: opts.departmentId ?? null,
    isLead: !!opts.isLead,
  });
  invalidate(userId, companyId);
  return created;

};

// --- UPDATE ROLE/DEPARTMENT/IS_LEAD ---
// nextRole?: string, opts?: { departmentId?, isLead? }
/**
 * Универсальный апдейт членства:
 * payload: { role?, status?, departmentId?, isLead? }
 */
exports.updateUserMembership = async (requesterId, companyId, userId, payload = {}) => {
  const membership = await requireMembership(requesterId, companyId);
  if (!isAdminOrOwner(membership)) return null;

  const { role: nextRole, status: nextStatus, departmentId, isLead } = payload;

  return sequelize.transaction(async (t) => {
    const row = await UserCompany.findOne({ where: { companyId, userId }, transaction: t });
    if (!row) return null;

    // --- изменение роли ---
    if (typeof nextRole === 'string' && nextRole !== row.role) {
      // менять владельца может только owner
      if (row.role === 'owner' && membership.role !== 'owner') {
        throw new Error('Только владелец может менять роль владельца');
      }
      // запрет понижать/менять роль последнего владельца
      if (row.role === 'owner' && nextRole !== 'owner') {
        const cnt = await ownersCount(companyId, t);
        if (cnt <= 1) throw new Error('Нельзя понизить роль последнего владельца компании');
      }
      row.role = nextRole;
    }

    // --- изменение статуса ---
    if (typeof nextStatus === 'string' && nextStatus !== row.status) {
      // блокировать единственного владельца — тоже нельзя
      if (row.role === 'owner' && nextStatus === 'suspended') {
        const cnt = await ownersCount(companyId, t);
        if (cnt <= 1) throw new Error('Нельзя заблокировать единственного владельца компании');
      }
      if (!['active', 'suspended'].includes(nextStatus)) {
        throw new Error('Недопустимый статус');
      }
      row.status = nextStatus;
    }

    // --- департамент и isLead ---
    if (Object.prototype.hasOwnProperty.call(payload, 'departmentId')) {
      row.departmentId = departmentId || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'isLead')) {
      row.isLead = !!isLead;
    }

    await row.save({ transaction: t });

    // инвалидируем кеш прав
    invalidate(userId, companyId);

    return row;
  });
};

// --- REMOVE USER FROM COMPANY ---
exports.removeUserFromCompany = async (requesterId, companyId, userId) => {
  const membership = await requireMembership(requesterId, companyId);
  if (!isAdminOrOwner(membership)) return null;

  return sequelize.transaction(async (t) => {
    const row = await UserCompany.findOne({ where: { companyId, userId }, transaction: t });
    if (!row) return null;

    if (row.role === 'owner') {
      const cnt = await ownersCount(companyId, t);
      if (cnt <= 1) throw new Error('Нельзя удалить последнего владельца компании');
    }

    // soft-delete membership
    await row.destroy({ transaction: t }); // paranoid=true

    // считаем активные membership-ы пользователя (без учёта удалённых)
    const rest = await UserCompany.count({
      where: { userId, status: 'active' },
      transaction: t,
    });

    if (rest === 0) {
      // блокируем логин
      await User.update({ isActive: false }, { where: { id: userId }, transaction: t });
    }

    invalidate(userId, companyId);
    return true;
  });
};