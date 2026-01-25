// services/crm/taskService.js
"use strict";

const { Op } = require("sequelize");
const {
  Task,
  User,
  UserCompany,
  CompanyDepartment,
  TaskUserParticipant,
  TaskDepartmentParticipant,
  TaskContact,
  Contact,
  Counterparty,
  Deal,
} = require("../../models");
const notificationService = require("../system/notificationService");

const PAGE = 1;
const LIMIT = 20;

const STATUS_VALUES = ["todo", "in_progress", "done", "blocked", "canceled"];
const MEMBER_STATUS_VALUES = STATUS_VALUES;

function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error("companyId is required");
    err.status = 400;
    throw err;
  }
  return companyId;
}

function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.filter(Boolean);
  return [...new Set(ids)];
}

async function assertCounterpartyInCompany(counterpartyId, companyId) {
  if (!counterpartyId) return;
  const row = await Counterparty.findOne({
    where: { id: counterpartyId, companyId },
    attributes: ["id"],
  });
  if (!row) {
    const err = new Error("counterpartyId is invalid");
    err.status = 400;
    throw err;
  }
}

async function assertDealInCompany(dealId, companyId) {
  if (!dealId) return;
  const row = await Deal.findOne({
    where: { id: dealId, companyId },
    attributes: ["id"],
  });
  if (!row) {
    const err = new Error("dealId is invalid");
    err.status = 400;
    throw err;
  }
}

async function assertContactIdsInCompany(contactIds, companyId) {
  const ids = normalizeIds(contactIds);
  if (!ids.length) return;
  const rows = await Contact.findAll({
    where: { id: { [Op.in]: ids }, companyId },
    attributes: ["id"],
    raw: true,
  });
  const allowed = new Set(rows.map((r) => r.id));
  const invalid = ids.filter((id) => !allowed.has(id));
  if (invalid.length) {
    const err = new Error("contactIds are invalid");
    err.status = 400;
    throw err;
  }
}

async function assertDepartmentIdsInCompany(departmentIds, companyId) {
  const ids = normalizeIds(departmentIds);
  if (!ids.length) return;
  const rows = await CompanyDepartment.findAll({
    where: { id: { [Op.in]: ids }, companyId },
    attributes: ["id"],
    raw: true,
  });
  const allowed = new Set(rows.map((r) => r.id));
  const invalid = ids.filter((id) => !allowed.has(id));
  if (invalid.length) {
    const err = new Error("departmentIds are invalid");
    err.status = 400;
    throw err;
  }
}

async function assertMemberIdsInCompany(userIds, companyId, label = "userIds") {
  const ids = normalizeIds(userIds);
  if (!ids.length) return;
  const rows = await UserCompany.findAll({
    where: { companyId, userId: { [Op.in]: ids } },
    attributes: ["userId"],
    raw: true,
  });
  const allowed = new Set(rows.map((r) => r.userId));
  const invalid = ids.filter((id) => !allowed.has(id));
  if (invalid.length) {
    const err = new Error(`${label} are invalid`);
    err.status = 400;
    throw err;
  }
}

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
  if (query.counterpartyId) where.counterpartyId = query.counterpartyId;
  if (query.dealId) where.dealId = query.dealId;
  if (query.q) where.title = { [Op.iLike]: `%${query.q.trim()}%` };

  // по дате (пересечение с интервалом)
  // ?date=2025-11-05  или ?from=...&to=...
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && to) {
    // (start < to) AND (end > from) — пересечение интервалов
    where[Op.and] = [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op.lt]: to } }] },
      { [Op.or]: [{ endAt: null }, { endAt: { [Op.gt]: from } }] },
    ];
  } else if (query.date) {
    const d = new Date(query.date);
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    where[Op.and] = [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op]: { lt: next } } }] },
      { [Op.or]: [{ endAt: null }, { endAt: { [Op]: { gt: d } } }] },
    ];
  }

  return where;
}

function pickAssigneeIds(payload) {
  const ids = Array.isArray(payload.assigneeIds)
    ? payload.assigneeIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}
function pickWatcherIds(payload) {
  const ids = Array.isArray(payload.watcherIds)
    ? payload.watcherIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}
function pickDepartmentIds(payload) {
  const ids = Array.isArray(payload.departmentIds)
    ? payload.departmentIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}
function pickContactIds(payload) {
  const ids = Array.isArray(payload.contactIds)
    ? payload.contactIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}

async function expandAllUsersForCompany(companyId) {
  const rows = await UserCompany.findAll({
    attributes: ["userId"],
    where: { companyId },
    raw: true,
  });
  return rows.map((r) => r.userId).filter(Boolean);
}

async function ensureParticipants({ task, companyId, payload }) {
  // participantMode: 'none' | 'all' | 'lists'
  // watcherMode:     'none' | 'all' | 'lists'
  const { participantMode, watcherMode } = task;

  let assigneeIds = [];
  let watcherIds = [];
  let departmentIds = [];

  if (participantMode === "all") {
    assigneeIds = await expandAllUsersForCompany(companyId);
  } else if (participantMode === "lists") {
    assigneeIds = pickAssigneeIds(payload);
    departmentIds = pickDepartmentIds(payload);
    await assertMemberIdsInCompany(assigneeIds, companyId, "assigneeIds");
    await assertDepartmentIdsInCompany(departmentIds, companyId);
  } // none → пусто

  if (watcherMode === "all") {
    watcherIds = await expandAllUsersForCompany(companyId);
  } else if (watcherMode === "lists") {
    watcherIds = pickWatcherIds(payload);
    await assertMemberIdsInCompany(watcherIds, companyId, "watcherIds");
  }

  // очищаем/пересобираем bindings (простая стратегия, можно оптимизировать diff-ом)
  await TaskUserParticipant.destroy({ where: { taskId: task.id } });
  await TaskDepartmentParticipant.destroy({ where: { taskId: task.id } });

  // users
  const userRows = [
    ...assigneeIds.map((uid) => ({
      taskId: task.id,
      userId: uid,
      role: "assignee",
      memberStatus: "todo",
    })),
    ...watcherIds
      .filter((uid) => !assigneeIds.includes(uid))
      .map((uid) => ({
        taskId: task.id,
        userId: uid,
        role: "watcher",
        memberStatus: "todo",
      })),
  ];
  if (userRows.length) {
    await TaskUserParticipant.bulkCreate(userRows, { ignoreDuplicates: true });
  }

  // departments
  if (departmentIds.length) {
    const depRows = departmentIds.map((did) => ({
      taskId: task.id,
      departmentId: did,
      role: "assignee",
    }));
    await TaskDepartmentParticipant.bulkCreate(depRows, {
      ignoreDuplicates: true,
    });
  }
}

async function ensureContacts({ task, payload, companyId }) {
  const contactIds = pickContactIds(payload);
  await assertContactIdsInCompany(contactIds, companyId);
  await TaskContact.destroy({ where: { taskId: task.id } });
  if (contactIds.length) {
    await TaskContact.bulkCreate(
      contactIds.map((id) => ({ taskId: task.id, contactId: id })),
      { ignoreDuplicates: true }
    );
  }
}

function computeAggregatedStatus(memberStatuses, aggregateFlag) {
  if (!memberStatuses.length) return null; // нечего агрегировать

  if (aggregateFlag) {
    // ВСЕ должны быть 'done'
    const allDone = memberStatuses.every((s) => s === "done");
    return allDone ? "done" : "in_progress";
  } else {
    // ДОСТАТОЧНО хотя бы одного 'done'
    const anyDone = memberStatuses.some((s) => s === "done");
    return anyDone ? "done" : "in_progress";
  }
}

async function recomputeTaskStatusIfNeeded({ taskId, companyId }) {
  requireCompanyId(companyId);
  const task = await Task.findOne({
    where: { id: taskId, companyId },
    attributes: ["id", "status", "statusAggregate"],
  });
  if (!task) return;

  if (!task.statusAggregate) return;

  const members = await TaskUserParticipant.findAll({
    attributes: ["memberStatus"],
    where: { taskId, role: "assignee" },
    raw: true,
  });
  const memberStatuses = members.map((m) => m.memberStatus);
  if (!memberStatuses.length) return;

  const next = computeAggregatedStatus(memberStatuses, true);
  if (next && next !== task.status) {
    task.status = next;
    await task.save();
  }
}

module.exports = {
  // ---------- LIST ----------
  async list({ query, companyId /*, user*/ }) {
    const cid = requireCompanyId(companyId);
    const { page, limit, offset } = parsePagination(query);
    if (query.counterpartyId)
      await assertCounterpartyInCompany(query.counterpartyId, cid);
    if (query.dealId) await assertDealInCompany(query.dealId, cid);
    const where = buildListWhere({ companyId: cid, query });

    const { rows, count } = await Task.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      limit,
      offset,
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: Counterparty,
          as: "counterparty",
          attributes: ["id", "shortName", "fullName"],
          where: { companyId: cid },
          required: false,
        },
        {
          model: Deal,
          as: "deal",
          attributes: ["id", "title", "status"],
          where: { companyId: cid },
          required: false,
        },
        {
          model: User,
          as: "userParticipants",
          attributes: ["id", "firstName", "lastName", "email"],
          through: { attributes: ["role", "memberStatus"] },
          include: [
            {
              model: UserCompany,
              as: "memberships",
              attributes: [],
              where: { companyId: cid },
              required: true,
            },
          ],
          required: false,
        },
      ],
    });

    return { rows, count, page, limit };
  },

  // ---------- CALENDAR ----------
  async listCalendar({ query, companyId /*, user*/ }) {
    const cid = requireCompanyId(companyId);
    // обязательный диапазон
    const start = query.from ? new Date(query.from) : null;
    const end = query.to ? new Date(query.to) : null;
    if (!start || !end) {
      throw new Error("Calendar requires from/to (ISO date).");
    }

    const where = {
      companyId: cid,
      [Op.and]: [
        { [Op.or]: [{ startAt: null }, { startAt: { [Op.lt]: end } }] },
        { [Op.or]: [{ endAt: null }, { endAt: { [Op.gt]: start } }] },
      ],
    };

    const items = await Task.findAll({
      where,
      attributes: [
        "id",
        "title",
        "startAt",
        "endAt",
        "timezone",
        "status",
        "priority",
        "category",
        "createdBy",
      ],
      order: [
        ["startAt", "ASC"],
        ["createdAt", "DESC"],
      ],
    });

    // ответ для календаря
    const data = items.map((t) => {
      const isAllDay = !!(
        t.startAt &&
        t.endAt &&
        new Date(t.endAt).getTime() - new Date(t.startAt).getTime() ===
          24 * 3600 * 1000 &&
        new Date(t.startAt).getHours() === 0 &&
        new Date(t.startAt).getMinutes() === 0
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
    const cid = requireCompanyId(companyId);
    const item = await Task.findOne({
      where: { id, companyId: cid },
      include: [
        {
          model: User,
          as: "creator",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: Counterparty,
          as: "counterparty",
          attributes: ["id", "shortName", "fullName"],
          where: { companyId: cid },
          required: false,
        },
        {
          model: Deal,
          as: "deal",
          attributes: ["id", "title", "status"],
          where: { companyId: cid },
          required: false,
        },
        {
          model: User,
          as: "userParticipants",
          attributes: ["id", "firstName", "lastName", "email"],
          through: { attributes: ["role", "memberStatus"] },
          include: [
            {
              model: UserCompany,
              as: "memberships",
              attributes: [],
              where: { companyId: cid },
              required: true,
            },
          ],
          required: false,
        },
        {
          model: CompanyDepartment,
          as: "departmentParticipants",
          attributes: ["id", "name"],
          where: { companyId: cid },
          required: false,
        },
        {
          model: Contact,
          as: "contacts",
          attributes: [
            "id",
            "firstName",
            "lastName",
            "displayName",
            "jobTitle",
          ],
          through: { attributes: [] },
          where: { companyId: cid },
          required: false,
        },
      ],
    });
    return item;
  },

  // ---------- CREATE ----------
  async create({ payload, companyId, user }) {
    const cid = requireCompanyId(companyId);
    // обязательные: companyId, createdBy, title
    if (!payload?.title) throw new Error('"title" is required');
    const createdBy = user?.id || payload.createdBy;
    if (!createdBy) throw new Error('"createdBy" is required');

    // нормализуем моды
    const participantMode =
      payload.participantMode ||
      (payload.assigneeIds?.length || payload.departmentIds?.length
        ? "lists"
        : "none");
    const watcherMode =
      payload.watcherMode || (payload.watcherIds?.length ? "lists" : "none");

    if (payload.counterpartyId)
      await assertCounterpartyInCompany(payload.counterpartyId, cid);
    if (payload.dealId) await assertDealInCompany(payload.dealId, cid);
    if (participantMode === "lists") {
      await assertMemberIdsInCompany(
        pickAssigneeIds(payload),
        cid,
        "assigneeIds"
      );
      await assertDepartmentIdsInCompany(pickDepartmentIds(payload), cid);
    }
    if (watcherMode === "lists") {
      await assertMemberIdsInCompany(
        pickWatcherIds(payload),
        cid,
        "watcherIds"
      );
    }
    if (payload.contactIds !== undefined) {
      await assertContactIdsInCompany(pickContactIds(payload), cid);
    }

    // создаём
    const task = await Task.create({
      companyId: cid,
      createdBy,
      title: payload.title,
      category: payload.category || null,
      description: payload.description || null,
      status:
        payload.status && STATUS_VALUES.includes(payload.status)
          ? payload.status
          : "todo",
      priority: Number.isInteger(payload.priority)
        ? Math.min(100, Math.max(0, payload.priority))
        : 50,
      startAt: payload.startAt || null,
      endAt: payload.endAt || null,
      timezone: payload.timezone || null,
      participantMode,
      watcherMode,
      statusAggregate: !!payload.statusAggregate,
      counterpartyId: payload.counterpartyId || null,
      dealId: payload.dealId || null,
    });

    await ensureParticipants({ task, companyId: cid, payload });
    await ensureContacts({ task, payload, companyId: cid });

    await recomputeTaskStatusIfNeeded({ taskId: task.id, companyId: cid });

    // 🔔 уведомления участникам/наблюдателям
    try {
      let assigneeIds = [];
      let watcherIds = [];

      if ((task.participantMode || payload.participantMode) === "all") {
        assigneeIds = await expandAllUsersForCompany(cid);
      } else {
        assigneeIds = pickAssigneeIds(payload);
      }

      if ((task.watcherMode || payload.watcherMode) === "all") {
        watcherIds = await expandAllUsersForCompany(cid);
      } else {
        watcherIds = pickWatcherIds(payload);
      }

      const actorId = user?.id || payload.createdBy;
      const recipients = [...new Set([...assigneeIds, ...watcherIds])].filter(
        (id) => id && id !== actorId
      );

      if (recipients.length) {
        await notificationService.notifyManyUsers({
          companyId: cid,
          userIds: recipients,
          type: "task.created",
          title: "Task created",
          body: null,
          entityType: "task",
          entityId: task.id,
          meta: {
            title: task.title,
            description: payload.description || null,
            priority: task.priority,
            status: task.status,
            category: task.category,
          },
        });
      }
    } catch (e) {
      console.error("[taskService.create] notify error", e);
    }

    return await this.getById({ id: task.id, companyId: cid });
  },

  // ---------- UPDATE ----------
  async update({ id, payload, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const task = await Task.findOne({ where: { id, companyId: cid } });
    if (!task) throw new Error("Task not found");

    const originalStatus = task.status; // запоминаем старый статус

    if (payload.counterpartyId !== undefined && payload.counterpartyId !== null) {
      await assertCounterpartyInCompany(payload.counterpartyId, cid);
    }
    if (payload.dealId !== undefined && payload.dealId !== null) {
      await assertDealInCompany(payload.dealId, cid);
    }
    if (payload.assigneeIds !== undefined) {
      await assertMemberIdsInCompany(
        pickAssigneeIds(payload),
        cid,
        "assigneeIds"
      );
    }
    if (payload.watcherIds !== undefined) {
      await assertMemberIdsInCompany(
        pickWatcherIds(payload),
        cid,
        "watcherIds"
      );
    }
    if (payload.departmentIds !== undefined) {
      await assertDepartmentIdsInCompany(pickDepartmentIds(payload), cid);
    }
    if (payload.contactIds !== undefined) {
      await assertContactIdsInCompany(pickContactIds(payload), cid);
    }
    if (Array.isArray(payload.memberStatuses)) {
      const memberIds = payload.memberStatuses
        .map((m) => m?.userId)
        .filter(Boolean);
      await assertMemberIdsInCompany(memberIds, cid, "memberStatuses");
    }

    const next = {};
    if (payload.title !== undefined) next.title = payload.title || "";
    if (payload.category !== undefined)
      next.category = payload.category || null;
    if (payload.description !== undefined)
      next.description = payload.description || null;
    if (payload.priority !== undefined)
      next.priority = Math.min(
        100,
        Math.max(0, parseInt(payload.priority, 10) || 0)
      );
    if (payload.startAt !== undefined) next.startAt = payload.startAt || null;
    if (payload.endAt !== undefined) next.endAt = payload.endAt || null;
    if (payload.timezone !== undefined)
      next.timezone = payload.timezone || null;
    if (payload.statusAggregate !== undefined)
      next.statusAggregate = !!payload.statusAggregate;
    if (payload.counterpartyId !== undefined)
      next.counterpartyId = payload.counterpartyId || null;
    if (payload.dealId !== undefined) next.dealId = payload.dealId || null;

    if (payload.status && STATUS_VALUES.includes(payload.status)) {
      next.status = payload.status;
    }

    if (payload.participantMode) next.participantMode = payload.participantMode;
    if (payload.watcherMode) next.watcherMode = payload.watcherMode;

    await task.update(next);

    // пересоберём участники/наблюдатели/контакты, если они пришли (или поменялись режимы)
    if (
      payload.assigneeIds !== undefined ||
      payload.departmentIds !== undefined ||
      payload.watcherIds !== undefined ||
      payload.participantMode ||
      payload.watcherMode
    ) {
      await ensureParticipants({ task, companyId: cid, payload });
    }
    if (payload.contactIds !== undefined) {
      await ensureContacts({ task, payload, companyId: cid });
    }

    // обновление индивидуальных статусов исполнителей
    if (Array.isArray(payload.memberStatuses)) {
      // массив объектов { userId, memberStatus }
      const patch = payload.memberStatuses.filter(
        (x) => x && x.userId && MEMBER_STATUS_VALUES.includes(x.memberStatus)
      );

      for (const m of patch) {
        await TaskUserParticipant.update(
          { memberStatus: m.memberStatus },
          { where: { taskId: task.id, userId: m.userId, role: "assignee" } }
        );
      }
    }

    // если флаг агрегирования включён — пересчитать общий статус
    await recomputeTaskStatusIfNeeded({ taskId: task.id, companyId: cid });

    try {
      const updated = await this.getById({ id: task.id, companyId: cid });

      // если статус поменяли — уведомим всех
      if (
        payload.status &&
        STATUS_VALUES.includes(payload.status) &&
        payload.status !== originalStatus
      ) {
        const assignees = (updated.userParticipants || [])
          .filter((u) => u.TaskUserParticipant?.role === "assignee")
          .map((u) => u.id);
        const watchers = (updated.userParticipants || [])
          .filter((u) => u.TaskUserParticipant?.role === "watcher")
          .map((u) => u.id);

        const actorId = user?.id || null;
        const recipients = [...new Set([...assignees, ...watchers])].filter(
          (uid) => uid && uid !== actorId
        );

        if (recipients.length) {
          await notificationService.notifyManyUsers({
            companyId: cid,
            userIds: recipients,
            type: "task.statusChanged",
            title: "Task status changed",
            body: null,
            entityType: "task",
            entityId: updated.id,
            meta: {
              title: updated.title || "",
              oldStatus: originalStatus,
              newStatus: payload.status,
            },
          });
        }
      }

      return updated;
    } catch (e) {
      console.error("[taskService.update] notify error", e);
      return await this.getById({ id: task.id, companyId: cid });
    }
  },

  // ---------- REMOVE (soft) ----------
  async remove({ id, companyId }) {
    const cid = requireCompanyId(companyId);
    const task = await Task.findOne({ where: { id, companyId: cid } });
    if (!task) throw new Error("Task not found");
    await task.destroy();
  },

  // ---------- RESTORE ----------
  async restore({ id, companyId }) {
    const cid = requireCompanyId(companyId);
    await Task.restore({ where: { id, companyId: cid } });
    return await this.getById({ id, companyId: cid });
  },
};
