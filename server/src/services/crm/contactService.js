'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  Contact,
  Counterparty,
  UserCompany,
  User,
} = require('../../models');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const SORT_MAP = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  position: 'jobTitle',
  isMain: 'isPrimary',
};

// requireCompanyId: выполняет вспомогательную бизнес-логику сервиса.
function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
}

// normalizeText: приводит значения к единому формату для сервиса.
function normalizeText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const text = String(value).trim();
  return text || null;
}

// normalizeBoolean: приводит значения к единому формату для сервиса.
function normalizeBoolean(value) {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  const lowered = String(value).toLowerCase();
  return lowered === 'true' || lowered === '1';
}

// normalizeAvatarRef: приводит значения к единому формату для сервиса.
function normalizeAvatarRef(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    const err = new Error('avatarUrl must be fileId(uuid) or external URL');
    err.status = 400;
    throw err;
  }

  const text = String(value).trim();
  if (!text) return null;

  if (text.includes('/api/files/')) {
    const err = new Error('avatarUrl must be fileId(uuid) or external URL');
    err.status = 400;
    throw err;
  }
  if (UUID_RE.test(text)) return text;
  if (/^https?:\/\/.+/i.test(text)) return text;

  const err = new Error('avatarUrl must be fileId(uuid) or external URL');
  err.status = 400;
  throw err;
}

// buildSort: собирает служебную структуру для выполнения запроса.
function buildSort(query = {}) {
  const key = query.sortBy || query.sort || 'createdAt';
  const dirRaw = String(query.sortOrder || query.dir || 'DESC').toUpperCase();
  const direction = dirRaw === 'ASC' ? 'ASC' : 'DESC';
  const column = SORT_MAP[key] || SORT_MAP.createdAt;
  return [column, direction];
}

// parsePagination: парсит и нормализует входные параметры.
function parsePagination(query = {}) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.min(200, Math.max(1, Number(query.limit || 25)));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

// baseIncludes: выполняет вспомогательную бизнес-логику сервиса.
function baseIncludes(companyId) {
  return [
    {
      model: Counterparty,
      as: 'counterparty',
      attributes: ['id', 'shortName', 'fullName', 'type', 'status'],
      required: false,
      where: { companyId },
    },
    {
      model: User,
      as: 'creator',
      attributes: ['id', 'firstName', 'lastName', 'email'],
      required: false,
    },
    {
      model: User,
      as: 'responsible',
      attributes: ['id', 'firstName', 'lastName', 'email'],
      required: false,
    },
  ];
}

// toContactDto: выполняет вспомогательную бизнес-логику сервиса.
function toContactDto(item) {
  const row = item?.toJSON ? item.toJSON() : item;
  if (!row) return null;

  const first = String(row.firstName || '').trim();
  const last = String(row.lastName || '').trim();
  const fullName = [first, last].filter(Boolean).join(' ').trim() || row.displayName || first || last || null;

  return {
    ...row,
    fullName,
    position: row.jobTitle || null,
    note: row.notes || null,
    isMain: !!row.isPrimary,
  };
}

// buildWhere: собирает служебную структуру для выполнения запроса.
function buildWhere({ companyId, query = {} }) {
  const where = { companyId };

  if (query.counterpartyId) where.counterpartyId = query.counterpartyId;

  const isMain = normalizeBoolean(query.isMain);
  if (isMain !== undefined) where.isPrimary = isMain;

  const search = String(query.search || '').trim();
  if (search) {
    const s = `%${search}%`;
    where[Op.or] = [
      { firstName: { [Op.iLike]: s } },
      { lastName: { [Op.iLike]: s } },
      { email: { [Op.iLike]: s } },
      { phone: { [Op.iLike]: s } },
      { jobTitle: { [Op.iLike]: s } },
      { department: { [Op.iLike]: s } },
      { notes: { [Op.iLike]: s } },
    ];
  }

  return where;
}

// assertCounterpartyInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertCounterpartyInCompany(counterpartyId, companyId, transaction) {
  if (!counterpartyId) {
    const err = new Error('counterpartyId is required');
    err.status = 400;
    throw err;
  }

  const row = await Counterparty.findOne({
    where: { id: counterpartyId, companyId },
    transaction,
    attributes: ['id'],
  });

  if (!row) {
    const err = new Error('counterpartyId is invalid');
    err.status = 400;
    throw err;
  }
}

// assertMemberInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertMemberInCompany(userId, companyId, transaction) {
  if (!userId) return;
  const row = await UserCompany.findOne({
    where: { userId, companyId },
    transaction,
    attributes: ['id'],
  });
  if (!row) {
    const err = new Error('mainResponsibleUserId is invalid');
    err.status = 400;
    throw err;
  }
}

// buildPatch: собирает служебную структуру для выполнения запроса.
function buildPatch(payload = {}) {
  const patch = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'counterpartyId')) {
    patch.counterpartyId = payload.counterpartyId;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'firstName')) {
    patch.firstName = normalizeText(payload.firstName);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'lastName')) {
    patch.lastName = normalizeText(payload.lastName);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'email')) {
    patch.email = normalizeText(payload.email);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'phone')) {
    patch.phone = normalizeText(payload.phone);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'avatarUrl')) {
    patch.avatarUrl = normalizeAvatarRef(payload.avatarUrl);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'position')) {
    patch.jobTitle = normalizeText(payload.position);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'jobTitle')) {
    patch.jobTitle = normalizeText(payload.jobTitle);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'department')) {
    patch.department = normalizeText(payload.department);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'note')) {
    patch.notes = normalizeText(payload.note);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'notes')) {
    patch.notes = normalizeText(payload.notes);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'isMain')) {
    patch.isPrimary = !!payload.isMain;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'isPrimary')) {
    patch.isPrimary = !!payload.isPrimary;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'mainResponsibleUserId')) {
    patch.mainResponsibleUserId = payload.mainResponsibleUserId || null;
  }

  return patch;
}

// getContacts: возвращает данные по входным параметрам сервиса.
module.exports.getContacts = async ({ companyId, query = {} }) => {
  requireCompanyId(companyId);

  const { page, limit, offset } = parsePagination(query);
  const where = buildWhere({ companyId, query });
  const [sortColumn, sortDir] = buildSort(query);

  const { rows, count } = await Contact.findAndCountAll({
    where,
    include: baseIncludes(companyId),
    order: [[sortColumn, sortDir]],
    offset,
    limit,
    distinct: true,
  });

  return {
    rows: rows.map(toContactDto),
    count,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(Number(count || 0) / limit)),
  };
};

// getContactsByCounterparty: возвращает данные по входным параметрам сервиса.
module.exports.getContactsByCounterparty = async ({ companyId, counterpartyId, query = {} }) => {
  requireCompanyId(companyId);
  await assertCounterpartyInCompany(counterpartyId, companyId);

  return module.exports.getContacts({
    companyId,
    query: { ...query, counterpartyId },
  });
};

// getContactById: возвращает данные по входным параметрам сервиса.
module.exports.getContactById = async ({ companyId, contactId, transaction }) => {
  requireCompanyId(companyId);

  const item = await Contact.findOne({
    where: { id: contactId, companyId },
    include: baseIncludes(companyId),
    transaction,
  });

  if (!item) {
    const err = new Error('Contact not found');
    err.status = 404;
    throw err;
  }

  return toContactDto(item);
};

// createContact: создаёт новую запись и возвращает результат.
module.exports.createContact = async ({ companyId, payload = {}, user }) => {
  requireCompanyId(companyId);
  if (!user?.id) {
    const err = new Error('auth required');
    err.status = 401;
    throw err;
  }

  const patch = buildPatch(payload);
  if (!patch.firstName) {
    const err = new Error('firstName is required');
    err.status = 400;
    throw err;
  }

  return sequelize.transaction(async (transaction) => {
    await assertCounterpartyInCompany(payload.counterpartyId, companyId, transaction);
    await assertMemberInCompany(patch.mainResponsibleUserId, companyId, transaction);

    const isPrimary = !!patch.isPrimary;
    const counterpartyId = payload.counterpartyId;

    if (isPrimary) {
      await Contact.update(
        { isPrimary: false },
        {
          where: { companyId, counterpartyId, deletedAt: null },
          transaction,
          validate: false,
        }
      );
    }

    const created = await Contact.create(
      {
        companyId,
        counterpartyId,
        firstName: patch.firstName,
        lastName: patch.lastName || null,
        email: patch.email || null,
        phone: patch.phone || null,
        avatarUrl: patch.avatarUrl || null,
        jobTitle: patch.jobTitle || null,
        department: patch.department || null,
        notes: patch.notes || null,
        isPrimary,
        mainResponsibleUserId: patch.mainResponsibleUserId || null,
        status: 'active',
        createdBy: user.id,
        updatedBy: user.id,
      },
      { transaction }
    );

    return module.exports.getContactById({
      companyId,
      contactId: created.id,
      transaction,
    });
  });
};

// updateContact: обновляет запись и возвращает актуальные данные.
module.exports.updateContact = async ({ companyId, contactId, payload = {}, user }) => {
  requireCompanyId(companyId);
  if (!user?.id) {
    const err = new Error('auth required');
    err.status = 401;
    throw err;
  }

  const contact = await Contact.findOne({ where: { id: contactId, companyId } });
  if (!contact) {
    const err = new Error('Contact not found');
    err.status = 404;
    throw err;
  }

  const patch = buildPatch(payload);

  if (Object.prototype.hasOwnProperty.call(patch, 'firstName') && !patch.firstName) {
    const err = new Error('firstName is required');
    err.status = 400;
    throw err;
  }

  return sequelize.transaction(async (transaction) => {
    const nextCounterpartyId = patch.counterpartyId || contact.counterpartyId;

    if (Object.prototype.hasOwnProperty.call(patch, 'counterpartyId')) {
      await assertCounterpartyInCompany(nextCounterpartyId, companyId, transaction);
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'mainResponsibleUserId')) {
      await assertMemberInCompany(patch.mainResponsibleUserId, companyId, transaction);
    }

    if (patch.isPrimary) {
      await Contact.update(
        { isPrimary: false },
        {
          where: {
            companyId,
            counterpartyId: nextCounterpartyId,
            id: { [Op.ne]: contactId },
            deletedAt: null,
          },
          transaction,
          validate: false,
        }
      );
    }

    await contact.update(
      {
        ...patch,
        updatedBy: user.id,
      },
      {
        transaction,
        validate: false,
      }
    );

    return module.exports.getContactById({
      companyId,
      contactId,
      transaction,
    });
  });
};

// deleteContact: удаляет запись с учётом бизнес-ограничений.
module.exports.deleteContact = async ({ companyId, contactId }) => {
  requireCompanyId(companyId);

  const contact = await Contact.findOne({ where: { id: contactId, companyId } });
  if (!contact) {
    const err = new Error('Contact not found');
    err.status = 404;
    throw err;
  }

  await contact.destroy();
  return true;
};

// setMainContact: изменяет состояние сущности по правилам сервиса.
module.exports.setMainContact = async ({ companyId, contactId, user }) => {
  requireCompanyId(companyId);

  const contact = await Contact.findOne({ where: { id: contactId, companyId } });
  if (!contact) {
    const err = new Error('Contact not found');
    err.status = 404;
    throw err;
  }

  return sequelize.transaction(async (transaction) => {
    await Contact.update(
      { isPrimary: false },
      {
        where: {
          companyId,
          counterpartyId: contact.counterpartyId,
          deletedAt: null,
        },
        transaction,
        validate: false,
      }
    );

    await Contact.update(
      {
        isPrimary: true,
        updatedBy: user?.id || contact.updatedBy || null,
      },
      {
        where: {
          id: contact.id,
          companyId,
        },
        transaction,
        validate: false,
      }
    );

    return module.exports.getContactById({
      companyId,
      contactId: contact.id,
      transaction,
    });
  });
};

// restoreContact: выполняет вспомогательную бизнес-логику сервиса.
module.exports.restoreContact = async ({ companyId, contactId }) => {
  requireCompanyId(companyId);
  await Contact.restore({ where: { id: contactId, companyId } });
  return module.exports.getContactById({ companyId, contactId });
};

/* Backward-compatible aliases */
module.exports.list = ({ companyId, query = {} }) => module.exports.getContacts({ companyId, query });
// getOne: возвращает данные по входным параметрам сервиса.
module.exports.getOne = ({ companyId, id }) => module.exports.getContactById({ companyId, contactId: id });
// create: создаёт новую запись и возвращает результат.
module.exports.create = ({ companyId, payload, user }) => module.exports.createContact({ companyId, payload, user });
// update: обновляет запись и возвращает актуальные данные.
module.exports.update = ({ companyId, id, payload, user }) => module.exports.updateContact({ companyId, contactId: id, payload, user });
// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = ({ companyId, id }) => module.exports.deleteContact({ companyId, contactId: id });
// restore: выполняет вспомогательную бизнес-логику сервиса.
module.exports.restore = ({ companyId, id }) => module.exports.restoreContact({ companyId, contactId: id });
