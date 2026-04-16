'use strict';

const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const { Uom } = require('../../models');
const { UOM_FAMILIES, ensureDefaultUomsForCompany } = require('./uomDefaults');

const SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'name', 'code', 'family', 'precision']);
const ALLOWED_FAMILIES = new Set(UOM_FAMILIES);

// asText: выполняет вспомогательную бизнес-логику сервиса.
function asText(value) {
  if (value === undefined || value === null) return null;
  const next = String(value).trim();
  return next.length ? next : null;
}

// asCode: выполняет вспомогательную бизнес-логику сервиса.
function asCode(value) {
  const next = asText(value);
  return next ? next.toLowerCase() : null;
}

// asBool: выполняет вспомогательную бизнес-логику сервиса.
function asBool(value, fallback = null) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on', 'да'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off', 'нет'].includes(normalized)) return false;
  return fallback;
}

// asNumber: выполняет вспомогательную бизнес-логику сервиса.
function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

// asInt: выполняет вспомогательную бизнес-логику сервиса.
function asInt(value, fallback = null) {
  if (value === undefined || value === null || value === '') return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

// parseListQuery: парсит и нормализует входные параметры.
function parseListQuery(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '50', 10), 1), 500);
  const rawSort = asText(query.sort) || 'name';
  const sort = SORTABLE_FIELDS.has(rawSort) ? rawSort : 'name';
  const dir = String(query.dir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    dir,
  };
}

// normalizePayload: приводит значения к единому формату для сервиса.
function normalizePayload(payload = {}, { existing = null } = {}) {
  const out = {};
  const code = payload.code !== undefined ? asCode(payload.code) : null;
  const name = payload.name !== undefined ? asText(payload.name) : null;
  const family = payload.family !== undefined ? asCode(payload.family) : null;
  const baseUnitCode = payload.baseUnitCode !== undefined ? asCode(payload.baseUnitCode) : null;
  const factor = payload.factor !== undefined ? asNumber(payload.factor) : null;
  const precision = payload.precision !== undefined ? asInt(payload.precision, null) : null;
  const symbol = payload.symbol !== undefined ? asText(payload.symbol) : null;

  if (!existing || payload.code !== undefined) {
    if (!code) throw new AppError(400, 'code is required', { code: 'VALIDATION_ERROR' });
    out.code = code;
  }

  if (!existing || payload.name !== undefined) {
    if (!name) throw new AppError(400, 'name is required', { code: 'VALIDATION_ERROR' });
    out.name = name;
  }

  if (family !== null) {
    if (!ALLOWED_FAMILIES.has(family)) {
      throw new AppError(400, `family must be one of: ${Array.from(ALLOWED_FAMILIES).join(', ')}`, {
        code: 'VALIDATION_ERROR',
      });
    }
    out.family = family;
  } else if (!existing) {
    out.family = 'piece';
  }

  if (payload.baseUnitCode !== undefined) {
    if (!baseUnitCode) throw new AppError(400, 'baseUnitCode is required', { code: 'VALIDATION_ERROR' });
    out.baseUnitCode = baseUnitCode;
  } else if (!existing) {
    out.baseUnitCode = out.code || code || 'pcs';
  }

  if (payload.factor !== undefined) {
    if (factor === null || factor <= 0) {
      throw new AppError(400, 'factor must be a positive number', { code: 'VALIDATION_ERROR' });
    }
    out.factor = factor;
  } else if (!existing) {
    out.factor = 1;
  }

  if (payload.precision !== undefined) {
    if (!Number.isInteger(precision) || precision < 0 || precision > 6) {
      throw new AppError(400, 'precision must be integer from 0 to 6', { code: 'VALIDATION_ERROR' });
    }
    out.precision = precision;
  } else if (!existing) {
    out.precision = 0;
  }

  if (payload.symbol !== undefined) out.symbol = symbol;
  if (payload.isDefault !== undefined) out.isDefault = Boolean(payload.isDefault);
  if (payload.isActive !== undefined) out.isActive = Boolean(payload.isActive);

  if (!existing && payload.companyId) out.companyId = payload.companyId;
  return out;
}

// ensureCompanyDefaults: выполняет вспомогательную бизнес-логику сервиса.
async function ensureCompanyDefaults(companyId) {
  if (!companyId) return;
  await ensureDefaultUomsForCompany(companyId);
}

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset, sort, dir } = parseListQuery(query);
  const companyId = asText(query.companyId) || asText(user?.companyId);
  if (!companyId) throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });

  await ensureCompanyDefaults(companyId);

  const where = { companyId };

  const includeInactive = asBool(query.includeInactive, false);
  if (!includeInactive) where.isActive = true;

  const family = asCode(query.family);
  if (family) where.family = family;

  const q = asText(query.q);
  if (q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { code: { [Op.iLike]: `%${q}%` } },
      { symbol: { [Op.iLike]: `%${q}%` } },
    ];
  }

  const order = sort === 'name'
    ? [['family', 'ASC'], ['isDefault', 'DESC'], ['name', dir], ['code', 'ASC']]
    : [[sort, dir], ['name', 'ASC'], ['code', 'ASC']];

  const { rows, count } = await Uom.findAndCountAll({
    where,
    order,
    limit,
    offset,
  });

  return { rows, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = (id, { companyId } = {}) => {
  if (!id) return null;
  const where = companyId ? { id, companyId } : { id };
  return Uom.findOne({ where });
};

// create: создаёт новую запись и возвращает результат.
module.exports.create = async ({ payload = {}, user = {} } = {}) => {
  const companyId = asText(payload.companyId) || asText(user?.companyId);
  if (!companyId) throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });

  await ensureCompanyDefaults(companyId);

  const normalized = normalizePayload(payload);
  normalized.companyId = companyId;

  return Uom.create(normalized);
};

// update: обновляет запись и возвращает актуальные данные.
module.exports.update = async ({ id, payload = {}, user = {} } = {}) => {
  const companyId = asText(user?.companyId);
  const it = await module.exports.getById(id, { companyId });
  if (!it) return null;

  const patch = normalizePayload(payload, { existing: it });
  if (!Object.keys(patch).length) return it;

  await it.update(patch);
  return module.exports.getById(id, { companyId });
};

// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = async ({ id, user = {} } = {}) => {
  const companyId = asText(user?.companyId);
  if (!companyId) return 0;
  return Uom.destroy({ where: { id, companyId } });
};

