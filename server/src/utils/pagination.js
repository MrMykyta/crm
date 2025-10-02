// utils/pagination.js
'use strict';

const { Op } = require('sequelize');

/**
 * Парсит query для списков.
 * Возвращает нормализованные:
 *  - page, limit, offset
 *  - sort, dir (с валидацией по whitelist)
 *  - search (строка или null)
 *  - dateFrom, dateTo (Date | null)
 *  - fields (массив строк или null)
 *  - types, statuses (массивы строк)
 *
 * @param {object} query - req.query (или любой объект)
 * @param {object} [opts]
 * @param {string[]} [opts.sortWhitelist] - список допустимых полей сортировки
 * @param {string}   [opts.defaultSort='createdAt']
 * @param {'ASC'|'DESC'} [opts.defaultDir='DESC']
 * @param {number}   [opts.defaultLimit=25]
 * @param {number}   [opts.maxLimit=100]
 */
module.exports.parsePagination = (query = {}, opts = {}) => {
  const {
    sortWhitelist = null,
    defaultSort = 'createdAt',
    defaultDir = 'DESC',
    defaultLimit = 25,
    maxLimit = 100,
  } = opts;

  // ----- helpers
  const toInt = (v, def) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) && n > 0 ? n : def;
  };
  const clamp = (n, min, max) => Math.min(Math.max(n, min), max);
  const toArray = (v) => {
    if (Array.isArray(v)) return v;
    if (v == null || v === '') return [];
    return String(v).split(',').map(s => s.trim()).filter(Boolean);
  };
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  // ----- limit/page/offset
  const limit = clamp(toInt(query.limit, defaultLimit), 1, maxLimit);
  const page  = clamp(toInt(query.page, 1), 1, Number.MAX_SAFE_INTEGER);
  const offset = (page - 1) * limit;

  // ----- sort/dir
  let sort = str(query.sort) || defaultSort;
  let dir  = (str(query.dir) || defaultDir).toUpperCase();
  if (!['ASC', 'DESC'].includes(dir)) dir = defaultDir;

  if (sortWhitelist && sort && !sortWhitelist.includes(sort)) {
    // если поле сортировки не из белого списка — заменяем на дефолт
    sort = defaultSort;
  }

  // ----- search
  const search = str(query.search) || null;

  // ----- даты (не валидные превращаем в null)
  const toDate = (v) => {
    if (!v) return null;
    const d = new Date(v);
    return Number.isFinite(+d) ? d : null;
  };
  const dateFrom = toDate(query.dateFrom || query.createdFrom) || null;
  const dateTo   = toDate(query.dateTo   || query.createdTo)   || null;

  // ----- выбор полей (attributes)
  const fieldsArr = toArray(query.fields);
  const fields = fieldsArr.length ? fieldsArr : null;

  // ----- частые фильтры множественного выбора
  const types = toArray(query.types);
  const statuses = toArray(query.statuses);

  return {
    // пагинация
    limit, page, offset,
    // сортировка
    sort, dir,
    // поиск/диапазоны
    search,
    dateFrom, dateTo,
    // выбор атрибутов и частые множественные фильтры
    fields,
    types, statuses,
  };
};

/**
 * Упаковка ответа списка.
 * Совместим с прежней сигнатурой: второй аргумент должен содержать хотя бы { limit, page }.
 * Дополнительно можно передать { sort, dir, offset } — они попадут в ответ.
 */
module.exports.packResult = ({ rows, count }, meta) => {
  const limit  = meta?.limit ?? 25;
  const page   = meta?.page ?? 1;
  const pages  = Math.ceil((count || 0) / (limit || 1)) || 1;

  const payload = {
    items: rows,
    total: count,
    limit,
    page,
    pages,
  };

  // если передали — прокинем для удобства на фронт
  if (meta?.offset != null) payload.offset = meta.offset;
  if (meta?.sort)  payload.sort = meta.sort;
  if (meta?.dir)   payload.dir  = meta.dir;

  return payload;
};

/**
 * Утилита: применить search/dateFrom/dateTo к where для Sequelize.
 * Опционально accepts mapping для полей поиска.
 *
 * @param {object} where - исходный where
 * @param {object} parsed - результат parsePagination
 * @param {string[]} searchFields - список полей для ILIKE
 * @returns {object} where
 */
module.exports.applyCommonFilters = (where = {}, parsed = {}, searchFields = []) => {
  const { Op } = require('sequelize');

  // поиск по ILIKE
  if (parsed.search) {
    const s = `%${parsed.search}%`;
    where[Op.or] = [
      ...(where[Op.or] || []),
      ...searchFields.map(f => ({ [f]: { [Op.iLike]: s } })),
    ];
  }

  // диапазон дат по createdAt
  if (parsed.dateFrom || parsed.dateTo) {
    where.createdAt = where.createdAt || {};
    if (parsed.dateFrom) where.createdAt[Op.gte] = parsed.dateFrom;
    if (parsed.dateTo)   where.createdAt[Op.lte] = parsed.dateTo;
  }

  return where;
};