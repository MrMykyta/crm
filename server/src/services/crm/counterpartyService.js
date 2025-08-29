const { sequelize, Counterparty, ContactPoint } = require('../../models');
const { Op } = require('sequelize');
const { parsePagination, packResult } = require('../../utils/pagination');
const { addContacts } = require('./contactPointService');

const SORT_WHITELIST = new Set(['created_at', 'name', 'status', 'type', 'updated_at']);

module.exports.list = async (companyId, query = {}) => {
    const { limit, page, offset } = parsePagination(query);

    // базовый where
    const where = { companyId };

    // фильтры по одиночным полям
    if (query.type) {
      where.type = query.type;
    }
    if (query.status) {
      where.status = query.status;
    }

    // фильтры по множественным значениям
    if (Array.isArray(query.types) && query.types.length) {
      where.type = { [Op.in]: query.types };
    }
    if (Array.isArray(query.statuses) && query.statuses.length) {
      where.status = { [Op.in]: query.statuses };
    }

    // полнотекстовый/like поиск (Postgres: ILIKE)
    if (query.search && String(query.search).trim()) {
      const s = `%${String(query.search).trim()}%`;
      // подстрой под реальные поля (name, taxId, email и т.д.)
      where[Op.or] = [
        { name:   { [Op.iLike]: s } },
        { nip: { [Op.iLike]: s } },      // если есть
        { email:  { [Op.iLike]: s } },      // если есть
      ];
    }

    // диапазон дат
    const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
    const createdTo   = query.createdTo   ? new Date(query.createdTo)   : null;
    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) where.createdAt[Op.gte] = createdFrom;
      if (createdTo)   where.createdAt[Op.lte] = createdTo;
    }

    // безопасная сортировка
    let sort = String(query.sort || 'created_at');
    let dir  = String(query.dir  || 'DESC').toUpperCase();
    if (!SORT_WHITELIST.has(sort)) sort = 'created_at';
    if (!['ASC', 'DESC'].includes(dir)) dir = 'DESC';

    // выбор колонок при желании (ускоряет ответ)
    const attributes = query.fields
      ? String(query.fields)
          .split(',')
          .map(f => f.trim())
          .filter(Boolean)
      : undefined; // все поля

    // include при необходимости (комментарий: добавь свои связи)
    // const include = [{ model: ContactPoint, as: 'contacts', attributes: ['id', 'type', 'value'] }];

    try {
      const data = await Counterparty.findAndCountAll({
        where,
        include: [{
          model: ContactPoint,
          as: 'contacts',
          attributes: ['id', 'channel', 'value_norm', 'is_primary', 'created_at'],
        }],
        attributes: {
          exclude: ['company_id','main_responsible_user_id','created_by','updated_by','holding_id']
        },
        order: [[sort, dir]],
        limit,
        distinct: true,
        offset,
      });
      return packResult(data, { limit, page });
    } catch (e) {
        throw new Error('Failed to list counterparties');
    }
};

module.exports.create = async (userId, companyId, data = {}) => {
  const t = await sequelize.transaction();
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
    
    // Контакт‑поинты (опционально)
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
    throw e;
  }
};

module.exports.getOne = async(companyId, id) =>{
    try {
        return await Counterparty.findOne({ 
          where: { 
            id, 
            companyId: companyId 
          }, 
          include: [{
            model: ContactPoint,
            as: 'contacts',
            attributes: ['id', 'channel', 'valueNorm', 'isPrimary', 'createdAt'],
          }],
          attributes: {
            exclude: ['company_id','main_responsible_user_id','created_by','updated_by','holding_id']
          },
        });
    } catch (e) {
        throw new Error('Counterparty not found');
    }
}

module.exports.update = async (userId, companyId, id, data = {}) => {
  const t = await sequelize.transaction();
  try {
    const counterparty = await Counterparty.findOne({
      where: { id, companyId: companyId },
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
      regon: data.regon ?? counterparty.regon,
      nip: data.nip ?? counterparty.nip,
      krs: data.krs ?? counterparty.krs,
      bdo: data.bdo ?? counterparty.bdo,
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

    // Добавление НОВЫХ контакт‑поинтов (редактирование/удаление — отдельными эндпоинтами)
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
    throw e;
  }
};

module.exports.remove = async (companyId, id) => {
    try {
        const counterparty = await Counterparty.findOne({ where: { id, companyId: companyId } });
        if (!counterparty) {
            return false;
        }
        await counterparty.destroy();
        return true;
    } catch (e) {
        throw new Error('Failed to delete counterparty');
    }
};
