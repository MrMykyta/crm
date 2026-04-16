'use strict';

const { Op, fn, col, where: sqlWhere } = require('sequelize');
const AppError = require('../../errors/AppError');
const { sequelize, Brand, Product } = require('../../models');

const ALLOWED_SORT = new Set(['createdAt', 'updatedAt', 'name']);

// parseListQuery: парсит и нормализует входные параметры.
function parseListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || 1, 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit || 25, 10) || 25));
  const rawSort = String(query.sort || 'name');
  const sort = ALLOWED_SORT.has(rawSort) ? rawSort : 'name';
  const dir = String(query.dir || 'ASC').toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
  return { page, limit, offset: (page - 1) * limit, sort, dir };
}

// normalizeName: приводит значения к единому формату для сервиса.
function normalizeName(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

// asText: выполняет вспомогательную бизнес-логику сервиса.
function asText(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

// toSlug: выполняет вспомогательную бизнес-логику сервиса.
function toSlug(input) {
  const src = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return src || 'brand';
}

// ensureUniqueSlug: выполняет вспомогательную бизнес-логику сервиса.
async function ensureUniqueSlug(companyId, baseSlug, excludeId = null) {
  let candidate = (baseSlug || 'brand').slice(0, 150);
  let i = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Brand.findOne({
      where: {
        companyId,
        slug: candidate,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      attributes: ['id'],
    });
    if (!exists) return candidate;
    i += 1;
    candidate = `${baseSlug}-${i}`.slice(0, 150);
  }
}

// findBrandByNormalizedName: выполняет вспомогательную бизнес-логику сервиса.
async function findBrandByNormalizedName({ companyId, name, excludeId = null }) {
  const normalized = normalizeName(name);
  if (!normalized) return null;
  return Brand.findOne({
    where: {
      companyId,
      ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      [Op.and]: [
        sqlWhere(
          fn('lower', fn('btrim', col('name'))),
          normalized.toLowerCase()
        ),
      ],
    },
  });
}

// getByIdInCompany: возвращает данные по входным параметрам сервиса.
async function getByIdInCompany(companyId, id) {
  if (!id) return null;
  return Brand.findOne({ where: { id, companyId } });
}

// getUsageById: возвращает данные по входным параметрам сервиса.
async function getUsageById(companyId, brandId) {
  const [rows] = await sequelize.query(
    `
      SELECT
        COUNT(*)::int AS total_count
      FROM products
      WHERE company_id = :companyId
        AND brand_id = :brandId
    `,
    { replacements: { companyId, brandId } }
  );
  return {
    totalCount: Number(rows?.[0]?.total_count || 0),
  };
}

// attachUsageToRows: выполняет вспомогательную бизнес-логику сервиса.
async function attachUsageToRows(companyId, rows = []) {
  if (!rows.length) return rows;
  const ids = rows.map((row) => row.id);
  const [usageRows] = await sequelize.query(
    `
      SELECT
        b.id,
        COALESCE(u.total_count, 0)::int AS total_count
      FROM brands b
      LEFT JOIN (
        SELECT p.brand_id, COUNT(*)::int AS total_count
        FROM products p
        WHERE p.company_id = :companyId
          AND p.brand_id IN (:ids)
        GROUP BY p.brand_id
      ) u ON u.brand_id = b.id
      WHERE b.company_id = :companyId
        AND b.id IN (:ids)
    `,
    { replacements: { companyId, ids } }
  );
  const map = new Map((usageRows || []).map((u) => [String(u.id), Number(u.total_count || 0)]));
  return rows.map((row) => ({
    ...row.toJSON(),
    usage: {
      totalCount: map.get(String(row.id)) || 0,
    },
  }));
}

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const companyId = user?.companyId || query.companyId;
  if (!companyId) {
    throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  }

  const { page, limit, offset, sort, dir } = parseListQuery(query);
  const where = { companyId };

  if (query.isActive !== undefined) where.isActive = Boolean(query.isActive);

  const search = normalizeName(query.search || query.q || '');
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { slug: { [Op.iLike]: `%${toSlug(search)}%` } },
    ];
  }

  const { rows, count } = await Brand.findAndCountAll({
    where,
    order: [[sort, dir], ['createdAt', 'DESC']],
    limit,
    offset,
  });

  const includeUsage = Boolean(query.includeUsage);
  const rowsWithUsage = includeUsage
    ? await attachUsageToRows(companyId, rows)
    : rows;

  return { rows: rowsWithUsage, count, page, limit };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id, user = {}) => {
  const companyId = user?.companyId;
  if (!companyId) return null;
  return getByIdInCompany(companyId, id);
};

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (payload = {}, user = {}) => {
  const companyId = user?.companyId || payload.companyId;
  if (!companyId) {
    throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  }

  const name = normalizeName(payload.name);
  if (!name) {
    throw new AppError(400, 'name is required', { code: 'VALIDATION_ERROR' });
  }

  const existing = await findBrandByNormalizedName({ companyId, name });
  if (existing) {
    return { row: existing, created: false };
  }

  const slug = await ensureUniqueSlug(companyId, toSlug(payload.slug || name));
  const created = await Brand.create({
    companyId,
    name,
    slug,
    description: asText(payload.description),
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
  });

  return { row: created, created: true };
};

// update: обновляет запись и возвращает актуальные данные.
module.exports.update = async (id, payload = {}, user = {}) => {
  const companyId = user?.companyId || payload.companyId;
  if (!companyId) {
    throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  }

  const row = await getByIdInCompany(companyId, id);
  if (!row) return null;

  const patch = {};

  if (payload.name !== undefined) {
    const name = normalizeName(payload.name);
    if (!name) {
      throw new AppError(400, 'name is required', { code: 'VALIDATION_ERROR' });
    }
    const dupe = await findBrandByNormalizedName({ companyId, name, excludeId: row.id });
    if (dupe) {
      return { row: dupe, created: false, replaced: true };
    }
    patch.name = name;
    patch.slug = await ensureUniqueSlug(companyId, toSlug(name), row.id);
  }

  if (payload.description !== undefined) patch.description = asText(payload.description);
  if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);

  if (Object.keys(patch).length) {
    await row.update(patch);
  }

  return { row: await getByIdInCompany(companyId, row.id), created: false };
};

// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = async (id, user = {}) => {
  const companyId = user?.companyId;
  if (!companyId) return 0;
  const row = await getByIdInCompany(companyId, id);
  if (!row) return 0;

  const usage = await getUsageById(companyId, row.id);
  const reassignToId = asText(user?.reassignToId);
  const unassign = Boolean(user?.unassign);

  if (usage.totalCount > 0) {
    if (reassignToId) {
      if (String(reassignToId) === String(row.id)) {
        throw new AppError(400, 'Cannot reassign brand to itself', {
          code: 'VALIDATION_ERROR',
        });
      }
      const target = await getByIdInCompany(companyId, reassignToId);
      if (!target) {
        throw new AppError(404, 'Target brand not found', { code: 'NOT_FOUND' });
      }
      await sequelize.transaction(async (t) => {
        await Product.update(
          { brandId: target.id },
          { where: { companyId, brandId: row.id }, transaction: t }
        );
        await row.destroy({ transaction: t });
      });
      return 1;
    }

    if (unassign) {
      await sequelize.transaction(async (t) => {
        await Product.update(
          { brandId: null },
          { where: { companyId, brandId: row.id }, transaction: t }
        );
        await row.destroy({ transaction: t });
      });
      return 1;
    }

    throw new AppError(409, 'Brand is used in products', {
      code: 'CONFLICT',
      details: {
        usage,
        allowedActions: ['reassign', 'unassign', 'merge'],
      },
    });
  }

  await row.destroy();
  return 1;
};

// getUsage: возвращает данные по входным параметрам сервиса.
module.exports.getUsage = async (id, user = {}) => {
  const companyId = user?.companyId;
  if (!companyId) return null;
  const row = await getByIdInCompany(companyId, id);
  if (!row) return null;
  const usage = await getUsageById(companyId, row.id);
  return {
    id: row.id,
    name: row.name,
    usage,
  };
};

// merge: выполняет вспомогательную бизнес-логику сервиса.
module.exports.merge = async (id, payload = {}, user = {}) => {
  const companyId = user?.companyId || payload.companyId;
  if (!companyId) {
    throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  }

  const source = await getByIdInCompany(companyId, id);
  if (!source) return null;

  const targetId = asText(payload.targetId);
  if (!targetId) {
    throw new AppError(400, 'targetId is required', { code: 'VALIDATION_ERROR' });
  }
  if (String(targetId) === String(source.id)) {
    throw new AppError(400, 'Cannot merge brand into itself', { code: 'VALIDATION_ERROR' });
  }
  const target = await getByIdInCompany(companyId, targetId);
  if (!target) {
    throw new AppError(404, 'Target brand not found', { code: 'NOT_FOUND' });
  }

  const usage = await getUsageById(companyId, source.id);

  await sequelize.transaction(async (t) => {
    await Product.update(
      { brandId: target.id },
      { where: { companyId, brandId: source.id }, transaction: t }
    );
    await source.destroy({ transaction: t });
  });

  return {
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
    totalMoved: usage.totalCount,
  };
};

