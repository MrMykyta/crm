// services/crm/taskService.js
'use strict';

const { Op, fn, col, literal, Sequelize } = require('sequelize');
const { Task, User, CompanyDepartment, TaskUserParticipant, TaskDepartmentParticipant, TaskContact, Contact, Counterparty, Deal } = require('../../models');

const PAGE = 1;
const LIMIT = 20;

const STATUS_VALUES = ['todo','in_progress','done','blocked','canceled'];
const MEMBER_STATUS_VALUES = STATUS_VALUES;

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || PAGE);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildListWhere({ companyId, query }) {
  const where = { companyId };
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.q) where.title = { [Op.iLike]: `%${query.q.trim()}%` };

  // по дате (пересечение с интервалом)
  // ?date=2025-11-05  или ?from=...&to=...
  const from = query.from ? new Date(query.from) : null;
  const to   = query.to   ? new Date(query.to)   : null;
  if (from && to) {
    // (start < to) AND (end > from) — пересечение интервалов
    where[Op.and] = [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op.lt]: to } }] },
      { [Op.or]: [{ endAt: null },   { endAt: { [Op.gt]: from } }] },
    ];
  } else if (query.date) {
    const d = new Date(query.date);
    const next = new Date(d); next.setDate(d.getDate() + 1);
    where[Op.and] = [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op] : { lt: next } } }] },
      { [Op.or]: [{ endAt: null },   { endAt: { [Op] : { gt: d } } }] },
    ];
  }

  return where;
}

function pickAssigneeIds(payload) {
  const ids = Array.isArray(payload.assigneeIds) ? payload.assigneeIds.filter(Boolean) : [];
  return [...new Set(ids)];
}
function pickWatcherIds(payload) {
  const ids = Array.isArray(payload.watcherIds) ? payload.watcherIds.filter(Boolean) : [];
  return [...new Set(ids)];
}
function pickDepartmentIds(payload) {
  const ids = Array.isArray(payload.departmentIds) ? payload.departmentIds.filter(Boolean) : [];
  return [...new Set(ids)];
}
function pickContactIds(payload) {
  const ids = Array.isArray(payload.contactIds) ? payload.contactIds.filter(Boolean) : [];
  return [...new Set(ids)];
}

async function expandAllUsersForCompany(companyId) {
  // можно ограничить активными/сотрудниками компании
  const rows = await User.findAll({
    attributes: ['id'],
    where: { companyId, isActive: true },
    raw: true,
  });
  return rows.map(r => r.id);
}

async function ensureParticipants({ task, companyId, payload, isUpdate }) {
  // participantMode: 'none' | 'all' | 'lists'
  // watcherMode:     'none' | 'all' | 'lists'
  const { participantMode, watcherMode } = task;

  let assigneeIds = [];
  let watcherIds  = [];
  let departmentIds = [];

  if (participantMode === 'all') {
    assigneeIds = await expandAllUsersForCompany(companyId);
  } else if (participantMode === 'lists') {
    assigneeIds = pickAssigneeIds(payload);
    departmentIds = pickDepartmentIds(payload);
  } // none → пусто

  if (watcherMode === 'all') {
    watcherIds = await expandAllUsersForCompany(companyId);
  } else if (watcherMode === 'lists') {
    watcherIds = pickWatcherIds(payload);
  }

  // очищаем/пересобираем bindings (простая стратегия, можно оптимизировать diff-ом)
  await TaskUserParticipant.destroy({ where: { taskId: task.id } });
  await TaskDepartmentParticipant.destroy({ where: { taskId: task.id } });

  // users
  const userRows = [
    ...assigneeIds.map(uid => ({ taskId: task.id, userId: uid, role: 'assignee', memberStatus: 'todo' })),
    ...watcherIds
      .filter(uid => !assigneeIds.includes(uid))
      .map(uid => ({ taskId: task.id, userId: uid, role: 'watcher', memberStatus: 'todo' })),
  ];
  if (userRows.length) {
    await TaskUserParticipant.bulkCreate(userRows, { ignoreDuplicates: true });
  }

  // departments
  if (departmentIds.length) {
    const depRows = departmentIds.map(did => ({ taskId: task.id, departmentId: did, role: 'assignee' }));
    await TaskDepartmentParticipant.bulkCreate(depRows, { ignoreDuplicates: true });
  }
}

async function ensureContacts({ task, payload }) {
  const contactIds = pickContactIds(payload);
  await TaskContact.destroy({ where: { taskId: task.id } });
  if (contactIds.length) {
    await TaskContact.bulkCreate(
      contactIds.map(id => ({ taskId: task.id, contactId: id })),
      { ignoreDuplicates: true }
    );
  }
}

function computeAggregatedStatus(memberStatuses, aggregateFlag) {
  if (!memberStatuses.length) return null; // нечего агрегировать

  if (aggregateFlag) {
    // ВСЕ должны быть 'done'
    const allDone = memberStatuses.every(s => s === 'done');
    return allDone ? 'done' : 'in_progress';
  } else {
    // ДОСТАТОЧНО хотя бы одного 'done'
    const anyDone = memberStatuses.some(s => s === 'done');
    return anyDone ? 'done' : 'in_progress';
  }
}

async function recomputeTaskStatusIfNeeded(taskId) {
  const task = await Task.findByPk(taskId, { attributes: ['id','status','statusAggregate'] });
  if (!task) return;

  if (!task.statusAggregate) return; // правила «любой done» применяем только при изменении статусов исполнителей через update()

  const members = await TaskUserParticipant.findAll({
    attributes: ['memberStatus'],
    where: { taskId, role: 'assignee' },
    raw: true,
  });
  const memberStatuses = members.map(m => m.memberStatus);
  if (!memberStatuses.length) return;

  const next = computeAggregatedStatus(memberStatuses, true);
  if (next && next !== task.status) {
    task.status = next;
    await task.save();
  }
}

module.exports = {
  // ---------- LIST ----------
  async list({ query, companyId, user }) {
    const { page, limit, offset } = parsePagination(query);
    const where = buildListWhere({ companyId, query });

    const { rows, count } = await Task.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      include: [
        { model: User, as: 'creator', attributes: ['id','firstName','lastName','email'] },
        { model: Counterparty, as: 'counterparty', attributes: ['id','shortName','fullName'] },
        { model: Deal, as: 'deal', attributes: ['id','title','status'] },
        {
          model: User,
          as: 'userParticipants',
          attributes: ['id','firstName','lastName','email'],
          through: { attributes: ['role','memberStatus'] }
        },
      ],
    });

    return { rows, count, page, limit };
  },

  // ---------- CALENDAR ----------
  async listCalendar({ query, companyId, user }) {
    // обязательный диапазон
    const start = query.from ? new Date(query.from) : null;
    const end   = query.to   ? new Date(query.to)   : null;
    if (!start || !end) {
      throw new Error('Calendar requires from/to (ISO date).');
    }

    const where = {
      companyId,
      [Op.and]: [
        { [Op.or]: [{ startAt: null }, { startAt: { [Op.lt]: end   } }] },
        { [Op.or]: [{ endAt:   null }, { endAt:   { [Op.gt]: start } }] },
      ],
    };

    const items = await Task.findAll({
      where,
      attributes: ['id','title','startAt','endAt','timezone','status','priority','category','createdBy'],
      order: [['startAt','ASC'], ['createdAt','DESC']],
    });

    // ответ для календаря
    const data = items.map(t => {
      const isAllDay = !!(
        t.startAt && t.endAt &&
        new Date(t.endAt).getTime() - new Date(t.startAt).getTime() === 24*3600*1000 &&
        new Date(t.startAt).getHours()===0 && new Date(t.startAt).getMinutes()===0
      );
      return {
        id: t.id,
        title: t.title,
        start: t.startAt,
        end: t.endAt,
        allDay: isAllDay,
        status: t.status,
        priority: t.priority,
        category: t.category,
        timezone: t.timezone || null,
      };
    });

    return data;
  },

  // ---------- GET ----------
  async getById({ id, companyId /*, user*/ }) {
    const item = await Task.findOne({
      where: { id, companyId },
      include: [
        { model: User, as: 'creator', attributes: ['id','firstName','lastName','email'] },
        { model: Counterparty, as: 'counterparty', attributes: ['id','shortName','fullName'] },
        { model: Deal, as: 'deal', attributes: ['id','title','status'] },
        {
          model: User,
          as: 'userParticipants',
          attributes: ['id','firstName','lastName','email'],
          through: { attributes: ['role','memberStatus'] },
        },
        {
          model: CompanyDepartment,
          as: 'departmentParticipants',
          attributes: ['id','name'],
        },
        {
          model: Contact,
          as: 'contacts',
          attributes: ['id','firstName','lastName','displayName','jobTitle'],
          through: { attributes: [] },
        },
      ],
    });
    return item;
  },

  // ---------- CREATE ----------
  async create({ payload, companyId, user }) {
    // обязательные: companyId, createdBy, title
    if (!payload?.title) throw new Error('"title" is required');
    const createdBy = user?.id || payload.createdBy;
    if (!createdBy) throw new Error('"createdBy" is required');

    // нормализуем моды
    const participantMode = payload.participantMode || (payload.assigneeIds?.length || payload.departmentIds?.length ? 'lists' : 'none');
    const watcherMode     = payload.watcherMode     || (payload.watcherIds?.length ? 'lists' : 'none');

    // создаём
    const task = await Task.create({
      companyId,
      createdBy,
      title: payload.title,
      category: payload.category || null,
      description: payload.description || null,
      status: payload.status && STATUS_VALUES.includes(payload.status) ? payload.status : 'todo',
      priority: Number.isInteger(payload.priority) ? Math.min(100, Math.max(0, payload.priority)) : 50,
      startAt: payload.startAt || null,
      endAt: payload.endAt || null,
      timezone: payload.timezone || null,
      participantMode,
      watcherMode,
      statusAggregate: !!payload.statusAggregate,
      counterpartyId: payload.counterpartyId || null,
      dealId: payload.dealId || null,
    });

    await ensureParticipants({ task, companyId, payload, isUpdate: false });
    await ensureContacts({ task, payload });

    // если включено агрегирование — сразу пересчитаем (все исполнители сейчас 'todo' → статус останется 'in_progress' только если уже был выставлен)
    await recomputeTaskStatusIfNeeded(task.id);

    return await this.getById({ id: task.id, companyId });
  },

  // ---------- UPDATE ----------
  async update({ id, payload, companyId, user }) {
    const task = await Task.findOne({ where: { id, companyId } });
    if (!task) throw new Error('Task not found');

    // автор/админ может менять общий статус всегда.
    const next = {};
    if (payload.title !== undefined)       next.title = payload.title || '';
    if (payload.category !== undefined)    next.category = payload.category || null;
    if (payload.description !== undefined) next.description = payload.description || null;
    if (payload.priority !== undefined)    next.priority = Math.min(100, Math.max(0, parseInt(payload.priority,10) || 0));
    if (payload.startAt !== undefined)     next.startAt = payload.startAt || null;
    if (payload.endAt !== undefined)       next.endAt   = payload.endAt || null;
    if (payload.timezone !== undefined)    next.timezone = payload.timezone || null;
    if (payload.statusAggregate !== undefined) next.statusAggregate = !!payload.statusAggregate;
    if (payload.counterpartyId !== undefined)  next.counterpartyId = payload.counterpartyId || null;
    if (payload.dealId !== undefined)          next.dealId = payload.dealId || null;

    if (payload.status && STATUS_VALUES.includes(payload.status)) {
      next.status = payload.status;
    }

    if (payload.participantMode) next.participantMode = payload.participantMode;
    if (payload.watcherMode)     next.watcherMode     = payload.watcherMode;

    await task.update(next);

    // пересоберём участники/наблюдатели/контакты, если они пришли (или поменялись режимы)
    if (
      payload.assigneeIds !== undefined || payload.departmentIds !== undefined ||
      payload.watcherIds !== undefined  || payload.participantMode || payload.watcherMode
    ) {
      await ensureParticipants({ task, companyId, payload, isUpdate: true });
    }
    if (payload.contactIds !== undefined) {
      await ensureContacts({ task, payload });
    }

    // обновление индивидуальных статусов исполнителей
    if (Array.isArray(payload.memberStatuses)) {
      // массив объектов { userId, memberStatus }
      const patch = payload.memberStatuses
        .filter(x => x && x.userId && MEMBER_STATUS_VALUES.includes(x.memberStatus));

      for (const m of patch) {
        await TaskUserParticipant.update(
          { memberStatus: m.memberStatus },
          { where: { taskId: task.id, userId: m.userId, role: 'assignee' } }
        );
      }
    }

    // если флаг агрегирования включён — пересчитать общий статус
    await recomputeTaskStatusIfNeeded(task.id);

    return await this.getById({ id: task.id, companyId });
  },

  // ---------- REMOVE (soft) ----------
  async remove({ id, companyId }) {
    const task = await Task.findOne({ where: { id, companyId } });
    if (!task) throw new Error('Task not found');
    await task.destroy();
  },

  // ---------- RESTORE ----------
  async restore({ id, companyId }) {
    await Task.restore({ where: { id, companyId } });
    return await this.getById({ id, companyId });
  },
};