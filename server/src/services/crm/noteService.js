'use strict';

const { Op, literal, QueryTypes } = require('sequelize');
const {
  Note,
  User,
  UserCompany,
  Company,
  CompanyDepartment,
  Counterparty,
  Deal,
  Task,
  TaskUserParticipant,
  TaskDepartmentParticipant,
  Contact,
  Offer,
  Order,
  Product,
} = require('../../models');
const { parsePagination } = require('../../utils/pagination');

const OWNER_TYPES = [
  'counterparty',
  'deal',
  'task',
  'order',
  'offer',
  'product',
  'contact',
  'user',
  'company',
  'department',
];

const SORT_MAP = {
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  pinned: 'pinned',
};

const AUTHOR_INCLUDE = [
  {
    model: User,
    as: 'author',
    attributes: ['id', 'firstName', 'lastName', 'email'],
  },
];

// requireCompanyId: выполняет вспомогательную бизнес-логику сервиса.
function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  return companyId;
}

// parseBoolean: парсит и нормализует входные параметры.
function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1') return true;
    if (v === 'false' || v === '0') return false;
  }
  return undefined;
}

// normalizeSort: приводит значения к единому формату для сервиса.
function normalizeSort(value) {
  return SORT_MAP[String(value || '').trim()] || 'createdAt';
}

// normalizeDir: приводит значения к единому формату для сервиса.
function normalizeDir(value) {
  return String(value || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
}

// normalizeVisibility: приводит значения к единому формату для сервиса.
function normalizeVisibility(value) {
  if (!value) return undefined;
  const v = String(value).trim();
  if (v === 'private' || v === 'company' || v === 'department') return v;
  return undefined;
}

// normalizeOwnerType: приводит значения к единому формату для сервиса.
function normalizeOwnerType(value) {
  if (!value) return undefined;
  const v = String(value).trim();
  return OWNER_TYPES.includes(v) ? v : undefined;
}

// normalizeSearch: приводит значения к единому формату для сервиса.
function normalizeSearch(query = {}) {
  const search = String(query.search ?? query.q ?? '').trim();
  return search || null;
}

// parseListMeta: парсит и нормализует входные параметры.
function parseListMeta(query = {}) {
  const parsed = parsePagination(query, {
    sortWhitelist: Object.keys(SORT_MAP),
    defaultSort: 'createdAt',
    defaultDir: 'DESC',
    defaultLimit: 20,
    maxLimit: 200,
  });

  return {
    page: parsed.page,
    limit: parsed.limit,
    offset: parsed.offset,
    sort: normalizeSort(query.sort || parsed.sort),
    dir: normalizeDir(query.dir || parsed.dir),
    search: normalizeSearch(query),
  };
}

// normalizeLookupLimit: приводит значения к единому формату для сервиса.
function normalizeLookupLimit(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 20;
  return Math.min(50, Math.max(1, Math.trunc(n)));
}

// normalizeLookupSearch: приводит значения к единому формату для сервиса.
function normalizeLookupSearch(value) {
  return String(value || '').trim();
}

// formatUserName: собирает имя пользователя для отображения в UI.
function formatUserName(user = {}) {
  const full = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return full || user.email || null;
}

// shortId: выполняет вспомогательную бизнес-логику сервиса.
function shortId(value) {
  return String(value || '').slice(0, 8);
}

// ownerKey: выполняет вспомогательную бизнес-логику сервиса.
function ownerKey(ownerType, ownerId) {
  return `${String(ownerType || '')}:${String(ownerId || '')}`;
}

// ownerTypeLabel: выполняет вспомогательную бизнес-логику сервиса.
function ownerTypeLabel(ownerType) {
  const source = String(ownerType || 'entity');
  return source.charAt(0).toUpperCase() + source.slice(1).replace(/_/g, ' ');
}

// fallbackOwnerLabel: выполняет вспомогательную бизнес-логику сервиса.
function fallbackOwnerLabel(ownerType, ownerId) {
  return `${ownerTypeLabel(ownerType)} #${shortId(ownerId)}`;
}

// putOwnerMeta: выполняет вспомогательную бизнес-логику сервиса.
function putOwnerMeta(map, ownerType, ownerId, label, subtitle = null) {
  if (!ownerId) return;
  map.set(ownerKey(ownerType, ownerId), {
    label: String(label || fallbackOwnerLabel(ownerType, ownerId)),
    subtitle: subtitle ? String(subtitle) : null,
  });
}

// getOwnerGroups: возвращает данные по входным параметрам сервиса.
function getOwnerGroups(notes = []) {
  const groups = new Map();
  notes.forEach((note) => {
    const ownerType = note?.ownerType;
    const ownerId = note?.ownerId;
    if (!ownerType || !ownerId) return;
    if (!groups.has(ownerType)) groups.set(ownerType, new Set());
    groups.get(ownerType).add(String(ownerId));
  });
  return groups;
}

// buildOwnerMetaMap: собирает служебную структуру для выполнения запроса.
async function buildOwnerMetaMap({ companyId, notes = [] }) {
  const groups = getOwnerGroups(notes);
  const map = new Map();
    // takeIds: выполняет вспомогательную бизнес-логику сервиса.
const takeIds = (type) => Array.from(groups.get(type) || []);

  const counterpartyIds = takeIds('counterparty');
  if (counterpartyIds.length) {
    const rows = await Counterparty.findAll({
      where: { companyId, id: { [Op.in]: counterpartyIds } },
      attributes: ['id', 'shortName', 'fullName', 'nip', 'city'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'counterparty',
        row.id,
        row.shortName || row.fullName || fallbackOwnerLabel('counterparty', row.id),
        [row.nip, row.city].filter(Boolean).join(' • ') || null
      );
    });
  }

  const dealIds = takeIds('deal');
  if (dealIds.length) {
    const rows = await Deal.findAll({
      where: { companyId, id: { [Op.in]: dealIds } },
      attributes: ['id', 'title', 'status'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'deal',
        row.id,
        row.title || fallbackOwnerLabel('deal', row.id),
        row.status || null
      );
    });
  }

  const taskIds = takeIds('task');
  if (taskIds.length) {
    const rows = await Task.findAll({
      where: { companyId, id: { [Op.in]: taskIds } },
      attributes: ['id', 'title', 'status'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'task',
        row.id,
        row.title || fallbackOwnerLabel('task', row.id),
        row.status || null
      );
    });
  }

  const contactIds = takeIds('contact');
  if (contactIds.length) {
    const rows = await Contact.findAll({
      where: { companyId, id: { [Op.in]: contactIds } },
      attributes: ['id', 'displayName', 'firstName', 'lastName', 'jobTitle'],
    });
    rows.forEach((row) => {
      const full = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
      putOwnerMeta(
        map,
        'contact',
        row.id,
        row.displayName || full || fallbackOwnerLabel('contact', row.id),
        row.jobTitle || null
      );
    });
  }

  const companyIds = takeIds('company');
  if (companyIds.length) {
    const rows = await Company.findAll({
      where: { id: { [Op.in]: companyIds } },
      attributes: ['id', 'name', 'city'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'company',
        row.id,
        row.name || fallbackOwnerLabel('company', row.id),
        row.city || null
      );
    });
  }

  const departmentIds = takeIds('department');
  if (departmentIds.length) {
    const rows = await CompanyDepartment.findAll({
      where: { companyId, id: { [Op.in]: departmentIds } },
      attributes: ['id', 'name'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'department',
        row.id,
        row.name || fallbackOwnerLabel('department', row.id),
        null
      );
    });
  }

  const userIds = takeIds('user');
  if (userIds.length) {
    const rows = await User.findAll({
      where: { id: { [Op.in]: userIds } },
      attributes: ['id', 'firstName', 'lastName', 'email'],
      include: [
        {
          model: UserCompany,
          as: 'memberships',
          required: true,
          attributes: [],
          where: { companyId, status: 'active' },
        },
      ],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'user',
        row.id,
        formatUserName(row) || fallbackOwnerLabel('user', row.id),
        row.email || null
      );
    });
  }

  const orderIds = takeIds('order');
  if (orderIds.length) {
    const rows = await Order.findAll({
      where: { companyId, id: { [Op.in]: orderIds } },
      attributes: ['id', 'status'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'order',
        row.id,
        `Order #${shortId(row.id)}`,
        row.status || null
      );
    });
  }

  const offerIds = takeIds('offer');
  if (offerIds.length) {
    const rows = await Offer.findAll({
      where: { companyId, id: { [Op.in]: offerIds } },
      attributes: ['id', 'status'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'offer',
        row.id,
        `Offer #${shortId(row.id)}`,
        row.status || null
      );
    });
  }

  const productIds = takeIds('product');
  if (productIds.length) {
    const rows = await Product.findAll({
      where: { companyId, id: { [Op.in]: productIds } },
      attributes: ['id', 'name', 'sku'],
    });
    rows.forEach((row) => {
      putOwnerMeta(
        map,
        'product',
        row.id,
        row.name || row.sku || fallbackOwnerLabel('product', row.id),
        row.sku || null
      );
    });
  }

  return map;
}

// attachOwnerMetaToNote: выполняет вспомогательную бизнес-логику сервиса.
function attachOwnerMetaToNote(note, ownerMetaMap) {
  if (!note) return note;
  const ownerType = note?.ownerType;
  const ownerId = note?.ownerId;
  const info = ownerMetaMap.get(ownerKey(ownerType, ownerId));
  const label = info?.label || fallbackOwnerLabel(ownerType, ownerId);
  const subtitle = info?.subtitle || null;

  if (typeof note.setDataValue === 'function') {
    note.setDataValue('ownerLabel', label);
    note.setDataValue('ownerSubtitle', subtitle);
  } else {
    note.ownerLabel = label;
    note.ownerSubtitle = subtitle;
  }
  return note;
}

// enrichNotesWithOwnerMeta: выполняет вспомогательную бизнес-логику сервиса.
async function enrichNotesWithOwnerMeta({ companyId, notes = [] }) {
  if (!Array.isArray(notes) || notes.length === 0) return notes;
  const ownerMetaMap = await buildOwnerMetaMap({ companyId, notes });
  notes.forEach((note) => attachOwnerMetaToNote(note, ownerMetaMap));
  return notes;
}

// enrichSingleNoteWithOwnerMeta: выполняет вспомогательную бизнес-логику сервиса.
async function enrichSingleNoteWithOwnerMeta({ companyId, note }) {
  if (!note) return note;
  await enrichNotesWithOwnerMeta({ companyId, notes: [note] });
  return note;
}

// buildRelatedEntityAccessSql: собирает служебную структуру для выполнения запроса.
function buildRelatedEntityAccessSql(noteAlias, escapedCompanyId, escapedUserId) {
  const n = noteAlias;
  const cid = escapedCompanyId;
  const uid = escapedUserId;

  return `(
    (${n}.owner_type = 'deal' AND EXISTS (
      SELECT 1
      FROM deals d
      WHERE d.id = ${n}.owner_id
        AND d.company_id = ${cid}
        AND (d.responsible_id = ${uid} OR d.created_by = ${uid})
    ))
    OR
    (${n}.owner_type = 'task' AND EXISTS (
      SELECT 1
      FROM tasks t
      WHERE t.id = ${n}.owner_id
        AND t.company_id = ${cid}
        AND t.deleted_at IS NULL
        AND (
          t.created_by = ${uid}
          OR EXISTS (
            SELECT 1 FROM task_user_participants tup
            WHERE tup.task_id = t.id
              AND tup.user_id = ${uid}
          )
          OR EXISTS (
            SELECT 1
            FROM task_department_participants tdp
            JOIN user_companies uc ON uc.department_id = tdp.department_id
            WHERE tdp.task_id = t.id
              AND uc.user_id = ${uid}
              AND uc.company_id = ${cid}
              AND uc.status = 'active'
              AND uc.deleted_at IS NULL
          )
        )
    ))
    OR
    (${n}.owner_type = 'counterparty' AND EXISTS (
      SELECT 1
      FROM counterparties cp
      WHERE cp.id = ${n}.owner_id
        AND cp.company_id = ${cid}
        AND (cp.main_responsible_user_id = ${uid} OR cp.created_by = ${uid})
    ))
    OR
    (${n}.owner_type = 'contact' AND EXISTS (
      SELECT 1
      FROM contacts ct
      WHERE ct.id = ${n}.owner_id
        AND ct.company_id = ${cid}
        AND ct.deleted_at IS NULL
        AND (ct.main_responsible_user_id = ${uid} OR ct.created_by = ${uid})
    ))
    OR
    (${n}.owner_type = 'user' AND ${n}.owner_id = ${uid})
    OR
    (${n}.owner_type = 'company' AND EXISTS (
      SELECT 1
      FROM companies c
      WHERE c.id = ${n}.owner_id
        AND c.id = ${cid}
        AND (
          c.owner_user_id = ${uid}
          OR EXISTS (
            SELECT 1
            FROM user_companies uc
            WHERE uc.company_id = c.id
              AND uc.user_id = ${uid}
              AND uc.status = 'active'
              AND uc.deleted_at IS NULL
          )
        )
    ))
    OR
    (${n}.owner_type = 'department' AND EXISTS (
      SELECT 1
      FROM company_departments cd
      JOIN user_companies uc ON uc.department_id = cd.id
      WHERE cd.id = ${n}.owner_id
        AND cd.company_id = ${cid}
        AND uc.user_id = ${uid}
        AND uc.company_id = ${cid}
        AND uc.status = 'active'
        AND uc.deleted_at IS NULL
    ))
  )`;
}

// buildCompanyVisibilityAccessSql: собирает служебную структуру для выполнения запроса.
function buildCompanyVisibilityAccessSql(noteAlias, escapedCompanyId, escapedUserId) {
  const n = noteAlias;
  const cid = escapedCompanyId;
  const uid = escapedUserId;
    // softDeleteIsNull: выполняет вспомогательную бизнес-логику сервиса.
const softDeleteIsNull = (alias) =>
    `(COALESCE(to_jsonb(${alias}) ->> 'deleted_at', to_jsonb(${alias}) ->> 'deletedAt') IS NULL)`;

  return `(
    (${n}.owner_type = 'company' AND EXISTS (
      SELECT 1
      FROM user_companies uc
      WHERE uc.company_id = ${cid}
        AND uc.user_id = ${uid}
        AND uc.status = 'active'
        AND uc.deleted_at IS NULL
    ))
    OR
    (${n}.owner_type = 'order' AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id = ${n}.owner_id
        AND o.company_id = ${cid}
        AND ${softDeleteIsNull('o')}
    ))
    OR
    (${n}.owner_type = 'offer' AND EXISTS (
      SELECT 1
      FROM offers o
      WHERE o.id = ${n}.owner_id
        AND o.company_id = ${cid}
        AND ${softDeleteIsNull('o')}
    ))
    OR
    (${n}.owner_type = 'product' AND EXISTS (
      SELECT 1
      FROM products p
      WHERE p.id = ${n}.owner_id
        AND p.company_id = ${cid}
    ))
    OR
    ${buildRelatedEntityAccessSql(noteAlias, escapedCompanyId, escapedUserId)}
  )`;
}

// buildDepartmentVisibilityAccessSql: limits department visibility by user's active department and owner access.
function buildDepartmentVisibilityAccessSql(noteAlias, escapedCompanyId, escapedUserId) {
  const n = noteAlias;
  const cid = escapedCompanyId;
  const uid = escapedUserId;
  const companySql = buildCompanyVisibilityAccessSql(noteAlias, escapedCompanyId, escapedUserId);

  return `(
    ${n}.visibility = 'department'
    AND ${n}.visibility_department_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM user_companies uc
      JOIN company_departments cd ON cd.id = uc.department_id
      WHERE uc.user_id = ${uid}
        AND uc.company_id = ${cid}
        AND uc.status = 'active'
        AND uc.deleted_at IS NULL
        AND cd.company_id = ${cid}
        AND cd.is_active = true
        AND cd.deleted_at IS NULL
        AND uc.department_id = ${n}.visibility_department_id
    )
    AND ${companySql}
  )`;
}

// buildNoteAccessLiteral: собирает служебную структуру для выполнения запроса.
function buildNoteAccessLiteral({ companyId, userId, noteAlias = '"Note"' }) {
  const escapedCompanyId = Note.sequelize.escape(companyId);
  const escapedUserId = Note.sequelize.escape(userId);
  const companySql = buildCompanyVisibilityAccessSql(noteAlias, escapedCompanyId, escapedUserId);
  const departmentSql = buildDepartmentVisibilityAccessSql(noteAlias, escapedCompanyId, escapedUserId);

  return literal(`(
    ${noteAlias}.created_by = ${escapedUserId}
    OR (${noteAlias}.visibility = 'company' AND ${companySql})
    OR ${departmentSql}
  )`);
}

// canManageForeignNote: проверяет право управлять чужой заметкой.
function canManageForeignNote(user = {}, action = 'update') {
  const role = String(user.role || '').toLowerCase();
  if (role === 'owner' || role === 'admin') return true;

  const allow = new Set(Array.isArray(user.permissions?.allow) ? user.permissions.allow : []);
  if (action === 'update') {
    return allow.has('note:update:any') || allow.has('note:manage:any');
  }
  return allow.has('note:delete:any') || allow.has('note:manage:any');
}

// assertOwnerInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertOwnerInCompany({ companyId, ownerType, ownerId }) {
  let row = null;

  switch (ownerType) {
    case 'counterparty':
      row = await Counterparty.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'deal':
      row = await Deal.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'task':
      row = await Task.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'contact':
      row = await Contact.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'order':
      row = await Order.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'offer':
      row = await Offer.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'product':
      row = await Product.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'company':
      row = await Company.findOne({ where: { id: ownerId }, attributes: ['id'] });
      if (row && String(row.id) !== String(companyId)) {
        row = null;
      }
      break;
    case 'department':
      row = await CompanyDepartment.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      break;
    case 'user':
      row = await UserCompany.findOne({
        where: { userId: ownerId, companyId, status: 'active' },
        attributes: ['id'],
      });
      break;
    default:
      row = null;
      break;
  }

  if (!row) {
    const err = new Error('ownerId is invalid for this ownerType');
    err.status = 400;
    throw err;
  }
}

async function assertVisibilityDepartmentInCompany({ companyId, departmentId }) {
  if (!departmentId) {
    const err = new Error('visibilityDepartmentId is required');
    err.status = 400;
    throw err;
  }

  const row = await CompanyDepartment.findOne({
    where: {
      id: departmentId,
      companyId,
      isActive: true,
    },
    attributes: ['id'],
  });

  if (!row) {
    const err = new Error('visibilityDepartmentId is invalid');
    err.status = 400;
    throw err;
  }
}

async function resolveVisibilityPatch({ companyId, payload = {}, existing = null }) {
  const hasVisibility = Object.prototype.hasOwnProperty.call(payload, 'visibility');
  const hasDepartment = Object.prototype.hasOwnProperty.call(payload, 'visibilityDepartmentId');
  const visibility = hasVisibility
    ? (normalizeVisibility(payload.visibility) || 'company')
    : (existing?.visibility || 'company');

  if (visibility === 'department') {
    const visibilityDepartmentId = hasDepartment
      ? (payload.visibilityDepartmentId || null)
      : (existing?.visibilityDepartmentId || null);
    await assertVisibilityDepartmentInCompany({ companyId, departmentId: visibilityDepartmentId });
    return { visibility, visibilityDepartmentId };
  }

  return { visibility, visibilityDepartmentId: null };
}

// hasRelatedEntityAccess: проверяет наличие данных и возвращает результат проверки.
async function hasRelatedEntityAccess({ companyId, userId, ownerType, ownerId }) {
  switch (ownerType) {
    case 'deal': {
      const row = await Deal.findOne({
        where: {
          id: ownerId,
          companyId,
          [Op.or]: [{ responsibleId: userId }, { createdBy: userId }],
        },
        attributes: ['id'],
      });
      return Boolean(row);
    }

    case 'task': {
      const task = await Task.findOne({ where: { id: ownerId, companyId }, attributes: ['id', 'createdBy'] });
      if (!task) return false;
      if (String(task.createdBy) === String(userId)) return true;

      const inUsers = await TaskUserParticipant.findOne({
        where: { taskId: ownerId, userId },
        attributes: ['id'],
      });
      if (inUsers) return true;

      const membership = await UserCompany.findOne({
        where: { userId, companyId, status: 'active' },
        attributes: ['departmentId'],
      });
      if (!membership?.departmentId) return false;

      const inDepartment = await TaskDepartmentParticipant.findOne({
        where: { taskId: ownerId, departmentId: membership.departmentId },
        attributes: ['id'],
      });
      return Boolean(inDepartment);
    }

    case 'counterparty': {
      const row = await Counterparty.findOne({
        where: {
          id: ownerId,
          companyId,
          [Op.or]: [{ mainResponsibleUserId: userId }, { createdBy: userId }],
        },
        attributes: ['id'],
      });
      return Boolean(row);
    }

    case 'contact': {
      const row = await Contact.findOne({
        where: {
          id: ownerId,
          companyId,
          [Op.or]: [{ mainResponsibleUserId: userId }, { createdBy: userId }],
        },
        attributes: ['id'],
      });
      return Boolean(row);
    }

    case 'company': {
      const row = await Company.findOne({ where: { id: ownerId, ownerUserId: userId }, attributes: ['id'] });
      if (row) return true;
      const member = await UserCompany.findOne({
        where: { userId, companyId, status: 'active' },
        attributes: ['id'],
      });
      return Boolean(member);
    }

    case 'department': {
      const row = await UserCompany.findOne({
        where: { userId, companyId, departmentId: ownerId, status: 'active' },
        attributes: ['id'],
      });
      return Boolean(row);
    }

    case 'user':
      return String(ownerId) === String(userId);

    default:
      return false;
  }
}

// hasCompanyVisibilityAccess: проверяет наличие данных и возвращает результат проверки.
async function hasCompanyVisibilityAccess({ companyId, userId, ownerType, ownerId }) {
  if (await hasRelatedEntityAccess({ companyId, userId, ownerType, ownerId })) return true;

  switch (ownerType) {
    case 'order': {
      const row = await Order.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      return Boolean(row);
    }

    case 'offer': {
      const row = await Offer.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      return Boolean(row);
    }

    case 'product': {
      const row = await Product.findOne({ where: { id: ownerId, companyId }, attributes: ['id'] });
      return Boolean(row);
    }

    case 'company': {
      const member = await UserCompany.findOne({
        where: { userId, companyId, status: 'active' },
        attributes: ['id'],
      });
      return Boolean(member);
    }

    default:
      return false;
  }
}

// assertUserCanReadOwner: выполняет вспомогательную бизнес-логику сервиса.
async function assertUserCanReadOwner({ companyId, userId, ownerType, ownerId }) {
  const hasRelated = await hasRelatedEntityAccess({ companyId, userId, ownerType, ownerId });
  if (hasRelated) return;

  const hasCompanyAccess = await hasCompanyVisibilityAccess({ companyId, userId, ownerType, ownerId });
  if (hasCompanyAccess) return;

  const err = new Error('Forbidden');
  err.status = 403;
  throw err;
}

// findNoteWithAccess: выполняет вспомогательную бизнес-логику сервиса.
async function findNoteWithAccess({ id, companyId, userId }) {
  return Note.findOne({
    where: {
      id,
      companyId,
      [Op.and]: [buildNoteAccessLiteral({ companyId, userId })],
    },
    include: AUTHOR_INCLUDE,
  });
}

// hasActiveMembership: проверяет наличие данных и возвращает результат проверки.
async function hasActiveMembership({ companyId, userId }) {
  const row = await UserCompany.findOne({
    where: { companyId, userId, status: 'active' },
    attributes: ['id'],
  });
  return Boolean(row);
}

// buildTaskLookupAccessLiteral: собирает служебную структуру для выполнения запроса.
function buildTaskLookupAccessLiteral({ companyId, userId, alias = '"Task"' }) {
  const cid = Note.sequelize.escape(companyId);
  const uid = Note.sequelize.escape(userId);
  const t = alias;

  return literal(`(
    ${t}.created_by = ${uid}
    OR EXISTS (
      SELECT 1
      FROM task_user_participants tup
      WHERE tup.task_id = ${t}.id
        AND tup.user_id = ${uid}
    )
    OR EXISTS (
      SELECT 1
      FROM task_department_participants tdp
      JOIN user_companies uc ON uc.department_id = tdp.department_id
      WHERE tdp.task_id = ${t}.id
        AND uc.user_id = ${uid}
        AND uc.company_id = ${cid}
        AND uc.status = 'active'
        AND uc.deleted_at IS NULL
    )
  )`);
}

// listOwnerOptions: возвращает список записей с фильтрами, сортировкой и пагинацией.
async function listOwnerOptions({ companyId, userId, ownerType, search, limit }) {
  const searchLike = `%${search}%`;

  switch (ownerType) {
    case 'counterparty': {
      const where = {
        companyId,
        [Op.or]: [{ mainResponsibleUserId: userId }, { createdBy: userId }],
      };
      if (search) {
        where[Op.and] = [
          {
            [Op.or]: [
              { shortName: { [Op.iLike]: searchLike } },
              { fullName: { [Op.iLike]: searchLike } },
              { nip: { [Op.iLike]: searchLike } },
            ],
          },
        ];
      }

      const rows = await Counterparty.findAll({
        where,
        attributes: ['id', 'shortName', 'fullName', 'nip', 'city'],
        order: [['createdAt', 'DESC']],
        limit,
      });

      return rows.map((row) => ({
        id: row.id,
        label: row.shortName || row.fullName || `#${shortId(row.id)}`,
        subtitle: [row.nip, row.city].filter(Boolean).join(' • ') || null,
      }));
    }

    case 'deal': {
      const where = {
        companyId,
        [Op.or]: [{ responsibleId: userId }, { createdBy: userId }],
      };
      if (search) where.title = { [Op.iLike]: searchLike };

      const rows = await Deal.findAll({
        where,
        attributes: ['id', 'title', 'status'],
        order: [['createdAt', 'DESC']],
        limit,
      });

      return rows.map((row) => ({
        id: row.id,
        label: row.title || `#${shortId(row.id)}`,
        subtitle: row.status || null,
      }));
    }

    case 'task': {
      const where = {
        companyId,
        [Op.and]: [buildTaskLookupAccessLiteral({ companyId, userId })],
      };
      if (search) where.title = { [Op.iLike]: searchLike };

      const rows = await Task.findAll({
        where,
        attributes: ['id', 'title', 'status'],
        order: [['createdAt', 'DESC']],
        limit,
      });

      return rows.map((row) => ({
        id: row.id,
        label: row.title || `#${shortId(row.id)}`,
        subtitle: row.status || null,
      }));
    }

    case 'contact': {
      const where = {
        companyId,
        [Op.or]: [{ mainResponsibleUserId: userId }, { createdBy: userId }],
      };
      if (search) {
        where[Op.and] = [
          {
            [Op.or]: [
              { displayName: { [Op.iLike]: searchLike } },
              { firstName: { [Op.iLike]: searchLike } },
              { lastName: { [Op.iLike]: searchLike } },
            ],
          },
        ];
      }

      const rows = await Contact.findAll({
        where,
        attributes: ['id', 'displayName', 'firstName', 'lastName', 'jobTitle'],
        order: [['createdAt', 'DESC']],
        limit,
      });

      return rows.map((row) => {
        const full = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
        return {
          id: row.id,
          label: row.displayName || full || `#${shortId(row.id)}`,
          subtitle: row.jobTitle || null,
        };
      });
    }

    case 'company': {
      const isMember = await hasActiveMembership({ companyId, userId });
      if (!isMember) return [];

      const row = await Company.findOne({
        where: { id: companyId },
        attributes: ['id', 'name', 'city'],
      });
      if (!row) return [];

      const label = row.name || `#${shortId(row.id)}`;
      if (search && !label.toLowerCase().includes(search.toLowerCase())) return [];

      return [
        {
          id: row.id,
          label,
          subtitle: row.city || null,
        },
      ];
    }

    case 'department': {
      const rows = await CompanyDepartment.findAll({
        where: {
          companyId,
          ...(search ? { name: { [Op.iLike]: searchLike } } : {}),
        },
        include: [
          {
            model: UserCompany,
            as: 'members',
            attributes: [],
            required: true,
            where: { userId, companyId, status: 'active' },
          },
        ],
        attributes: ['id', 'name'],
        order: [['name', 'ASC']],
        limit,
      });

      return rows.map((row) => ({
        id: row.id,
        label: row.name || `#${shortId(row.id)}`,
        subtitle: null,
      }));
    }

    case 'user': {
      const row = await User.findOne({
        where: { id: userId },
        attributes: ['id', 'firstName', 'lastName', 'email'],
      });
      if (!row) return [];

      const label = formatUserName(row) || `#${shortId(row.id)}`;
      const haystack = `${label} ${row.email || ''}`.toLowerCase();
      if (search && !haystack.includes(search.toLowerCase())) return [];

      return [
        {
          id: row.id,
          label,
          subtitle: row.email || null,
        },
      ];
    }

    case 'order': {
      const isMember = await hasActiveMembership({ companyId, userId });
      if (!isMember) return [];

      const rows = await Note.sequelize.query(
        `
          SELECT
            o.id::text AS id,
            COALESCE(to_jsonb(o)->>'status', '') AS status
          FROM orders o
          WHERE o.company_id = :companyId
            AND COALESCE(to_jsonb(o)->>'deleted_at', to_jsonb(o)->>'deletedAt') IS NULL
            AND (
              :search = ''
              OR CAST(o.id AS TEXT) ILIKE :searchLike
              OR COALESCE(to_jsonb(o)->>'status', '') ILIKE :searchLike
            )
          ORDER BY COALESCE((to_jsonb(o)->>'created_at')::timestamptz, (to_jsonb(o)->>'createdAt')::timestamptz) DESC NULLS LAST
          LIMIT :limit
        `,
        {
          replacements: { companyId, search, searchLike, limit },
          type: QueryTypes.SELECT,
        }
      );

      return rows.map((row) => ({
        id: row.id,
        label: `Order #${shortId(row.id)}`,
        subtitle: row.status || null,
      }));
    }

    case 'offer': {
      const isMember = await hasActiveMembership({ companyId, userId });
      if (!isMember) return [];

      const rows = await Note.sequelize.query(
        `
          SELECT
            o.id::text AS id,
            COALESCE(to_jsonb(o)->>'status', '') AS status
          FROM offers o
          WHERE o.company_id = :companyId
            AND COALESCE(to_jsonb(o)->>'deleted_at', to_jsonb(o)->>'deletedAt') IS NULL
            AND (
              :search = ''
              OR CAST(o.id AS TEXT) ILIKE :searchLike
              OR COALESCE(to_jsonb(o)->>'status', '') ILIKE :searchLike
            )
          ORDER BY COALESCE((to_jsonb(o)->>'created_at')::timestamptz, (to_jsonb(o)->>'createdAt')::timestamptz) DESC NULLS LAST
          LIMIT :limit
        `,
        {
          replacements: { companyId, search, searchLike, limit },
          type: QueryTypes.SELECT,
        }
      );

      return rows.map((row) => ({
        id: row.id,
        label: `Offer #${shortId(row.id)}`,
        subtitle: row.status || null,
      }));
    }

    case 'product': {
      const isMember = await hasActiveMembership({ companyId, userId });
      if (!isMember) return [];

      const where = { companyId };
      if (search) {
        const escaped = Product.sequelize.escape(searchLike);
        where[Op.or] = [
          { name: { [Op.iLike]: searchLike } },
          { sku: { [Op.iLike]: searchLike } },
          literal(`CAST("Product"."id" AS TEXT) ILIKE ${escaped}`),
        ];
      }

      const rows = await Product.findAll({
        where,
        attributes: ['id', 'name', 'sku'],
        order: [['createdAt', 'DESC']],
        limit,
      });

      return rows.map((row) => ({
        id: row.id,
        label: row.name || row.sku || `#${shortId(row.id)}`,
        subtitle: row.sku || null,
      }));
    }

    default:
      return [];
  }
}

module.exports = {
  OWNER_TYPES,

    // возвращает список записей с фильтрами, сортировкой и пагинацией.
async list({ companyId, userId, query = {} }) {
    const cid = requireCompanyId(companyId);
    const { limit, page, offset, sort, dir, search } = parseListMeta(query);

    const where = {
      companyId: cid,
      [Op.and]: [buildNoteAccessLiteral({ companyId: cid, userId })],
    };

    const ownerType = normalizeOwnerType(query.ownerType);
    if (ownerType) where.ownerType = ownerType;

    if (query.ownerId) where.ownerId = String(query.ownerId).trim();

    const visibility = normalizeVisibility(query.visibility);
    if (visibility) where.visibility = visibility;

    const pinned = parseBoolean(query.pinned);
    if (typeof pinned === 'boolean') where.pinned = pinned;

    if (search) {
      where.content = { [Op.iLike]: `%${search}%` };
    }

    const order = [];
    if (sort === 'pinned') {
      order.push(['pinned', dir]);
      order.push(['createdAt', 'DESC']);
    } else {
      order.push(['pinned', 'DESC']);
      order.push([sort, dir]);
      if (sort !== 'createdAt') order.push(['createdAt', 'DESC']);
    }

    const { rows, count } = await Note.findAndCountAll({
      where,
      include: AUTHOR_INCLUDE,
      order,
      limit,
      offset,
      distinct: true,
    });

    await enrichNotesWithOwnerMeta({ companyId: cid, notes: rows });
    return { rows, count, page, limit };
  },

    // возвращает данные по входным параметрам сервиса.
async getById({ id, companyId, userId }) {
    if (!id) return null;
    const cid = requireCompanyId(companyId);
    const note = await findNoteWithAccess({ id, companyId: cid, userId });
    return enrichSingleNoteWithOwnerMeta({ companyId: cid, note });
  },

    // выполняет вспомогательную бизнес-логику сервиса.
async ownerOptions({ companyId, userId, query = {} }) {
    const cid = requireCompanyId(companyId);
    const ownerType = normalizeOwnerType(query.ownerType);
    if (!ownerType) {
      const err = new Error('ownerType is required');
      err.status = 400;
      throw err;
    }

    const search = normalizeLookupSearch(query.search);
    const limit = normalizeLookupLimit(query.limit);
    return listOwnerOptions({
      companyId: cid,
      userId,
      ownerType,
      search,
      limit,
    });
  },

    // создаёт новую запись и возвращает результат.
async create({ companyId, userId, payload = {} }) {
    const cid = requireCompanyId(companyId);

    const ownerType = normalizeOwnerType(payload.ownerType);
    const ownerId = payload.ownerId;
    const visibilityPatch = await resolveVisibilityPatch({ companyId: cid, payload });

    if (!ownerType || !ownerId) {
      const err = new Error('ownerType and ownerId are required');
      err.status = 400;
      throw err;
    }

    await assertOwnerInCompany({ companyId: cid, ownerType, ownerId });
    await assertUserCanReadOwner({ companyId: cid, userId, ownerType, ownerId });

    const created = await Note.create({
      companyId: cid,
      authorUserId: userId,
      ownerType,
      ownerId,
      visibility: visibilityPatch.visibility,
      visibilityDepartmentId: visibilityPatch.visibilityDepartmentId,
      content: String(payload.content || '').trim(),
      pinned: Boolean(payload.pinned),
      updatedBy: userId,
    });

    const note = await findNoteWithAccess({ id: created.id, companyId: cid, userId });
    return enrichSingleNoteWithOwnerMeta({ companyId: cid, note });
  },

    // обновляет запись и возвращает актуальные данные.
async update({ id, companyId, user, payload = {} }) {
    const cid = requireCompanyId(companyId);
    const userId = user?.id;

    const note = await Note.findOne({ where: { id, companyId: cid } });
    if (!note) return null;

    const isAuthor = String(note.authorUserId) === String(userId);
    if (!isAuthor && !canManageForeignNote(user, 'update')) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    const nextOwnerType = normalizeOwnerType(payload.ownerType) || note.ownerType;
    const nextOwnerId = payload.ownerId || note.ownerId;
    const visibilityPatch =
      payload.visibility !== undefined || payload.visibilityDepartmentId !== undefined
        ? await resolveVisibilityPatch({ companyId: cid, payload, existing: note })
        : null;

    await assertOwnerInCompany({ companyId: cid, ownerType: nextOwnerType, ownerId: nextOwnerId });
    await assertUserCanReadOwner({
      companyId: cid,
      userId,
      ownerType: nextOwnerType,
      ownerId: nextOwnerId,
    });

    const patch = { updatedBy: userId };
    if (payload.content !== undefined) patch.content = String(payload.content).trim();
    if (visibilityPatch) {
      patch.visibility = visibilityPatch.visibility;
      patch.visibilityDepartmentId = visibilityPatch.visibilityDepartmentId;
    }
    if (payload.pinned !== undefined) patch.pinned = Boolean(payload.pinned);
    if (payload.ownerType !== undefined) patch.ownerType = nextOwnerType;
    if (payload.ownerId !== undefined) patch.ownerId = nextOwnerId;

    await note.update(patch);
    const updated = await findNoteWithAccess({ id: note.id, companyId: cid, userId });
    return enrichSingleNoteWithOwnerMeta({ companyId: cid, note: updated });
  },

    // удаляет запись с учётом бизнес-ограничений.
async remove({ id, companyId, user }) {
    const cid = requireCompanyId(companyId);
    const note = await Note.findOne({ where: { id, companyId: cid } });
    if (!note) return null;

    const isAuthor = String(note.authorUserId) === String(user?.id);
    if (!isAuthor && !canManageForeignNote(user, 'delete')) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }

    await note.destroy();
    return true;
  },
};
