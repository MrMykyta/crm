// productSupplierService.js (generated, hardened for PIM-4A)
const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  Counterparty,
  Product,
  ProductSupplier,
  ProductVariant,
} = require('../../models');

const parse = (q = {}) => {
  const page = Math.max(parseInt(q.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(q.limit || '20', 10), 1), 200);
  return { page, limit, offset: (page - 1) * limit };
};

function asText(value) {
  return String(value ?? '').trim();
}

function nullableText(value) {
  const text = asText(value);
  return text || null;
}

function optionalMoney(value, field) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(400, `${field} must be a non-negative number`, {
      code: 'VALIDATION_ERROR',
      details: { field },
    });
  }
  return parsed;
}

function optionalInt(value, field, min = 0) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < min) {
    throw new AppError(400, `${field} must be greater than or equal to ${min}`, {
      code: 'VALIDATION_ERROR',
      details: { field },
    });
  }
  return parsed;
}

function normalizeCurrency(value) {
  if (value === undefined) return undefined;
  const text = asText(value).toUpperCase();
  if (!text) return null;
  if (text.length > 3) {
    throw new AppError(400, 'currency must be at most 3 characters', {
      code: 'VALIDATION_ERROR',
      details: { field: 'currency' },
    });
  }
  return text;
}

async function assertExists(Model, where, label) {
  const row = await Model.findOne({ where, attributes: ['id'] });
  if (!row) {
    throw new AppError(400, `${label} is invalid`, {
      code: 'VALIDATION_ERROR',
      details: where,
    });
  }
  return row;
}

async function normalizePayload({ companyId, payload = {}, existing = null }) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }

  const nextProductId = payload.productId !== undefined
    ? nullableText(payload.productId)
    : existing?.productId || null;
  const nextVariantId = payload.variantId !== undefined
    ? nullableText(payload.variantId)
    : existing?.variantId || null;
  const nextSupplierId = payload.supplierId !== undefined
    ? nullableText(payload.supplierId)
    : existing?.supplierId || null;

  if (!nextProductId) {
    throw new AppError(400, 'productId is required', {
      code: 'VALIDATION_ERROR',
      details: { field: 'productId' },
    });
  }
  if (!nextSupplierId) {
    throw new AppError(400, 'supplierId is required', {
      code: 'VALIDATION_ERROR',
      details: { field: 'supplierId' },
    });
  }

  await assertExists(Product, { id: nextProductId, companyId }, 'productId');
  await assertExists(Counterparty, { id: nextSupplierId, companyId }, 'supplierId');

  if (nextVariantId) {
    await assertExists(ProductVariant, {
      id: nextVariantId,
      productId: nextProductId,
      companyId,
    }, 'variantId');
  }

  const out = {};
  if (!existing) out.companyId = companyId;
  if (payload.productId !== undefined || !existing) out.productId = nextProductId;
  if (payload.variantId !== undefined || !existing) out.variantId = nextVariantId;
  if (payload.supplierId !== undefined || !existing) out.supplierId = nextSupplierId;
  if (payload.supplierSku !== undefined) out.supplierSku = nullableText(payload.supplierSku);
  if (payload.url !== undefined) out.url = nullableText(payload.url);

  const price = optionalMoney(payload.price, 'price');
  if (price !== undefined) out.price = price;

  const moq = optionalInt(payload.moq, 'moq', 1);
  if (moq !== undefined) out.moq = moq;

  const leadTimeDays = optionalInt(payload.leadTimeDays, 'leadTimeDays', 0);
  if (leadTimeDays !== undefined) out.leadTimeDays = leadTimeDays;

  const packSize = optionalInt(payload.packSize, 'packSize', 1);
  if (packSize !== undefined) out.packSize = packSize;

  const currency = normalizeCurrency(payload.currency);
  if (currency !== undefined) out.currency = currency || 'PLN';

  return out;
}

module.exports.list = async ({ query = {}, user = {} } = {}) => {
  const { page, limit, offset } = parse(query);
  const companyId = user?.companyId || query.companyId;
  const where = {};
  if (companyId) where.companyId = companyId;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.productId) where.productId = query.productId;
  if (query.variantId) where.variantId = query.variantId;
  if (query.q) {
    where[Op.or] = [{ supplierSku: { [Op.iLike]: `%${query.q}%` } }];
  }
  const { rows, count } = await ProductSupplier.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });
  return { rows, count, page, limit };
};

module.exports.getById = (id, { companyId } = {}) => {
  if (!id) return null;
  const where = { id };
  if (companyId) where.companyId = companyId;
  return ProductSupplier.findOne({ where });
};

module.exports.create = async (payload = {}) => {
  if (!payload.companyId) throw new AppError(403, 'companyId is required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  const data = await normalizePayload({ companyId: payload.companyId, payload });
  return ProductSupplier.create(data);
};

module.exports.update = async (id, payload = {}, { companyId } = {}) => {
  const where = { id };
  if (companyId) where.companyId = companyId;
  const it = await ProductSupplier.findOne({ where });
  if (!it) return null;
  const data = await normalizePayload({ companyId: it.companyId, payload, existing: it });
  await it.update(data);
  return module.exports.getById(id, { companyId: it.companyId });
};

module.exports.remove = (id, { companyId } = {}) => {
  const where = { id };
  if (companyId) where.companyId = companyId;
  return ProductSupplier.destroy({ where });
};
