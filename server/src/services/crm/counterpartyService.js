'use strict';

const { sequelize, Counterparty, ContactPoint } = require('../../models');
const { Op } = require('sequelize');
const { parsePagination, packResult, applyCommonFilters } = require('../../utils/pagination');
const { addContacts } = require('./contactPointService');

// какие поля разрешаем сортировать
const SORT_WHITELIST = ['createdAt', 'updatedAt', 'shortName', 'status', 'type'];

module.exports.list = async (companyId, query = {}) => {
  // разберём query и зададим дефолты
  const parsed = parsePagination(query, {
    sortWhitelist: SORT_WHITELIST,
    defaultSort: 'createdAt',
    defaultDir: 'DESC',
    defaultLimit: 25,
    maxLimit: 100,
  });

  const where = { companyId };

  // одиночные фильтры (если прилетят)
  if (query.type) where.type = query.type;
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.isCompany != null) where.isCompany = String(query.isCompany) === 'true';

  // множественные фильтры из parsePagination
  if (parsed.types?.length) where.type = { [Op.in]: parsed.types };
  if (parsed.statuses?.length) where.status = { [Op.in]: parsed.statuses };

  // общий поиск + диапазоны дат (createdAt)
  applyCommonFilters(where, parsed, ['shortName', 'fullName', 'nip', 'regon', 'krs']);

  // выбор колонок (если ?fields=id,shortName,status)
  const attributes = parsed.fields ? parsed.fields : {
    exclude: ['companyId','mainResponsibleUserId','createdBy','updatedBy','holdingId']
  };

  const data = await Counterparty.findAndCountAll({
    where,
    include: [{
      model: ContactPoint,
      as: 'contacts',
      // ВАЖНО: эти имена должны совпадать с определением модели ContactPoint (camelCase)
      attributes: ['id', 'channel', 'valueNorm', 'isPrimary', 'createdAt'],
    }],
    attributes,
    order: [[parsed.sort, parsed.dir]],
    limit: parsed.limit,
    offset: parsed.offset,
    distinct: true,
  });

  return packResult(data, parsed);
};

module.exports.create = async (userId, companyId, data = {}) => {
  const t = await sequelize.transaction();
  console.log('Creating counterparty add:', data, userId, companyId);
  try {
    const counterparty = await Counterparty.create({
      companyId,
      holdingId: data.holdingId ?? null,
      departmentId: data.departmentId ?? null,
      mainResponsibleUserId: data.mainResponsibleUserId ?? null,
      fullName: data.fullName,
      shortName: data.shortName,
      regon: data.regon ?? null,
      nip: data.nip ?? null,
      krs: data.krs ?? null,
      bdo: data.bdo ?? null,
      type: data.type ?? 'lead',
      status: data.status ?? 'potential',
      country: data.country ?? null,
      city: data.city ?? null,
      postalCode: data.postalCode ?? null,
      street: data.street ?? null,
      isCompany: data.isCompany ?? true,
      description: data.description ?? null,
      createdBy: userId,
      updatedBy: userId
    }, { transaction: t });
    
    console.log('Created counterparty added:', counterparty);
    // Контакт-поинты (опционально)
    await addContacts({
      companyId,
      ownerType: 'counterparty',
      ownerId: counterparty.id,
      contacts: data.contacts,
      actorUserId: userId,
      t
    });
    console.log('Counterparty contacts added:', data.contacts);

    await t.commit();
    return counterparty;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

module.exports.getOne = async (companyId, id) => {
  return Counterparty.findOne({
    where: { id, companyId },
    include: [{
      model: ContactPoint,
      as: 'contacts',
      attributes: ['id', 'channel', 'valueNorm', 'isPrimary', 'createdAt'],
    }],
    attributes: {
      exclude: ['companyId','mainResponsibleUserId','createdBy','updatedBy','holdingId']
    },
  });
};

module.exports.update = async (userId, companyId, id, data = {}) => {
  const t = await sequelize.transaction();
  try {
    const counterparty = await Counterparty.findOne({
      where: { id, companyId },
      transaction: t
    });
    if (!counterparty) {
      await t.rollback();
      return null;
    }

    await counterparty.update({
      holdingId: data.holdingId ?? counterparty.holdingId,
      departmentId: data.departmentId ?? counterparty.departmentId,
      mainResponsibleUserId: data.mainResponsibleUserId ?? counterparty.mainResponsibleUserId,
      fullName: data.fullName ?? counterparty.fullName,
      shortName: data.shortName ?? counterparty.shortName,
      regon: data.regon ,
      nip: data.nip ,
      krs: data.krs ,
      bdo: data.bdo ,
      type: data.type ?? counterparty.type,
      status: data.status ?? counterparty.status,
      country: data.country ?? counterparty.country,
      city: data.city ?? counterparty.city,
      postalCode: data.postalCode ?? counterparty.postalCode,
      street: data.street ?? counterparty.street,
      isCompany: data.isCompany ?? counterparty.isCompany,
      description: data.description ?? counterparty.description,
      updatedBy: userId
    }, { transaction: t });

    console.log('Counterparty updated:', counterparty);

    await addContacts({
      companyId,
      ownerType: 'counterparty',
      ownerId: counterparty.id,
      contacts: data.contacts,
      actorUserId: userId,
      t
    });

    await t.commit();
    return counterparty;
  } catch (e) {
    await t.rollback();
    console.log(e);
  }
};

module.exports.remove = async (companyId, id) => {
  const row = await Counterparty.findOne({ where: { id, companyId } });
  if (!row) return false;
  await row.destroy();
  return true;
};

// POST /:companyId/:id/convert-lead
module.exports.convertLead = async (companyId, id, userId) => {
  const [n] = await Counterparty.update(
    { type: 'client', status: 'active', updatedBy: userId },
    { where: { id, companyId, type: 'lead' } }
  );
  return n > 0;
};