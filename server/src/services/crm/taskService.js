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
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

// normalizeBoolean: приводит значения к единому формату для сервиса.
function normalizeBoolean(value, fallback = false) {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

// hasNonZeroUtcTime: проверяет наличие данных и возвращает результат проверки.
function hasNonZeroUtcTime(date) {
  return !!(
    date.getUTCHours() ||
    date.getUTCMinutes() ||
    date.getUTCSeconds() ||
    date.getUTCMilliseconds()
  );
}

// extractIsoDatePart: выполняет вспомогательную бизнес-логику сервиса.
function extractIsoDatePart(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return value.toISOString().slice(0, 10);
  }

  const text = String(value || "").trim();
  if (!text) return null;
  if (DATE_ONLY_RE.test(text)) return text;

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

// parseDateInput: парсит и нормализует входные параметры.
function parseDateInput(raw, label) {
  if (raw === null || raw === "") return { value: null, dateOnly: false, hasExplicitTime: false };

  if (raw instanceof Date) {
    if (Number.isNaN(raw.getTime())) {
      const err = new Error(`${label} is invalid`);
      err.status = 400;
      throw err;
    }
    return {
      value: raw,
      dateOnly: false,
      hasExplicitTime: hasNonZeroUtcTime(raw),
    };
  }

  const text = String(raw || "").trim();
  if (!text) return { value: null, dateOnly: false, hasExplicitTime: false };

  if (DATE_ONLY_RE.test(text)) {
    const [y, m, d] = text.split("-").map(Number);
    return {
      value: new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0)),
      dateOnly: true,
      hasExplicitTime: false,
    };
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    const err = new Error(`${label} is invalid`);
    err.status = 400;
    throw err;
  }

  const hasExplicitTime = /t\d{2}:\d{2}/i.test(text) || hasNonZeroUtcTime(parsed);
  return {
    value: parsed,
    dateOnly: false,
    hasExplicitTime,
  };
}

// toUtcDateOnly: выполняет вспомогательную бизнес-логику сервиса.
function toUtcDateOnly(value) {
  if (!value) return null;
  const datePart = extractIsoDatePart(value);
  if (!datePart) return null;
  const [y, m, d] = datePart.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}

// resolveDatePair: выполняет вспомогательную бизнес-логику сервиса.
function resolveDatePair({
  payload,
  valueKeys,
  hasTimeKeys,
  existingValue,
  existingHasTime = true,
  label,
}) {
  const valueKey = valueKeys.find((key) => Object.prototype.hasOwnProperty.call(payload, key));
  const hasTimeKey = hasTimeKeys.find((key) => Object.prototype.hasOwnProperty.call(payload, key));

  const hasValueInput = Boolean(valueKey);
  const hasHasTimeInput = Boolean(hasTimeKey);

  if (!hasValueInput && !hasHasTimeInput) {
    return { provided: false, value: existingValue, hasTime: existingHasTime };
  }

  let parsed = null;
  if (hasValueInput) {
    parsed = parseDateInput(payload[valueKey], label);
  } else if (existingValue) {
    parsed = {
      value: existingValue instanceof Date ? existingValue : new Date(existingValue),
      dateOnly: false,
      hasExplicitTime: hasNonZeroUtcTime(new Date(existingValue)),
    };
  } else {
    parsed = { value: null, dateOnly: false, hasExplicitTime: false };
  }

  let nextHasTime;
  if (hasHasTimeInput) {
    nextHasTime = normalizeBoolean(payload[hasTimeKey], existingHasTime);
  } else if (hasValueInput) {
    nextHasTime = parsed.dateOnly ? false : parsed.hasExplicitTime;
  } else {
    nextHasTime = existingHasTime;
  }

  let nextValue = parsed.value;
  if (!nextHasTime && nextValue) {
    nextValue = toUtcDateOnly(nextValue);
  }

  return {
    provided: true,
    value: nextValue,
    hasTime: !!nextHasTime,
  };
}

// inferHasTimeFromValue: выполняет вспомогательную бизнес-логику сервиса.
function inferHasTimeFromValue(value, fallback = true) {
  if (!value) return fallback;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return hasNonZeroUtcTime(parsed);
}

// toTaskDto: выполняет вспомогательную бизнес-логику сервиса.
function toTaskDto(task) {
  const row = task?.toJSON ? task.toJSON() : task;
  if (!row) return row;

  const plannedStartAt = row.startAt || null;
  const plannedEndAt = row.endAt || null;
  const actualStartAt = row.actualStartAt || null;
  const actualEndAt = row.actualEndAt || null;

  const plannedStartHasTime =
    typeof row.plannedStartHasTime === "boolean"
      ? row.plannedStartHasTime
      : inferHasTimeFromValue(plannedStartAt, true);
  const plannedEndHasTime =
    typeof row.plannedEndHasTime === "boolean"
      ? row.plannedEndHasTime
      : inferHasTimeFromValue(plannedEndAt, true);
  const actualStartHasTime =
    typeof row.actualStartHasTime === "boolean"
      ? row.actualStartHasTime
      : inferHasTimeFromValue(actualStartAt, true);
  const actualEndHasTime =
    typeof row.actualEndHasTime === "boolean"
      ? row.actualEndHasTime
      : inferHasTimeFromValue(actualEndAt, true);

  return {
    ...row,
    plannedStartAt,
    plannedEndAt,
    actualStartAt,
    actualEndAt,
    plannedStartHasTime,
    plannedEndHasTime,
    actualStartHasTime,
    actualEndHasTime,
  };
}

// validateRange: валидирует входные данные и выбрасывает ошибку при нарушениях.
function validateRange({
  startValue,
  endValue,
  startHasTime,
  endHasTime,
  startLabel,
  endLabel,
}) {
  if (!startValue || !endValue) return;

  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;

  if (!startHasTime && !endHasTime) {
    if (end < start) {
      const err = new Error(`${endLabel} must be greater than or equal to ${startLabel}`);
      err.status = 400;
      throw err;
    }
    return;
  }

  if (!(end > start)) {
    const err = new Error(`${endLabel} must be greater than ${startLabel}`);
    err.status = 400;
    throw err;
  }
}

// requireCompanyId: выполняет вспомогательную бизнес-логику сервиса.
function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error("companyId is required");
    err.status = 400;
    throw err;
  }
  return companyId;
}

// normalizeIds: приводит значения к единому формату для сервиса.
function normalizeIds(value) {
  if (!Array.isArray(value)) return [];
  const ids = value.filter(Boolean);
  return [...new Set(ids)];
}

// assertCounterpartyInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// assertDealInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// assertContactIdsInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// assertDepartmentIdsInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// assertMemberIdsInCompany: выполняет вспомогательную бизнес-логику сервиса.
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

// parsePagination: парсит и нормализует входные параметры.
function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || PAGE);
  const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// buildListWhere: собирает служебную структуру для выполнения запроса.
function buildListWhere({ companyId, query }) {
  const where = { companyId };
  if (query.status) where.status = query.status;
  if (query.category) where.category = query.category;
  if (query.counterpartyId) where.counterpartyId = query.counterpartyId;
  if (query.dealId) where.dealId = query.dealId;
  const search = String(query.search || query.q || "").trim();
  if (search) where.title = { [Op.iLike]: `%${search}%` };

  // по дате (пересечение с интервалом)
  // ?date=2025-11-05  или ?from=...&to=...
  const from = query.from ? new Date(query.from) : null;
  const to = query.to ? new Date(query.to) : null;
  if (from && Number.isNaN(from.getTime())) {
    const err = new Error("from is invalid");
    err.status = 400;
    throw err;
  }
  if (to && Number.isNaN(to.getTime())) {
    const err = new Error("to is invalid");
    err.status = 400;
    throw err;
  }
  if (from && to) {
    // (start < to) AND (end > from) — пересечение интервалов
    where[Op.and] = [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op.lt]: to } }] },
      { [Op.or]: [{ endAt: null }, { endAt: { [Op.gt]: from } }] },
    ];
  } else if (query.date) {
    const d = new Date(query.date);
    if (Number.isNaN(d.getTime())) {
      const err = new Error("date is invalid");
      err.status = 400;
      throw err;
    }
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    where[Op.and] = [
      { [Op.or]: [{ startAt: null }, { startAt: { [Op.lt]: next } }] },
      { [Op.or]: [{ endAt: null }, { endAt: { [Op.gt]: d } }] },
    ];
  }

  return where;
}

// parseListOrder: парсит и нормализует входные параметры.
function parseListOrder(query = {}) {
  const sortRaw = String(query.sort || "").trim();
  const dirRaw = String(query.dir || "DESC").toUpperCase() === "ASC" ? "ASC" : "DESC";

  const map = {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    title: "title",
    status: "status",
    priority: "priority",
    startAt: "startAt",
    endAt: "endAt",
  };

  const sort = map[sortRaw] || "createdAt";
  return [[sort, dirRaw]];
}

// buildListIncludes: joins display data after task ids have been paginated.
function buildListIncludes(companyId) {
  return [
    {
      model: User,
      as: "creator",
      attributes: ["id", "firstName", "lastName", "email"],
    },
    {
      model: Counterparty,
      as: "counterparty",
      attributes: ["id", "shortName", "fullName", "type", "status"],
      where: { companyId },
      required: false,
    },
    {
      model: Deal,
      as: "deal",
      attributes: ["id", "title", "status"],
      where: { companyId },
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
          where: { companyId },
          required: true,
        },
      ],
      required: false,
    },
    {
      model: Contact,
      as: "contacts",
      attributes: ["id", "firstName", "lastName", "displayName", "email", "phone"],
      through: { attributes: [] },
      where: { companyId },
      required: false,
    },
  ];
}

// pickAssigneeIds: выполняет вспомогательную бизнес-логику сервиса.
function pickAssigneeIds(payload) {
  const ids = Array.isArray(payload.assigneeIds)
    ? payload.assigneeIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}
// pickWatcherIds: выполняет вспомогательную бизнес-логику сервиса.
function pickWatcherIds(payload) {
  const ids = Array.isArray(payload.watcherIds)
    ? payload.watcherIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}
// pickDepartmentIds: выполняет вспомогательную бизнес-логику сервиса.
function pickDepartmentIds(payload) {
  const ids = Array.isArray(payload.departmentIds)
    ? payload.departmentIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}
// pickContactIds: выполняет вспомогательную бизнес-логику сервиса.
function pickContactIds(payload) {
  const ids = Array.isArray(payload.contactIds)
    ? payload.contactIds.filter(Boolean)
    : [];
  return [...new Set(ids)];
}

// expandAllUsersForCompany: выполняет вспомогательную бизнес-логику сервиса.
async function expandAllUsersForCompany(companyId) {
  const rows = await UserCompany.findAll({
    attributes: ["userId"],
    where: { companyId },
    raw: true,
  });
  return rows.map((r) => r.userId).filter(Boolean);
}

// ensureParticipants: выполняет вспомогательную бизнес-логику сервиса.
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

// ensureContacts: выполняет вспомогательную бизнес-логику сервиса.
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

// computeAggregatedStatus: выполняет вспомогательную бизнес-логику сервиса.
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

// recomputeTaskStatusIfNeeded: выполняет вспомогательную бизнес-логику сервиса.
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
    const order = parseListOrder(query);

    const count = await Task.count({
      where,
      distinct: true,
      col: "id",
    });

    const idRows = await Task.findAll({
      where,
      attributes: ["id"],
      order,
      limit,
      offset,
      raw: true,
    });

    const ids = idRows.map((row) => row.id).filter(Boolean);
    if (!ids.length) return { rows: [], count, page, limit };

    const rows = await Task.findAll({
      where: { companyId: cid, id: { [Op.in]: ids } },
      include: buildListIncludes(cid),
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const orderedRows = ids.map((id) => byId.get(id)).filter(Boolean);

    return { rows: orderedRows.map(toTaskDto), count, page, limit };
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
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new Error("Calendar from/to are invalid.");
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
        "plannedStartHasTime",
        "plannedEndHasTime",
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
        t.plannedStartHasTime === false &&
        t.plannedEndHasTime === false
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
          attributes: ["id", "shortName", "fullName", "type", "status"],
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
            "email",
            "phone",
            "counterpartyId",
          ],
          through: { attributes: [] },
          where: { companyId: cid },
          required: false,
        },
      ],
    });
    return toTaskDto(item);
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

    const plannedStart = resolveDatePair({
      payload,
      valueKeys: ["plannedStartAt", "startAt"],
      hasTimeKeys: ["plannedStartHasTime", "startAtHasTime"],
      existingValue: null,
      existingHasTime: true,
      label: "plannedStartAt",
    });
    const plannedEnd = resolveDatePair({
      payload,
      valueKeys: ["plannedEndAt", "endAt"],
      hasTimeKeys: ["plannedEndHasTime", "endAtHasTime"],
      existingValue: null,
      existingHasTime: true,
      label: "plannedEndAt",
    });
    const actualStart = resolveDatePair({
      payload,
      valueKeys: ["actualStartAt"],
      hasTimeKeys: ["actualStartHasTime"],
      existingValue: null,
      existingHasTime: true,
      label: "actualStartAt",
    });
    const actualEnd = resolveDatePair({
      payload,
      valueKeys: ["actualEndAt"],
      hasTimeKeys: ["actualEndHasTime"],
      existingValue: null,
      existingHasTime: true,
      label: "actualEndAt",
    });

    validateRange({
      startValue: plannedStart.value,
      endValue: plannedEnd.value,
      startHasTime: plannedStart.hasTime,
      endHasTime: plannedEnd.hasTime,
      startLabel: "plannedStartAt",
      endLabel: "plannedEndAt",
    });
    validateRange({
      startValue: actualStart.value,
      endValue: actualEnd.value,
      startHasTime: actualStart.hasTime,
      endHasTime: actualEnd.hasTime,
      startLabel: "actualStartAt",
      endLabel: "actualEndAt",
    });

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
      startAt: plannedStart.value || null,
      endAt: plannedEnd.value || null,
      actualStartAt: actualStart.value || null,
      actualEndAt: actualEnd.value || null,
      plannedStartHasTime: plannedStart.hasTime,
      plannedEndHasTime: plannedEnd.hasTime,
      actualStartHasTime: actualStart.hasTime,
      actualEndHasTime: actualEnd.hasTime,
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

    const plannedStart = resolveDatePair({
      payload,
      valueKeys: ["plannedStartAt", "startAt"],
      hasTimeKeys: ["plannedStartHasTime", "startAtHasTime"],
      existingValue: task.startAt,
      existingHasTime: task.plannedStartHasTime,
      label: "plannedStartAt",
    });
    const plannedEnd = resolveDatePair({
      payload,
      valueKeys: ["plannedEndAt", "endAt"],
      hasTimeKeys: ["plannedEndHasTime", "endAtHasTime"],
      existingValue: task.endAt,
      existingHasTime: task.plannedEndHasTime,
      label: "plannedEndAt",
    });
    const actualStart = resolveDatePair({
      payload,
      valueKeys: ["actualStartAt"],
      hasTimeKeys: ["actualStartHasTime"],
      existingValue: task.actualStartAt,
      existingHasTime: task.actualStartHasTime,
      label: "actualStartAt",
    });
    const actualEnd = resolveDatePair({
      payload,
      valueKeys: ["actualEndAt"],
      hasTimeKeys: ["actualEndHasTime"],
      existingValue: task.actualEndAt,
      existingHasTime: task.actualEndHasTime,
      label: "actualEndAt",
    });

    validateRange({
      startValue: plannedStart.value,
      endValue: plannedEnd.value,
      startHasTime: plannedStart.hasTime,
      endHasTime: plannedEnd.hasTime,
      startLabel: "plannedStartAt",
      endLabel: "plannedEndAt",
    });
    validateRange({
      startValue: actualStart.value,
      endValue: actualEnd.value,
      startHasTime: actualStart.hasTime,
      endHasTime: actualEnd.hasTime,
      startLabel: "actualStartAt",
      endLabel: "actualEndAt",
    });

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
    if (plannedStart.provided) next.startAt = plannedStart.value || null;
    if (plannedEnd.provided) next.endAt = plannedEnd.value || null;
    if (actualStart.provided) next.actualStartAt = actualStart.value || null;
    if (actualEnd.provided) next.actualEndAt = actualEnd.value || null;
    if (plannedStart.provided) next.plannedStartHasTime = plannedStart.hasTime;
    if (plannedEnd.provided) next.plannedEndHasTime = plannedEnd.hasTime;
    if (actualStart.provided) next.actualStartHasTime = actualStart.hasTime;
    if (actualEnd.provided) next.actualEndHasTime = actualEnd.hasTime;
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
