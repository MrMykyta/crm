const { Note } = require('../../models');
const { Op } = require('sequelize');
const { parsePagination, packResult } = require('../../utils/pagination');

const SORT_WHITELIST = new Set(['created_at','updated_at','pinned']);

module.exports.list = async (companyId, query = {}) => {
  const { limit, page, offset } = parsePagination(query);

  const where = { companyId };

  // фильтры по владельцу
  if (query.ownerType) where.ownerType = query.ownerType;
  if (query.ownerId) where.ownerId = query.ownerId;

  // видимость/пин
  if (query.visibility) where.visibility = query.visibility;
  if (query.pinned !== undefined) where.pinned = String(query.pinned) === 'true';

  // множественные
  if (Array.isArray(query.ownerTypes) && query.ownerTypes.length) where.ownerType = { [Op.in]: query.ownerTypes };

  // поиск по тексту
  if (query.search && String(query.search).trim()) {
    const s = `%${String(query.search).trim()}%`;
    where.content = { [Op.iLike]: s };
  }

  // даты
  const createdFrom = query.createdFrom ? new Date(query.createdFrom) : null;
  const createdTo   = query.createdTo   ? new Date(query.createdTo)   : null;
  if (createdFrom || createdTo) {
    where.createdAt = {};
    if (createdFrom) where.createdAt[Op.gte] = createdFrom;
    if (createdTo)   where.createdAt[Op.lte] = createdTo;
  }

  // сортировка: всегда сперва pinned, потом твой сорт
  let sort = String(query.sort || 'created_at');
  let dir  = String(query.dir  || 'DESC').toUpperCase();
  if (!SORT_WHITELIST.has(sort)) sort = 'created_at';
  if (!['ASC','DESC'].includes(dir)) dir = 'DESC';

  const order = [['pinned', 'DESC'], [sort, dir]];

  // выбор полей
  const attributes = query.fields
    ? String(query.fields).split(',').map(f => f.trim()).filter(Boolean)
    : undefined;

  try {
    const data = await Note.findAndCountAll({
      where,
      attributes,
      order,
      limit,
      offset,
      include: [{ association: 'author', attributes: ['id','firstName','lastName','email'] }]
    });
    return packResult(data, { limit, page });
  } catch (e) {
    throw new Error('Failed to list notes');
  }
};


module.exports.create = (companyId, authorUserId, payload) => {
    return Note.create({ ...payload, companyId, authorUserId });
};

module.exports.update = async (companyId, id, authorUserId, payload) => {
    const note = await Note.findOne({ where: { id, companyId } });
    if (!note) {
        return null;
    }
    return note.update(payload);
};

module.exports.remove = async (companyId, id) => {
    const note = await Note.findOne({ where: { id, companyId } });
    if (!note) {
        return null;
    }
    await note.destroy();
    return true;
};
