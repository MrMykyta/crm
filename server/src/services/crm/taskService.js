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
const SELF_MEMBER_STATUS_VALUES = ["todo", "in_progress", "done", "blocked"];
const VISIBILITY_VALUES = ["private", "company", "department"];
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;
const PRIORITY_DEFAULT = 50;
const LEGACY_PRIORITY_MAP = {
  low: 25,
  medium: 50,
  normal: 50,
  high: 75,
  urgent: 100,
  critical: 100,
};
const LEGACY_NUMERIC_PRIORITY_MAP = {
  1: 25,
  2: 50,
  3: 75,
  4: 75,
  5: 100,
};

function snapPriority(value) {
  if (value === null || value === undefined || value === "") return PRIORITY_DEFAULT;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return PRIORITY_DEFAULT;
  if (Object.prototype.hasOwnProperty.call(LEGACY_NUMERIC_PRIORITY_MAP, numeric)) {
    return LEGACY_NUMERIC_PRIORITY_MAP[numeric];
  }

  if (numeric <= 17) return 10;
  if (numeric <= 37) return 25;
  if (numeric <= 62) return 50;
  if (numeric <= 87) return 75;
  return 100;
}

function normalizePriority(value) {
  if (value === null || value === undefined || value === "") return PRIORITY_DEFAULT;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(LEGACY_PRIORITY_MAP, normalized)) {
      return LEGACY_PRIORITY_MAP[normalized];
    }
  }
  return snapPriority(value);
}

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

function participantThrough(user) {
  const raw = user?.TaskUserParticipant || user?.taskUserParticipant || {};
  return raw?.toJSON ? raw.toJSON() : raw;
}

function participantName(user) {
  const firstName = String(user?.firstName || "").trim();
  const lastName = String(user?.lastName || "").trim();
  return [firstName, lastName].filter(Boolean).join(" ") || user?.email || user?.id || "";
}

function aggregateAssigneeDto(user, meta, extraKeys = []) {
  const item = {
    id: user.id,
    name: participantName(user),
    email: user.email || null,
    memberStatus: meta.memberStatus || "todo",
  };

  for (const key of extraKeys) {
    if (meta[key]) item[key] = meta[key];
  }
  if (meta.statusNote) item.statusNote = meta.statusNote;

  return item;
}

function emptyAggregateSummary() {
  return {
    assigneesTotal: 0,
    assigneesDone: 0,
    assigneesPending: 0,
    assigneesBlocked: 0,
    progressPercent: 0,
    pendingAssignees: [],
    completedAssignees: [],
    blockedAssignees: [],
  };
}

function buildTaskAggregateSummary(taskOrParticipants) {
  const participants = Array.isArray(taskOrParticipants)
    ? taskOrParticipants
    : taskOrParticipants?.userParticipants || [];

  const summary = emptyAggregateSummary();
  for (const user of participants) {
    const meta = participantThrough(user);
    if (meta.role !== "assignee") continue;

    summary.assigneesTotal += 1;
    const status = meta.memberStatus || "todo";
    if (status === "done") {
      summary.assigneesDone += 1;
      summary.completedAssignees.push(
        aggregateAssigneeDto(user, meta, ["completedAt", "completedById"])
      );
    } else if (status === "blocked") {
      summary.assigneesBlocked += 1;
      summary.blockedAssignees.push(
        aggregateAssigneeDto(user, meta, ["startedAt"])
      );
    } else {
      summary.assigneesPending += 1;
      summary.pendingAssignees.push(
        aggregateAssigneeDto(user, meta, ["startedAt"])
      );
    }
  }

  summary.progressPercent = summary.assigneesTotal
    ? Math.round((summary.assigneesDone / summary.assigneesTotal) * 100)
    : 0;

  return summary;
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
    priority: normalizePriority(row.priority),
    plannedStartAt,
    plannedEndAt,
    actualStartAt,
    actualEndAt,
    plannedStartHasTime,
    plannedEndHasTime,
    actualStartHasTime,
    actualEndHasTime,
    aggregateSummary: buildTaskAggregateSummary(row),
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

function normalizeVisibility(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return VISIBILITY_VALUES.includes(normalized) ? normalized : null;
}

function pushWhereAnd(where, condition) {
  if (!condition) return where;
  const existing = where[Op.and];
  if (Array.isArray(existing)) {
    where[Op.and] = [...existing, condition];
  } else if (existing) {
    where[Op.and] = [existing, condition];
  } else {
    where[Op.and] = [condition];
  }
  return where;
}

function isOwnerOrAdminRole(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "owner" || normalized === "admin";
}

async function resolveTaskAccessContext({ companyId, user }) {
  const userId = user?.id || user?.userId || null;
  if (!userId) {
    const err = new Error("User context is required");
    err.status = 401;
    throw err;
  }

  const membership = await UserCompany.findOne({
    where: { companyId, userId },
    attributes: ["userId", "companyId", "role", "departmentId", "status"],
    raw: true,
  });

  if (!membership) {
    const err = new Error("Forbidden");
    err.status = 403;
    throw err;
  }

  return {
    userId,
    role: membership.role || user?.role || null,
    departmentId: membership.departmentId || null,
    bypassVisibility: isOwnerOrAdminRole(membership.role || user?.role),
  };
}

function buildTaskVisibilityLiteral({ companyId, access, taskAlias = '"Task"' }) {
  if (access?.bypassVisibility) return null;

  const escapedCompanyId = Task.sequelize.escape(companyId);
  const escapedUserId = Task.sequelize.escape(access.userId);
  const escapedDepartmentId = access.departmentId
    ? Task.sequelize.escape(access.departmentId)
    : null;

  const departmentSql = escapedDepartmentId
    ? `(
        ${taskAlias}.visibility = 'department'
        AND ${taskAlias}.visibility_department_id = ${escapedDepartmentId}
        AND EXISTS (
          SELECT 1
          FROM company_departments cd
          WHERE cd.id = ${taskAlias}.visibility_department_id
            AND cd.company_id = ${escapedCompanyId}
            AND cd.is_active = true
            AND cd.deleted_at IS NULL
        )
      )`
    : "FALSE";

  return Task.sequelize.literal(`(
    ${taskAlias}.created_by = ${escapedUserId}
    OR ${taskAlias}.visibility = 'company'
    OR ${departmentSql}
    OR EXISTS (
      SELECT 1
      FROM task_user_participants tup
      WHERE tup.task_id = ${taskAlias}.id
        AND tup.user_id = ${escapedUserId}
    )
  )`);
}

async function buildTaskVisibilityWhere({ companyId, user }) {
  const access = await resolveTaskAccessContext({ companyId, user });
  return {
    access,
    condition: buildTaskVisibilityLiteral({ companyId, access }),
  };
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

async function assertVisibilityDepartmentInCompany(departmentId, companyId) {
  if (!departmentId) {
    const err = new Error("visibilityDepartmentId is required");
    err.status = 400;
    throw err;
  }
  const row = await CompanyDepartment.findOne({
    where: { id: departmentId, companyId, isActive: true },
    attributes: ["id"],
  });
  if (!row) {
    const err = new Error("visibilityDepartmentId is invalid");
    err.status = 400;
    throw err;
  }
}

async function resolveVisibilityPatch(payload, companyId, existing = null) {
  const hasVisibility = Object.prototype.hasOwnProperty.call(payload, "visibility");
  const hasDepartment = Object.prototype.hasOwnProperty.call(payload, "visibilityDepartmentId");
  const currentVisibility = existing?.visibility || "company";
  const visibility = hasVisibility
    ? (normalizeVisibility(payload.visibility) || "company")
    : currentVisibility;

  if (visibility === "department") {
    const visibilityDepartmentId = hasDepartment
      ? (payload.visibilityDepartmentId || null)
      : (existing?.visibilityDepartmentId || null);
    await assertVisibilityDepartmentInCompany(visibilityDepartmentId, companyId);
    return { visibility, visibilityDepartmentId };
  }

  return { visibility, visibilityDepartmentId: null };
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
  const visibility = normalizeVisibility(query.visibility);
  if (visibility) where.visibility = visibility;
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
      through: {
        attributes: [
          "role",
          "memberStatus",
          "startedAt",
          "completedAt",
          "completedById",
          "statusNote",
        ],
      },
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

// recomputeTaskStatusIfNeeded: выполняет вспомогательную бизнес-логику сервиса.
async function recomputeTaskStatusIfNeeded({ taskId, companyId, actorId = null }) {
  requireCompanyId(companyId);
  const task = await Task.findOne({
    where: { id: taskId, companyId },
    attributes: ["id", "status", "statusAggregate", "completedAt", "completedById"],
  });
  if (!task) return;

  if (!task.statusAggregate) return;
  if (["blocked", "canceled"].includes(task.status)) return;

  const members = await TaskUserParticipant.findAll({
    attributes: ["memberStatus"],
    where: { taskId, role: "assignee" },
    raw: true,
  });
  const memberStatuses = members.map((m) => m.memberStatus);
  if (!memberStatuses.length) return;

  const allDone = memberStatuses.every((status) => status === "done");
  if (allDone) {
    if (task.status !== "done") task.status = "done";
    if (!task.completedAt) task.completedAt = new Date();
    if (!task.completedById) task.completedById = actorId || null;
    await task.save();
    return;
  }

  if (task.status === "done") {
    task.status = "in_progress";
    task.completedAt = null;
    task.completedById = null;
    await task.save();
  }
}

function buildMemberStatusPatch(participant, nextStatus, actorId = null) {
  const now = new Date();
  const previousStatus = participant?.memberStatus || "todo";
  const patch = { memberStatus: nextStatus };
  const hasStarted = !!participant?.startedAt;
  const wasDone = previousStatus === "done";

  if (nextStatus === "todo") {
    if (wasDone) {
      patch.completedAt = null;
      patch.completedById = null;
    }
    return patch;
  }

  if (nextStatus === "in_progress") {
    if (!hasStarted) patch.startedAt = now;
    if (wasDone) {
      patch.completedAt = null;
      patch.completedById = null;
    }
    return patch;
  }

  if (nextStatus === "done") {
    if (!hasStarted) patch.startedAt = now;
    if (!participant?.completedAt) patch.completedAt = now;
    if (actorId) patch.completedById = actorId;
    return patch;
  }

  if (nextStatus === "blocked") {
    if (!hasStarted) patch.startedAt = now;
    patch.completedAt = null;
    patch.completedById = null;
    return patch;
  }

  if (nextStatus === "canceled") {
    if (!hasStarted) patch.startedAt = now;
    patch.completedAt = null;
    patch.completedById = null;
  }

  return patch;
}

module.exports = {
  // ---------- LIST ----------
  async list({ query, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const { page, limit, offset } = parsePagination(query);
    if (query.counterpartyId)
      await assertCounterpartyInCompany(query.counterpartyId, cid);
    if (query.dealId) await assertDealInCompany(query.dealId, cid);
    const where = buildListWhere({ companyId: cid, query });
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);
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
  async listCalendar({ query, companyId, user }) {
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
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);

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
        "visibility",
        "visibilityDepartmentId",
      ],
      include: [
        {
          model: User,
          as: "userParticipants",
          attributes: ["id", "firstName", "lastName", "email"],
          through: {
            attributes: [
              "role",
              "memberStatus",
              "startedAt",
              "completedAt",
              "completedById",
              "statusNote",
            ],
          },
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
        priority: normalizePriority(t.priority),
        category: t.category,
        timezone: t.timezone || null,
        aggregateSummary: buildTaskAggregateSummary(t),
      };
    });

    return data;
  },

  // ---------- GET ----------
  async getById({ id, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const where = { id, companyId: cid };
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);
    const item = await Task.findOne({
      where,
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
          through: {
            attributes: [
              "role",
              "memberStatus",
              "startedAt",
              "completedAt",
              "completedById",
              "statusNote",
            ],
          },
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
    const visibilityPatch = await resolveVisibilityPatch(payload, cid);

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
      priority: normalizePriority(payload.priority),
      visibility: visibilityPatch.visibility,
      visibilityDepartmentId: visibilityPatch.visibilityDepartmentId,
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

    await recomputeTaskStatusIfNeeded({ taskId: task.id, companyId: cid, actorId: createdBy });

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

    return await this.getById({ id: task.id, companyId: cid, user });
  },

  // ---------- UPDATE ----------
  async update({ id, payload, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const where = { id, companyId: cid };
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);
    const task = await Task.findOne({ where });
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
    const visibilityPatch =
      payload.visibility !== undefined || payload.visibilityDepartmentId !== undefined
        ? await resolveVisibilityPatch(payload, cid, task)
        : null;

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
      next.priority = normalizePriority(payload.priority);
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
    if (visibilityPatch) {
      next.visibility = visibilityPatch.visibility;
      next.visibilityDepartmentId = visibilityPatch.visibilityDepartmentId;
    }

    const actorId = user?.id || null;
    if (payload.status && STATUS_VALUES.includes(payload.status)) {
      next.status = payload.status;
      if (payload.status === "done") {
        next.completedAt = task.completedAt || new Date();
        next.completedById = actorId || task.completedById || null;
      } else if (task.status === "done") {
        next.completedAt = null;
        next.completedById = null;
      }
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
        const participant = await TaskUserParticipant.findOne({
          where: { taskId: task.id, userId: m.userId, role: "assignee" },
        });
        if (!participant) continue;
        await participant.update(buildMemberStatusPatch(participant, m.memberStatus, actorId));
      }
    }

    // если флаг агрегирования включён — пересчитать общий статус
    await recomputeTaskStatusIfNeeded({ taskId: task.id, companyId: cid, actorId });

    try {
      const updated = await this.getById({ id: task.id, companyId: cid, user });

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
      return await this.getById({ id: task.id, companyId: cid, user });
    }
  },

  async updateMyMemberStatus({ taskId, companyId, userId, memberStatus, note }) {
    const cid = requireCompanyId(companyId);
    if (!userId) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
    if (!SELF_MEMBER_STATUS_VALUES.includes(memberStatus)) {
      const err = new Error("memberStatus is invalid");
      err.status = 400;
      throw err;
    }

    const user = { id: userId, companyId: cid };
    const where = { id: taskId, companyId: cid };
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);

    const task = await Task.findOne({
      where,
      attributes: ["id", "companyId"],
    });
    if (!task) {
      const err = new Error("Task not found");
      err.status = 404;
      throw err;
    }

    const participant = await TaskUserParticipant.findOne({
      where: { taskId: task.id, userId, role: "assignee" },
    });
    if (!participant) {
      const err = new Error("Only task assignees can update their own task status");
      err.status = 403;
      throw err;
    }

    const patch = buildMemberStatusPatch(participant, memberStatus, userId);
    if (note !== undefined) patch.statusNote = note ? String(note).trim() : null;
    await participant.update(patch);

    await recomputeTaskStatusIfNeeded({ taskId: task.id, companyId: cid, actorId: userId });

    // TODO(AGG): record participant status activity/notifications in the timeline phase.
    const updatedTask = await this.getById({ id: task.id, companyId: cid, user });
    const updatedParticipant = await TaskUserParticipant.findOne({
      where: { taskId: task.id, userId, role: "assignee" },
      raw: true,
    });

    return {
      task: updatedTask,
      participant: updatedParticipant
        ? {
            taskId: updatedParticipant.taskId,
            userId: updatedParticipant.userId,
            role: updatedParticipant.role,
            memberStatus: updatedParticipant.memberStatus,
            startedAt: updatedParticipant.startedAt,
            completedAt: updatedParticipant.completedAt,
            completedById: updatedParticipant.completedById,
            statusNote: updatedParticipant.statusNote,
          }
        : null,
    };
  },

  async updateParticipantMemberStatus({
    taskId,
    targetUserId,
    companyId,
    actorUserId,
    memberStatus,
    note,
  }) {
    const cid = requireCompanyId(companyId);
    if (!actorUserId) {
      const err = new Error("Unauthorized");
      err.status = 401;
      throw err;
    }
    if (!targetUserId) {
      const err = new Error("targetUserId is required");
      err.status = 400;
      throw err;
    }
    if (!MEMBER_STATUS_VALUES.includes(memberStatus)) {
      const err = new Error("memberStatus is invalid");
      err.status = 400;
      throw err;
    }

    await assertMemberIdsInCompany([targetUserId], cid, "targetUserId");

    const actor = { id: actorUserId, companyId: cid };
    const where = { id: taskId, companyId: cid };
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user: actor,
    });
    pushWhereAnd(where, visibilityCondition);

    const task = await Task.findOne({
      where,
      attributes: ["id", "companyId"],
    });
    if (!task) {
      const err = new Error("Task not found");
      err.status = 404;
      throw err;
    }

    const participant = await TaskUserParticipant.findOne({
      where: { taskId: task.id, userId: targetUserId, role: "assignee" },
    });
    if (!participant) {
      const err = new Error("Target user is not an assignee of this task");
      err.status = 403;
      throw err;
    }

    const patch = buildMemberStatusPatch(participant, memberStatus, actorUserId);
    if (note !== undefined) patch.statusNote = note ? String(note).trim() : null;
    await participant.update(patch);

    await recomputeTaskStatusIfNeeded({ taskId: task.id, companyId: cid, actorId: actorUserId });

    // TODO(AGG): record manager participant status activity/notifications in the timeline phase.
    const updatedTask = await this.getById({ id: task.id, companyId: cid, user: actor });
    const updatedParticipant = await TaskUserParticipant.findOne({
      where: { taskId: task.id, userId: targetUserId, role: "assignee" },
      raw: true,
    });

    return {
      task: updatedTask,
      participant: updatedParticipant
        ? {
            taskId: updatedParticipant.taskId,
            userId: updatedParticipant.userId,
            role: updatedParticipant.role,
            memberStatus: updatedParticipant.memberStatus,
            startedAt: updatedParticipant.startedAt,
            completedAt: updatedParticipant.completedAt,
            completedById: updatedParticipant.completedById,
            statusNote: updatedParticipant.statusNote,
          }
        : null,
    };
  },

  // ---------- REMOVE (soft) ----------
  async remove({ id, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const where = { id, companyId: cid };
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);
    const task = await Task.findOne({ where });
    if (!task) throw new Error("Task not found");
    await task.destroy();
  },

  // ---------- RESTORE ----------
  async restore({ id, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const where = { id, companyId: cid };
    const { condition: visibilityCondition } = await buildTaskVisibilityWhere({
      companyId: cid,
      user,
    });
    pushWhereAnd(where, visibilityCondition);
    const task = await Task.findOne({ where, paranoid: false });
    if (!task) throw new Error("Task not found");
    await Task.restore({ where: { id, companyId: cid } });
    return await this.getById({ id, companyId: cid, user });
  },
};
