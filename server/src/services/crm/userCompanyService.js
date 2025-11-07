// src/services/userCompanyService.js
'use strict';

const { sequelize, UserCompany, User, CompanyDepartment } = require('../../models');
const { invalidate } = require('../../middleware/permissionResolver');
const { Op, fn, col, where } = require('sequelize');
const { parsePagination, packResult } = require('../../utils/pagination');
const { assert, check, computeDeptScope } = require('../../acl');

// --- helpers ---

async function ownersCount(companyId, tx) {
  return UserCompany.count({
    where: { companyId, role: 'owner', status: 'active' },
    transaction: tx,
  });
}

// вернёт departmentId запрашивающего в компании
async function getRequesterDeptId(requesterId, companyId, tx) {
  const me = await UserCompany.findOne({
    where: { userId: requesterId, companyId },
    attributes: ['departmentId'],
    transaction: tx,
  });
  return me?.departmentId || null;
}

// --- LIST USERS (для ListPage) ---
/**
 * Права:
 *  - member:read        → видеть всех
 *  - member:read:dept   → видеть только свой департамент
 */
exports.listUsers = async (requesterId, companyId, query = {}) => {
  const requester = { id: requesterId };
  // 1) Определяем company/dept скоуп по базовому праву member:read

  const { canAll, deptLimitId } = await computeDeptScope({
    user: requester,
    companyId,
    base: 'member:read',
    getRequesterDept: async () => getRequesterDeptId(requesterId, companyId),
    throwIfDenied: false,                // ← ключевой момент
  });

  // 2) Проверяем «own»-ветку, если нет all/dept
  let onlyOwn = false;
  if (!canAll && !deptLimitId) {
    const canOwn = await check({
      user: requester,
      companyId,
      required: 'member:read',
      opts: { ownCheck: async () => true }, // сам факт наличия :own
    });
    if (!canOwn) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    onlyOwn = true;
  }

  // 3) Пагинация/сортировка
  const parsed = parsePagination(query, {
    sortWhitelist: ['createdAt', 'updatedAt', 'role', 'status', 'isLead', 'departmentId'],
    defaultSort: 'createdAt',
    defaultDir: 'DESC',
    defaultLimit: 25,
    maxLimit: 100,
  });

  // 4) where по UserCompany — начинаем с companyId
  const whereUC = { companyId };

  if (onlyOwn) {
    // «own» — показываем только себя, игнорируя расширяющие фильтры
    whereUC.userId = requesterId;
  } else if (!canAll && deptLimitId) {
    // «dept» — жёстко фиксируем скоуп отделом
    whereUC.departmentId = deptLimitId;

    // Если в query попросили другой departmentId — вернуть пусто (нельзя расширить скоуп)
    if (query.departmentId && query.departmentId !== deptLimitId) {
      return packResult({ rows: [], count: 0 }, parsed);
    }
  }

  // 5) Доп. фильтры (НЕ должны расширять скоуп)
  // одиночные
  if (query.role)   whereUC.role   = query.role;
  if (query.status) whereUC.status = query.status;

  // множественные (из parsed)
  if (parsed.roles?.length)   whereUC.role   = { [Op.in]: parsed.roles };
  if (parsed.statuses?.length) whereUC.status = { [Op.in]: parsed.statuses };

  // Если у нас all-сценарий, можно уважить явный departmentId из запроса (сузить выборку)
  if (canAll && query.departmentId) {
    whereUC.departmentId = query.departmentId;
  }

  // 6) Поиск по связанному User
  const search = (parsed.search || '').trim();
  const whereUser = {};
  if (search) {
    whereUser[Op.or] = [
      { email:     { [Op.iLike]: `%${search}%` } },
      { firstName: { [Op.iLike]: `%${search}%` } },
      { lastName:  { [Op.iLike]: `%${search}%` } },
      // ФИО целиком (first + ' ' + last)
      where(fn('concat_ws', ' ', col('user.first_name'), col('user.last_name')), {
        [Op.iLike]: `%${search}%`,
      }),
    ];
  }

  // 7) Запрос
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
    order: [[parsed.sort, parsed.dir]],
    limit: parsed.limit,
    offset: parsed.offset,
    distinct: true,
  });

  // 8) Нормализация
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

  return packResult({ rows: items, count: data.count }, parsed);
};

// --- ADD USER (присоединить существующего к компании) ---
/**
 * Права:
 *  - member:create         → можно добавлять в любую Dept (company-wide)
 *  - member:create:dept    → можно добавлять ТОЛЬКО в свой Dept
 *  Ограничения:
 *  - Назначить role='owner' может только тот, у кого есть company:owner:assign (или оставь проверку владельца как раньше).
 */
exports.addUserToCompany = async (requesterId, companyId, userId, role = 'user', opts = {}) => {
  const requester = { id: requesterId };

  // Разрешён ли company-wide?
  const canCompanyWide = await check({ user: requester, companyId, required: 'member:create' });

  // Если company-wide нет — проверим dept
  let deptLimitId = null;
  if (!canCompanyWide) {
    const allowDept = await check({
      user: requester,
      companyId,
      required: 'member:create',
      opts: { deptCheck: async () => true },
    });
    if (!allowDept) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    deptLimitId = await getRequesterDeptId(requesterId, companyId);
    if (!deptLimitId) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }

  // Запретить назначать владельца без отдельного права
  if (role === 'owner') {
    await assert({
      user: requester,
      companyId,
      required: 'company:owner:assign',
    });
  }

  // Если dept-ограничение — принудительно фиксируем departmentId
  const payload = {
    companyId,
    userId,
    role,
    status: 'active',
    departmentId: (deptLimitId ? deptLimitId : (opts.departmentId ?? null)),
    isLead: !!opts.isLead,
  };

  const existing = await UserCompany.findOne({ where: { companyId, userId }, paranoid: false });
  if (existing) {
    if (existing.deletedAt) {
      await existing.restore();
    }
    await existing.update({
      role: payload.role,
      status: payload.status,
      departmentId: payload.departmentId,
      isLead: payload.isLead,
    });
    invalidate(userId, companyId);
    return existing;
  }

  const created = await UserCompany.create(payload);
  invalidate(userId, companyId);
  return created;
};

// --- UPDATE ROLE/DEPARTMENT/IS_LEAD ---
/**
 * Права:
 *  - member:update           → менять всех
 *  - member:update:dept      → менять только свой Dept (и только в его рамках)
 *  - member:update:own       → менять СЕБЯ (ограниченно: например isLead=false/true, departmentId нельзя менять самому — на твой вкус)
 *  Доп. правило владельцев остаётся.
 */
exports.updateUserMembership = async (requesterId, companyId, userId, payload = {}) => {
  const requester = { id: requesterId };

  // company-wide?
  const canCompanyWide = await check({ user: requester, companyId, required: 'member:update' });

  // если нет — dept?
  let deptLimitId = null;
  if (!canCompanyWide) {
    const allowDept = await check({
      user: requester,
      companyId,
      required: 'member:update',
      opts: { deptCheck: async () => true },
    });

    if (!allowDept) {
      // last chance: :own (если обновляет сам себя — и если ты это разрешаешь)
      const allowOwn = await check({
        user: requester,
        companyId,
        required: 'member:update',
        opts: { ownCheck: async () => requesterId === userId },
      });
      if (!allowOwn) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
    } else {
      deptLimitId = await getRequesterDeptId(requesterId, companyId);
      if (!deptLimitId) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
    }
  }

  const { role: nextRole, status: nextStatus, departmentId, isLead } = payload;

  return sequelize.transaction(async (t) => {
    const row = await UserCompany.findOne({ where: { companyId, userId }, transaction: t });
    if (!row) return null;

    // Если dept-ограничение — редактируем только в рамках одного департамента
    if (deptLimitId) {
      if (row.departmentId !== deptLimitId) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
      // и нельзя переводить в другой департамент
      if (Object.prototype.hasOwnProperty.call(payload, 'departmentId') && departmentId && departmentId !== deptLimitId) {
        const err = new Error('Forbidden');
        err.status = 403;
        throw err;
      }
    }

    // --- изменение роли ---
    if (typeof nextRole === 'string' && nextRole !== row.role) {
      // менять владельца или назначать владельца — требуется спец-права
      if (row.role === 'owner' || nextRole === 'owner') {
        await assert({
          user: requester,
          companyId,
          required: 'company:owner:assign',
        });
      }

      // защита «последнего владельца»
      if (row.role === 'owner' && nextRole !== 'owner') {
        const cnt = await ownersCount(companyId, t);
        if (cnt <= 1) throw new Error('Нельзя понизить роль последнего владельца компании');
      }
      row.role = nextRole;
    }

    // --- изменение статуса ---
    if (typeof nextStatus === 'string' && nextStatus !== row.status) {
      if (!['active', 'suspended'].includes(nextStatus)) {
        throw new Error('Недопустимый статус');
      }
      // нельзя заблокировать единственного владельца
      if (row.role === 'owner' && nextStatus === 'suspended') {
        const cnt = await ownersCount(companyId, t);
        if (cnt <= 1) throw new Error('Нельзя заблокировать единственного владельца компании');
      }
      row.status = nextStatus;
    }

    // --- департамент и isLead ---
    if (Object.prototype.hasOwnProperty.call(payload, 'departmentId')) {
      // company-wide — можно любую; dept-ограничение — уже проверено выше
      row.departmentId = departmentId || null;
    }
    if (Object.prototype.hasOwnProperty.call(payload, 'isLead')) {
      row.isLead = !!isLead;
    }

    await row.save({ transaction: t });

    invalidate(userId, companyId);
    return row;
  });
};

// --- REMOVE USER FROM COMPANY ---
/**
 * Права:
 *  - member:delete          → удалять любых
 *  - member:delete:dept     → удалять только в своём департаменте
 */
exports.removeUserFromCompany = async (requesterId, companyId, userId) => {
  const requester = { id: requesterId };

  // company-wide?
  const canCompanyWide = await check({ user: requester, companyId, required: 'member:delete' });

  // иначе dept?
  let deptLimitId = null;
  if (!canCompanyWide) {
    const allowDept = await check({
      user: requester,
      companyId,
      required: 'member:delete',
      opts: { deptCheck: async () => true },
    });
    if (!allowDept) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
    deptLimitId = await getRequesterDeptId(requesterId, companyId);
    if (!deptLimitId) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }

  return sequelize.transaction(async (t) => {
    const row = await UserCompany.findOne({ where: { companyId, userId }, transaction: t });
    if (!row) return null;

    // при dept-ограничении — можно удалять только из своего департамента
    if (deptLimitId && row.departmentId !== deptLimitId) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    // владелец — защита последнего владельца
    if (row.role === 'owner') {
      const cnt = await ownersCount(companyId, t);
      if (cnt <= 1) throw new Error('Нельзя удалить последнего владельца компании');
    }

    await row.destroy({ transaction: t }); // paranoid=true

    // Если больше нет активных membership-ов — можно деактивировать User (как и раньше)
    const rest = await UserCompany.count({
      where: { userId, status: 'active' },
      transaction: t,
    });
    if (rest === 0) {
      await User.update({ isActive: false }, { where: { id: userId }, transaction: t });
    }

    invalidate(userId, companyId);
    return true;
  });
};