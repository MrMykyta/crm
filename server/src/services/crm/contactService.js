'use strict';
const { Op } = require('sequelize');
const {
  sequelize,
  Contact,
  ContactPoint,
  Counterparty,
  UserCompany,
  User,
} = require('../../models');

/* ========== helpers ========== */

function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
}

async function assertCounterpartyInCompany(counterpartyId, companyId, tx) {
  const row = await Counterparty.findOne({
    where: { id: counterpartyId, companyId },
    transaction: tx,
  });
  if (!row) {
    const err = new Error('counterpartyId is invalid');
    err.status = 400;
    throw err;
  }
}

async function assertMemberInCompany(userId, companyId, tx) {
  if (!userId) return;
  const row = await UserCompany.findOne({
    where: { userId, companyId },
    transaction: tx,
  });
  if (!row) {
    const err = new Error('mainResponsibleUserId is invalid');
    err.status = 400;
    throw err;
  }
}

function buildWhere({ companyId, query }) {
  const where = { companyId };

  if (query.status) where.status = query.status;
  if (query.counterpartyId) where.counterpartyId = query.counterpartyId;
  if (query.department) where.department = query.department;
  if (query.jobTitle) where.jobTitle = query.jobTitle;

  if (query.search) {
    const s = `%${query.search}%`;
    where[Op.or] = [
      { firstName:  { [Op.iLike]: s } },
      { lastName:   { [Op.iLike]: s } },
      { middleName: { [Op.iLike]: s } },
      { displayName:{ [Op.iLike]: s } },
      { notes:      { [Op.iLike]: s } },
    ];
  }
  return where;
}

async function syncContactPoints({ companyId, contactId, points = [], userId, tx }) {
  // points: [{channel, valueRaw, label?, isPrimary?, isPublic?, notes?}]
  if (!Array.isArray(points)) return;

  // грузим существующие
  const rows = await ContactPoint.findAll({
    where: { companyId, ownerType: 'contact', ownerId: contactId },
    transaction: tx,
  });

  const byKey = (p) => `${p.channel}::${(p.valueNorm || p.valueRaw || '').trim().toLowerCase()}`;
  const normVal = (s) => (s || '').trim();
  // простая стратегия: удаляем всё и создаём заново (проще и безопасно)
  if (rows.length) {
    await ContactPoint.destroy({
      where: { companyId, ownerType: 'contact', ownerId: contactId },
      transaction: tx,
      force: false,
    });
  }

  if (points.length) {
    const toInsert = points.map(p => ({
      companyId,
      ownerType: 'contact',
      ownerId: contactId,
      channel: p.channel,
      valueRaw: normVal(p.valueRaw || p.valueNorm),
      valueNorm: normVal(p.valueNorm || p.valueRaw) || null,
      label: p.label || null,
      isPrimary: !!p.isPrimary,
      isPublic: p.isPublic != null ? !!p.isPublic : true,
      notes: p.notes || null,
      createdBy: userId || null,
    }));
    await ContactPoint.bulkCreate(toInsert, { transaction: tx });
  }
}

/* ========== service ========== */

module.exports.list = async ({ companyId, query = {} }) => {
  requireCompanyId(companyId);

  const page  = Math.max(1, Number(query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(query.limit || 25)));
  const offset = (page - 1) * limit;

  const where = buildWhere({ companyId, query });

  const include = [];
  if (query.withCounterparty === '1') {
    include.push({
      model: Counterparty,
      as: 'counterparty',
      attributes: ['id','shortName','fullName','type','status'],
      where: { companyId },
      required: false,
    });
  }
  if (query.withPoints === '1') {
    include.push({
      model: ContactPoint,
      as: 'contactPoints',
      attributes: ['id','channel','valueRaw','valueNorm','label','isPrimary','isPublic'],
      where: { companyId },
      required: false,
    });
  }

  const sortKey = query.sort || 'createdAt';
  const sortDir = (query.dir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  const { rows, count } = await Contact.findAndCountAll({
    where,
    include,
    order: [[sortKey, sortDir]],
    offset,
    limit,
    distinct: true,
  });

  return { rows, count, page, limit };
};

module.exports.getOne = async ({ companyId, id, query = {} }) => {
  requireCompanyId(companyId);
  const include = [
    {
      model: Counterparty,
      as: 'counterparty',
      attributes: ['id','shortName','fullName','type','status'],
      where: { companyId },
      required: false,
    },
    { model: User, as: 'responsible', attributes: ['id','firstName','lastName','email'] },
    { model: User, as: 'creator', attributes: ['id','firstName','lastName','email'] },
    { model: User, as: 'updater', attributes: ['id','firstName','lastName','email'] },
  ];
  if (query.withPoints !== '0') {
    include.push({
      model: ContactPoint,
      as: 'contactPoints',
      attributes: ['id','channel','valueRaw','valueNorm','label','isPrimary','isPublic','notes'],
      where: { companyId },
      required: false,
    });
  }

  const item = await Contact.findOne({ where: { id, companyId }, include });
  if (!item) throw new Error('Contact not found');
  return item;
};

module.exports.create = async ({ companyId, user, payload }) => {
  requireCompanyId(companyId);
  if (!user?.id) throw new Error('auth required');
  if (!payload?.counterpartyId) throw new Error('counterpartyId is required');

  const data = {
    companyId,
    counterpartyId: payload.counterpartyId,
    mainResponsibleUserId: payload.mainResponsibleUserId || null,

    firstName:  payload.firstName?.trim() || null,
    lastName:   payload.lastName?.trim() || null,
    middleName: payload.middleName?.trim() || null,
    displayName:payload.displayName?.trim() || null,

    jobTitle:   payload.jobTitle?.trim() || null,
    department: payload.department?.trim() || null,

    status:     payload.status || 'active',
    isPrimary:  !!payload.isPrimary,

    notes: payload.notes || null,

    createdBy: user.id,
    updatedBy: user.id,
  };

  return sequelize.transaction(async (tx) => {
    await assertCounterpartyInCompany(payload.counterpartyId, companyId, tx);
    await assertMemberInCompany(payload.mainResponsibleUserId, companyId, tx);

    // если ставим primary — снимем флаг у прочих по тому же контрагенту
    if (data.isPrimary) {
      await Contact.update(
        { isPrimary: false },
        { where: { companyId, counterpartyId: data.counterpartyId, deletedAt: null }, transaction: tx }
      );
    }

    const contact = await Contact.create(data, { transaction: tx });

    if (Array.isArray(payload.contactPoints) && payload.contactPoints.length) {
      await syncContactPoints({ companyId, contactId: contact.id, points: payload.contactPoints, userId: user.id, tx });
    }

    return module.exports.getOne({ companyId, id: contact.id });
  });
};

module.exports.update = async ({ companyId, id, user, payload }) => {
  requireCompanyId(companyId);
  if (!user?.id) throw new Error('auth required');

  const contact = await Contact.findOne({ where: { id, companyId } });
  if (!contact) throw new Error('Contact not found');

  const patch = {
    mainResponsibleUserId: payload.mainResponsibleUserId !== undefined ? payload.mainResponsibleUserId : contact.mainResponsibleUserId,

    firstName:  payload.firstName  !== undefined ? (payload.firstName?.trim()  || null) : contact.firstName,
    lastName:   payload.lastName   !== undefined ? (payload.lastName?.trim()   || null) : contact.lastName,
    middleName: payload.middleName !== undefined ? (payload.middleName?.trim() || null) : contact.middleName,
    displayName:payload.displayName!== undefined ? (payload.displayName?.trim()|| null) : contact.displayName,

    jobTitle:   payload.jobTitle   !== undefined ? (payload.jobTitle?.trim()   || null) : contact.jobTitle,
    department: payload.department !== undefined ? (payload.department?.trim() || null) : contact.department,

    status:     payload.status !== undefined ? payload.status : contact.status,
    isPrimary:  payload.isPrimary !== undefined ? !!payload.isPrimary : contact.isPrimary,

    notes: payload.notes !== undefined ? payload.notes : contact.notes,

    updatedBy: user.id,
  };

  return sequelize.transaction(async (tx) => {
    if (payload.mainResponsibleUserId !== undefined) {
      await assertMemberInCompany(payload.mainResponsibleUserId, companyId, tx);
    }

    if (patch.isPrimary && !contact.isPrimary) {
      await Contact.update(
        { isPrimary: false },
        { where: { companyId, counterpartyId: contact.counterpartyId, id: { [Op.ne]: id }, deletedAt: null }, transaction: tx }
      );
    }

    await contact.update(patch, { transaction: tx });

    if (Array.isArray(payload.contactPoints)) {
      await syncContactPoints({ companyId, contactId: contact.id, points: payload.contactPoints, userId: user.id, tx });
    }

    return module.exports.getOne({ companyId, id: contact.id });
  });
};

module.exports.remove = async ({ companyId, id }) => {
  requireCompanyId(companyId);
  const contact = await Contact.findOne({ where: { id, companyId } });
  if (!contact) throw new Error('Contact not found');
  await contact.destroy();
};

module.exports.restore = async ({ companyId, id }) => {
  requireCompanyId(companyId);
  await Contact.restore({ where: { id, companyId } });
  return module.exports.getOne({ companyId, id });
};
