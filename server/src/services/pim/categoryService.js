'use strict';

const { Op, fn, col, where: sqlWhere } = require('sequelize');
const AppError = require('../../errors/AppError');
const { sequelize, Category, Product } = require('../../models');

const ALLOWED_SORT = new Set(['createdAt', 'updatedAt', 'name', 'sortOrder']);

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
  return src || 'category';
}

// normalizeParentPath: приводит значения к единому формату для сервиса.
function normalizeParentPath(path) {
  const trimmed = String(path || '/').trim();
  const clean = trimmed.replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}/` : '/';
}

// buildPath: собирает служебную структуру для выполнения запроса.
function buildPath(parentPath, slug) {
  const parent = normalizeParentPath(parentPath);
  const segment = String(slug || '').replace(/^\/+|\/+$/g, '');
  if (!segment) return parent;
  if (parent === '/') return `/${segment}/`;
  return `${parent}${segment}/`.replace(/\/+/g, '/');
}

// ensureUniqueSlug: выполняет вспомогательную бизнес-логику сервиса.
async function ensureUniqueSlug(companyId, baseSlug, excludeId = null) {
  let candidate = (baseSlug || 'category').slice(0, 190);
  let i = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Category.findOne({
      where: {
        companyId,
        slug: candidate,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
      attributes: ['id'],
    });
    if (!exists) return candidate;
    i += 1;
    candidate = `${baseSlug}-${i}`.slice(0, 190);
  }
}

// getByIdInCompany: возвращает данные по входным параметрам сервиса.
async function getByIdInCompany(companyId, id) {
  if (!id) return null;
  return Category.findOne({ where: { id, companyId } });
}

// resolveParent: выполняет вспомогательную бизнес-логику сервиса.
async function resolveParent(companyId, parentId) {
  if (!parentId) return null;
  const parent = await getByIdInCompany(companyId, parentId);
  if (!parent) {
    throw new AppError(404, 'Parent category not found', { code: 'NOT_FOUND' });
  }
  return parent;
}

// findCategoryByNormalizedName: выполняет вспомогательную бизнес-логику сервиса.
async function findCategoryByNormalizedName({ companyId, name, parentId = null, excludeId = null }) {
  const normalized = normalizeName(name);
  if (!normalized) return null;

  const parentScope = parentId
    ? { parentId }
    : { parentId: { [Op.is]: null } };

  return Category.findOne({
    where: {
      companyId,
      ...parentScope,
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

// updateChildrenPaths: обновляет запись и возвращает актуальные данные.
async function updateChildrenPaths(companyId, oldPath, newPath) {
  if (!oldPath || oldPath === newPath) return;
  await sequelize.query(
    `
      UPDATE categories
      SET path = regexp_replace(path, :oldPrefix, :newPrefix)
      WHERE company_id = :companyId
        AND path LIKE :likeOld
        AND path <> :oldPath
    `,
    {
      replacements: {
        companyId,
        oldPrefix: `^${oldPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        newPrefix: newPath,
        likeOld: `${oldPath}%`,
        oldPath,
      },
    }
  );
}

// getChildrenCount: возвращает данные по входным параметрам сервиса.
async function getChildrenCount(companyId, categoryId) {
  return Category.count({
    where: {
      companyId,
      parentId: categoryId,
    },
  });
}

// getUsageById: возвращает данные по входным параметрам сервиса.
async function getUsageById(companyId, categoryId) {
  const [rows] = await sequelize.query(
    `
      SELECT
        COUNT(*) FILTER (WHERE p.primary_category_id = :categoryId)::int AS primary_count,
        COUNT(*) FILTER (WHERE p.subcategory_id = :categoryId)::int AS subcategory_count,
        COUNT(*) FILTER (
          WHERE p.primary_category_id = :categoryId
             OR p.subcategory_id = :categoryId
        )::int AS total_count
      FROM products p
      WHERE p.company_id = :companyId
    `,
    {
      replacements: { companyId, categoryId },
    }
  );
  return {
    primaryCount: Number(rows?.[0]?.primary_count || 0),
    subcategoryCount: Number(rows?.[0]?.subcategory_count || 0),
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
        c.id,
        COALESCE(usage.primary_count, 0)::int AS primary_count,
        COALESCE(usage.subcategory_count, 0)::int AS subcategory_count,
        COALESCE(usage.total_count, 0)::int AS total_count
      FROM categories c
      LEFT JOIN (
        SELECT
          i.category_id,
          COUNT(*) FILTER (WHERE i.role = 'primary')::int AS primary_count,
          COUNT(*) FILTER (WHERE i.role = 'subcategory')::int AS subcategory_count,
          COUNT(*)::int AS total_count
        FROM (
          SELECT p.primary_category_id AS category_id, 'primary'::text AS role
          FROM products p
          WHERE p.company_id = :companyId
            AND p.primary_category_id IN (:ids)
          UNION ALL
          SELECT p.subcategory_id AS category_id, 'subcategory'::text AS role
          FROM products p
          WHERE p.company_id = :companyId
            AND p.subcategory_id IN (:ids)
        ) i
        GROUP BY i.category_id
      ) usage ON usage.category_id = c.id
      WHERE c.company_id = :companyId
        AND c.id IN (:ids)
    `,
    {
      replacements: { companyId, ids },
    }
  );

  const map = new Map((usageRows || []).map((u) => [String(u.id), u]));
  return rows.map((row) => {
    const usage = map.get(String(row.id));
    if (!usage) return row;
    return {
      ...row.toJSON(),
      usage: {
        primaryCount: Number(usage.primary_count || 0),
        subcategoryCount: Number(usage.subcategory_count || 0),
        totalCount: Number(usage.total_count || 0),
      },
    };
  });
}

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const companyId = user?.companyId || query.companyId;
  if (!companyId) {
    throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  }

  const { page, limit, offset, sort, dir } = parseListQuery(query);
  const where = { companyId };

  if (query.parentId !== undefined) {
    where.parentId = query.parentId ? query.parentId : { [Op.is]: null };
  }

  if (query.isActive !== undefined) where.isActive = Boolean(query.isActive);

  const search = normalizeName(query.search || query.q || '');
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { slug: { [Op.iLike]: `%${toSlug(search)}%` } },
      { path: { [Op.iLike]: `%${toSlug(search)}%` } },
    ];
  }

  const { rows, count } = await Category.findAndCountAll({
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

  const parentId = asText(payload.parentId);
  const parent = await resolveParent(companyId, parentId);

  const existing = await findCategoryByNormalizedName({
    companyId,
    name,
    parentId: parent?.id || null,
  });

  if (existing) {
    return { row: existing, created: false };
  }

  const slug = await ensureUniqueSlug(companyId, toSlug(payload.slug || name));
  const path = buildPath(parent?.path, slug);

  const created = await Category.create({
    companyId,
    parentId: parent?.id || null,
    name,
    slug,
    path,
    description: asText(payload.description),
    isActive: payload.isActive === undefined ? true : Boolean(payload.isActive),
    sortOrder: Number.isFinite(Number(payload.sortOrder)) ? Number(payload.sortOrder) : 0,
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
  let nextParent = null;
  let parentChanged = false;
  let nameChanged = false;

  if (payload.parentId !== undefined) {
    const nextParentId = asText(payload.parentId);
    if (nextParentId && String(nextParentId) === String(row.id)) {
      throw new AppError(400, 'Category cannot be parent of itself', {
        code: 'VALIDATION_ERROR',
      });
    }
    nextParent = await resolveParent(companyId, nextParentId);
    patch.parentId = nextParent?.id || null;
    parentChanged = String(row.parentId || '') !== String(patch.parentId || '');
  } else {
    nextParent = row.parentId ? await resolveParent(companyId, row.parentId) : null;
  }

  if (payload.name !== undefined) {
    const nextName = normalizeName(payload.name);
    if (!nextName) {
      throw new AppError(400, 'name is required', { code: 'VALIDATION_ERROR' });
    }
    nameChanged = nextName !== row.name;
    const dupe = await findCategoryByNormalizedName({
      companyId,
      name: nextName,
      parentId: payload.parentId !== undefined ? patch.parentId : row.parentId || null,
      excludeId: row.id,
    });
    if (dupe) {
      return { row: dupe, created: false, replaced: true };
    }
    patch.name = nextName;
  }

  if (payload.description !== undefined) patch.description = asText(payload.description);
  if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);
  if (payload.sortOrder !== undefined && Number.isFinite(Number(payload.sortOrder))) {
    patch.sortOrder = Number(payload.sortOrder);
  }

  if (nameChanged || parentChanged) {
    const nextSlug = await ensureUniqueSlug(
      companyId,
      toSlug(payload.slug || patch.name || row.name),
      row.id
    );
    patch.slug = nextSlug;
    patch.path = buildPath(nextParent?.path, nextSlug);
  }

  const oldPath = row.path;
  if (Object.keys(patch).length) {
    await row.update(patch);
  }

  if (patch.path && patch.path !== oldPath) {
    await updateChildrenPaths(companyId, oldPath, patch.path);
  }

  return { row: await getByIdInCompany(companyId, row.id), created: false };
};

// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = async (id, user = {}) => {
  const companyId = user?.companyId;
  if (!companyId) return 0;

  const row = await getByIdInCompany(companyId, id);
  if (!row) return 0;

  const childrenCount = await getChildrenCount(companyId, id);
  if (childrenCount > 0) {
    throw new AppError(409, 'Category has child categories. Move or merge children first.', {
      code: 'CONFLICT',
      details: { childrenCount },
    });
  }

  const usage = await getUsageById(companyId, id);
  const reassignToId = asText(user?.reassignToId);
  const unassign = Boolean(user?.unassign);

  if (usage.totalCount > 0) {
    if (reassignToId) {
      if (String(reassignToId) === String(id)) {
        throw new AppError(400, 'Cannot reassign category to itself', {
          code: 'VALIDATION_ERROR',
        });
      }
      const target = await getByIdInCompany(companyId, reassignToId);
      if (!target) {
        throw new AppError(404, 'Target category not found', { code: 'NOT_FOUND' });
      }

      await sequelize.transaction(async (t) => {
        await Product.update(
          { primaryCategoryId: target.id },
          { where: { companyId, primaryCategoryId: row.id }, transaction: t }
        );
        await Product.update(
          { subcategoryId: target.id },
          { where: { companyId, subcategoryId: row.id }, transaction: t }
        );
        await row.destroy({ transaction: t });
      });
      return 1;
    }

    if (unassign) {
      await sequelize.transaction(async (t) => {
        await Product.update(
          { primaryCategoryId: null },
          { where: { companyId, primaryCategoryId: row.id }, transaction: t }
        );
        await Product.update(
          { subcategoryId: null },
          { where: { companyId, subcategoryId: row.id }, transaction: t }
        );
        await row.destroy({ transaction: t });
      });
      return 1;
    }

    throw new AppError(409, 'Category is used in products', {
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
  const childrenCount = await getChildrenCount(companyId, row.id);
  return {
    id: row.id,
    name: row.name,
    usage,
    childrenCount,
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
    throw new AppError(400, 'Cannot merge category into itself', { code: 'VALIDATION_ERROR' });
  }

  const target = await getByIdInCompany(companyId, targetId);
  if (!target) {
    throw new AppError(404, 'Target category not found', { code: 'NOT_FOUND' });
  }

  const childrenCount = await getChildrenCount(companyId, source.id);
  if (childrenCount > 0) {
    throw new AppError(409, 'Source category has child categories. Merge children first.', {
      code: 'CONFLICT',
      details: { childrenCount },
    });
  }

  const [primaryUsageRows] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS c
      FROM products
      WHERE company_id = :companyId
        AND primary_category_id = :sourceId
    `,
    { replacements: { companyId, sourceId: source.id } }
  );
  const [subcategoryUsageRows] = await sequelize.query(
    `
      SELECT COUNT(*)::int AS c
      FROM products
      WHERE company_id = :companyId
        AND subcategory_id = :sourceId
    `,
    { replacements: { companyId, sourceId: source.id } }
  );

  const movedPrimary = Number(primaryUsageRows?.[0]?.c || 0);
  const movedSubcategory = Number(subcategoryUsageRows?.[0]?.c || 0);

  await sequelize.transaction(async (t) => {
    await Product.update(
      { primaryCategoryId: target.id },
      { where: { companyId, primaryCategoryId: source.id }, transaction: t }
    );
    await Product.update(
      { subcategoryId: target.id },
      { where: { companyId, subcategoryId: source.id }, transaction: t }
    );
    await source.destroy({ transaction: t });
  });

  return {
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
    movedPrimary,
    movedSubcategory,
    totalMoved: movedPrimary + movedSubcategory,
  };
};

