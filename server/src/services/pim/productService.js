'use strict';

const { Op, fn, col } = require('sequelize');
const AppError = require('../../errors/AppError');
const { withTx } = require('../../utils/tx');
const {
  sequelize,
  Product,
  ProductVariant,
  VariantOption,
  ProductAttributeValue,
  Brand,
  Category,
  Uom,
  ShippingClass,
  TaxCategory,
  ProductType,
  Counterparty,
  ProductSupplier,
  ProductExternalRef,
  ProductAttachment,
  PriceList,
  PriceListItem,
  Attribute,
  File,
  InventoryItem,
  Reservation,
  StockMove,
  Warehouse,
} = require('../../models');

const PRODUCT_SORT_FIELDS = new Set([
  'createdAt',
  'updatedAt',
  'name',
  'sku',
  'price',
  'cost',
  'stockQuantity',
]);

// Compatibility fields that still exist in products table while related modules migrate.
const PRODUCT_DEPRECATED_FIELDS = Object.freeze([
  'price',
  'oldPrice',
  'reservedQuantity',
  'orderedQuantity',
  'effectiveIsSellable',
]);
const UOM_ATTRIBUTES = ['id', 'code', 'name', 'symbol', 'family', 'baseUnitCode', 'factor', 'precision'];

// asText: выполняет вспомогательную бизнес-логику сервиса.
function asText(value) {
  if (value === undefined || value === null) return null;
  const next = String(value).trim();
  return next.length ? next : null;
}

// asUpperText: выполняет вспомогательную бизнес-логику сервиса.
function asUpperText(value, len = 3) {
  const next = asText(value);
  if (!next) return null;
  return next.toUpperCase().slice(0, len);
}

// asNumber: выполняет вспомогательную бизнес-логику сервиса.
function asNumber(value, { min = null, max = null } = {}) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min !== null && n < min) return min;
  if (max !== null && n > max) return max;
  return n;
}

// roundMoney: выполняет вспомогательную бизнес-логику сервиса.
function roundMoney(value) {
  if (!Number.isFinite(Number(value))) return null;
  return Number(Number(value).toFixed(2));
}

// toDateOnly: выполняет вспомогательную бизнес-логику сервиса.
function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return value.trim();
  }

  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// todayDateOnly: выполняет вспомогательную бизнес-логику сервиса.
function todayDateOnly() {
  return new Date().toISOString().slice(0, 10);
}

// resolveEffectiveSellable: выполняет вспомогательную бизнес-логику сервиса.
function resolveEffectiveSellable({ manualSellable, saleStartDate, saleEndDate, currentDate }) {
  const manual = Boolean(manualSellable);
  if (!manual) return false;

  const start = toDateOnly(saleStartDate);
  const end = toDateOnly(saleEndDate);
  const today = toDateOnly(currentDate) || todayDateOnly();

  if (start && today < start) return false;
  if (end && today > end) return false;
  return true;
}

// applyEffectiveSellable: выполняет вспомогательную бизнес-логику сервиса.
function applyEffectiveSellable(productOrPlain, currentDate = todayDateOnly()) {
  if (!productOrPlain) return productOrPlain;

    // reader: выполняет вспомогательную бизнес-логику сервиса.
const reader = (field) => {
    if (typeof productOrPlain.get === 'function') return productOrPlain.get(field);
    return productOrPlain[field];
  };

  const effective = resolveEffectiveSellable({
    manualSellable: reader('isSellable'),
    saleStartDate: reader('saleStartDate'),
    saleEndDate: reader('saleEndDate'),
    currentDate,
  });

  if (typeof productOrPlain.setDataValue === 'function') {
    productOrPlain.setDataValue('effectiveIsSellable', effective);
  } else {
    productOrPlain.effectiveIsSellable = effective;
  }

  return productOrPlain;
}

// parseListQuery: парсит и нормализует входные параметры.
function parseListQuery(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page || 1, 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit || 25, 10) || 25));
  const rawSort = String(query.sort || 'createdAt');
  const sort = PRODUCT_SORT_FIELDS.has(rawSort) ? rawSort : 'createdAt';
  const dir = String(query.dir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  return {
    page,
    limit,
    offset: (page - 1) * limit,
    sort,
    dir,
  };
}

// parseBooleanQuery: парсит и нормализует входные параметры.
function parseBooleanQuery(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1') return true;
  if (normalized === 'false' || normalized === '0') return false;
  return null;
}

// toSlug: выполняет вспомогательную бизнес-логику сервиса.
function toSlug(input) {
  const src = String(input || '')
    .toLowerCase()
    .trim()
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return src || 'product';
}

// ensureUniqueSlug: выполняет вспомогательную бизнес-логику сервиса.
async function ensureUniqueSlug(companyId, baseSlug, excludeId = null) {
  let candidate = (baseSlug || 'product').slice(0, 280);
  let i = 1;

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const found = await Product.findOne({
      attributes: ['id'],
      where: {
        companyId,
        slug: candidate,
        ...(excludeId ? { id: { [Op.ne]: excludeId } } : {}),
      },
    });

    if (!found) return candidate;
    i += 1;
    candidate = `${baseSlug}-${i}`.slice(0, 280);
  }
}

// assertExistsInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertExistsInCompany(Model, companyId, id, label) {
  if (!id) return null;
  const row = await Model.findOne({ where: { id, companyId } });
  if (!row) {
    throw new AppError(404, `${label} not found`, { code: 'NOT_FOUND' });
  }
  return row;
}

// validateReferences: валидирует входные данные и выбрасывает ошибку при нарушениях.
async function validateReferences(companyId, payload = {}) {
  if (payload.brandId !== undefined && payload.brandId !== null && payload.brandId !== '') {
    await assertExistsInCompany(Brand, companyId, payload.brandId, 'Brand');
  }

  if (payload.primaryCategoryId !== undefined && payload.primaryCategoryId !== null && payload.primaryCategoryId !== '') {
    await assertExistsInCompany(Category, companyId, payload.primaryCategoryId, 'Category');
  }

  if (payload.subcategoryId !== undefined && payload.subcategoryId !== null && payload.subcategoryId !== '') {
    await assertExistsInCompany(Category, companyId, payload.subcategoryId, 'Subcategory');
  }

  if (payload.uomId !== undefined && payload.uomId !== null && payload.uomId !== '') {
    await assertExistsInCompany(Uom, companyId, payload.uomId, 'UOM');
  }

  if (payload.taxCategoryId !== undefined && payload.taxCategoryId !== null && payload.taxCategoryId !== '') {
    await assertExistsInCompany(TaxCategory, companyId, payload.taxCategoryId, 'Tax category');
  }

  if (payload.productTypeId !== undefined && payload.productTypeId !== null && payload.productTypeId !== '') {
    await assertExistsInCompany(ProductType, companyId, payload.productTypeId, 'Product type');
  }

  if (payload.shippingClassId !== undefined && payload.shippingClassId !== null && payload.shippingClassId !== '') {
    await assertExistsInCompany(ShippingClass, companyId, payload.shippingClassId, 'Shipping class');
  }

  if (payload.supplierId !== undefined && payload.supplierId !== null && payload.supplierId !== '') {
    await assertExistsInCompany(Counterparty, companyId, payload.supplierId, 'Supplier');
  }

  if (payload.replacedByProductId !== undefined && payload.replacedByProductId !== null && payload.replacedByProductId !== '') {
    await assertExistsInCompany(Product, companyId, payload.replacedByProductId, 'Replacement product');
  }
}

const productInclude = [
  { model: Brand, as: 'brand', attributes: ['id', 'name', 'slug'] },
  { model: Category, as: 'primaryCategory', attributes: ['id', 'name', 'slug', 'parentId'] },
  { model: Category, as: 'subcategory', attributes: ['id', 'name', 'slug', 'parentId'] },
  { model: Counterparty, as: 'supplier', attributes: ['id', 'shortName', 'fullName', 'type'] },
  { model: Uom, as: 'uom', attributes: UOM_ATTRIBUTES },
  { model: TaxCategory, as: 'taxCategory', attributes: ['id', 'name', 'rate'] },
  { model: ShippingClass, as: 'shippingClass', attributes: ['id', 'name', 'code'], required: false },
  { model: ProductType, as: 'type', attributes: ['id', 'name', 'code'], required: false },
  { model: Product, as: 'replacement', attributes: ['id', 'name', 'sku', 'slug'], required: false },
];

const PICKER_PRODUCT_ATTRIBUTES = [
  'id',
  'name',
  'sku',
  'barcode',
  'ean',
  'status',
  'currency',
  'cost',
  'brandId',
  'primaryCategoryId',
  'uomId',
  'updatedAt',
];
const PICKER_VARIANT_ATTRIBUTES = [
  'id',
  'productId',
  'name',
  'sku',
  'barcode',
  'ean',
  'currency',
  'price',
  'cost',
  'uomId',
  'isActive',
  'updatedAt',
];
const PICKER_PRODUCT_SEARCH_FIELDS = [
  'name',
  'sku',
  'barcode',
  'ean',
  'pkwiu',
  'cn',
  'hsCode',
  'gtu',
];

// hasModelAttribute: проверяет наличие поля в Sequelize-модели без предположений о схеме.
function hasModelAttribute(Model, field) {
  return Boolean(Model?.rawAttributes?.[field]);
}

// normalizePickerLimit: нормализует лимит picker-ответа.
function normalizePickerLimit(value) {
  const parsed = Number.parseInt(value || 20, 10);
  if (!Number.isFinite(parsed)) return 20;
  return Math.max(1, Math.min(50, parsed));
}

// numberOrZero: приводит decimal-значения БД к числам для DTO.
function numberOrZero(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// roundQty: округляет складские количества для picker DTO.
function roundQty(value) {
  return Math.round((numberOrZero(value) + Number.EPSILON) * 1e4) / 1e4;
}

// idText: безопасно приводит UUID к строковому ключу.
function idText(value) {
  return value === undefined || value === null ? '' : String(value);
}

// pickerKey: строит ключ product/variant для batch maps.
function pickerKey(productId, variantId = null) {
  return `${idText(productId)}|${variantId ? idText(variantId) : '__null__'}`;
}

// uniqueTexts: возвращает уникальные непустые строки с сохранением порядка.
function uniqueTexts(values = []) {
  const out = [];
  const seen = new Set();
  values.forEach((value) => {
    const text = asText(value);
    if (!text || seen.has(text)) return;
    seen.add(text);
    out.push(text);
  });
  return out;
}

// compactEntity: отдаёт компактный DTO для справочников.
function compactEntity(row, fields = ['id', 'name']) {
  if (!row) return null;
  const plain = row.get ? row.get({ plain: true }) : row;
  const out = {};
  fields.forEach((field) => {
    if (plain[field] !== undefined && plain[field] !== null) out[field] = plain[field];
  });
  return Object.keys(out).length ? out : null;
}

// compactUom: отдаёт лёгкий UOM DTO.
function compactUom(row) {
  return compactEntity(row, ['id', 'code', 'name', 'symbol']);
}

// buildVariantLabel: формирует человекочитаемый label варианта из существующих данных.
function buildVariantLabel(variant) {
  if (!variant) return null;
  const plain = variant.get ? variant.get({ plain: true }) : variant;
  const explicitName = asText(plain.name) || asText(plain.label);
  if (explicitName) return explicitName;

  const options = Array.isArray(plain.options) ? [...plain.options] : [];
  const label = options
    .sort((a, b) => Number(a?.sortOrder || 0) - Number(b?.sortOrder || 0))
    .map((option) => {
      const name = asText(option?.name);
      const value = asText(option?.value);
      if (name && value) return `${name}: ${value}`;
      return value || name;
    })
    .filter(Boolean)
    .join(', ');

  return label || asText(plain.sku) || null;
}

// buildStockMap: агрегирует остатки и резервы batch-ом по product/variant.
async function buildStockMap({ companyId, productIds, warehouseId = null }) {
  const safeProductIds = uniqueTexts(productIds);
  const out = new Map();
  safeProductIds.forEach((productId) => {
    out.set(pickerKey(productId, null), { onHand: 0, reserved: 0, available: 0 });
  });
  if (!safeProductIds.length) return out;

  const inventoryWhere = { companyId, productId: { [Op.in]: safeProductIds } };
  const reservationWhere = {
    companyId,
    productId: { [Op.in]: safeProductIds },
    status: 'active',
  };
  if (warehouseId) {
    inventoryWhere.warehouseId = warehouseId;
    reservationWhere.warehouseId = warehouseId;
  }

  const [inventoryRows, reservationRows] = await Promise.all([
    InventoryItem.findAll({
      where: inventoryWhere,
      attributes: [
        'productId',
        'variantId',
        [fn('SUM', col('qty_on_hand')), 'onHand'],
      ],
      group: ['product_id', 'variant_id'],
      raw: true,
    }),
    Reservation.findAll({
      where: reservationWhere,
      attributes: [
        'productId',
        'variantId',
        [fn('SUM', col('qty')), 'reserved'],
      ],
      group: ['product_id', 'variant_id'],
      raw: true,
    }),
  ]);

  inventoryRows.forEach((row) => {
    const key = pickerKey(row.productId, row.variantId || null);
    const current = out.get(key) || { onHand: 0, reserved: 0, available: 0 };
    current.onHand = roundQty(row.onHand);
    current.available = roundQty(current.onHand - current.reserved);
    out.set(key, current);
  });

  reservationRows.forEach((row) => {
    const key = pickerKey(row.productId, row.variantId || null);
    const current = out.get(key) || { onHand: 0, reserved: 0, available: 0 };
    current.reserved = roundQty(row.reserved);
    current.available = roundQty(current.onHand - current.reserved);
    out.set(key, current);
  });

  return out;
}

// buildExternalRefsMap: грузит внешние коды batch-ом.
async function buildExternalRefsMap({ companyId, productIds, variantIds }) {
  const safeProductIds = uniqueTexts(productIds);
  const safeVariantIds = uniqueTexts(variantIds);
  const out = new Map();
  if (!safeProductIds.length && !safeVariantIds.length) return out;

  const or = [];
  if (safeProductIds.length) or.push({ productId: { [Op.in]: safeProductIds } });
  if (safeVariantIds.length) or.push({ variantId: { [Op.in]: safeVariantIds } });

  const rows = await ProductExternalRef.findAll({
    where: { companyId, [Op.or]: or },
    attributes: ['productId', 'variantId', 'externalId'],
    order: [['createdAt', 'DESC']],
    raw: true,
  });

  rows.forEach((row) => {
    const key = pickerKey(row.productId, row.variantId || null);
    const list = out.get(key) || [];
    list.push(row.externalId);
    out.set(key, uniqueTexts(list));
  });

  return out;
}

// buildPurchasePriceMap: выбирает лучший доступный purchase price из ProductSupplier batch-ом.
async function buildPurchasePriceMap({ companyId, productIds, variantIds }) {
  const safeProductIds = uniqueTexts(productIds);
  const safeVariantIds = uniqueTexts(variantIds);
  const out = new Map();
  if (!safeProductIds.length) return out;

  const where = { companyId, productId: { [Op.in]: safeProductIds } };
  if (safeVariantIds.length) {
    where[Op.or] = [
      { variantId: { [Op.in]: safeVariantIds } },
      { variantId: { [Op.is]: null } },
    ];
  }

  const rows = await ProductSupplier.findAll({
    where,
    attributes: ['productId', 'variantId', 'price', 'currency', 'updatedAt', 'createdAt'],
    order: [['updatedAt', 'DESC'], ['createdAt', 'DESC']],
    raw: true,
  });

  rows.forEach((row) => {
    const value = roundMoney(row.price);
    if (value === null) return;
    const key = pickerKey(row.productId, row.variantId || null);
    if (out.has(key)) return;
    out.set(key, {
      value,
      currency: row.currency || 'PLN',
      source: row.variantId ? 'productSupplierVariant' : 'productSupplier',
    });
  });

  return out;
}

// buildThumbnailMap: возвращает только уже публичные product image URLs без нового signed-file pipeline.
async function buildThumbnailMap({ companyId, productIds }) {
  const safeProductIds = uniqueTexts(productIds);
  const out = new Map();
  if (!safeProductIds.length) return out;

  const rows = await ProductAttachment.findAll({
    where: {
      companyId,
      productId: { [Op.in]: safeProductIds },
      role: 'image',
    },
    attributes: ['productId', 'attachmentId', 'sortOrder'],
    include: [{
      model: File,
      attributes: ['id', 'visibility', 'publicKey', 'purpose', 'mime'],
      required: false,
    }],
    order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
  });

  rows.forEach((row) => {
    const productId = idText(row.productId);
    if (!productId || out.has(productId)) return;
    const file = row.File || row.file || row.attachment;
    if (file?.visibility === 'public' && file?.publicKey) {
      out.set(productId, `/api/public-files/${file.publicKey}`);
    }
  });

  return out;
}

// buildWritePayload: собирает служебную структуру для выполнения запроса.
async function buildWritePayload(companyId, payload = {}, existing = null) {
  const out = {};

  if (payload.name !== undefined) {
    const name = asText(payload.name);
    if (!name) {
      throw new AppError(400, 'Name is required', { code: 'VALIDATION_ERROR' });
    }
    out.name = name;
  }

  if (payload.slug !== undefined || (payload.name !== undefined && !existing)) {
    const source = asText(payload.slug) || asText(payload.name) || existing?.name;
    const baseSlug = toSlug(source);
    out.slug = await ensureUniqueSlug(companyId, baseSlug, existing?.id || null);
  }

  const nullableTextFields = [
    'sku',
    'barcode',
    'ean',
    'pkwiu',
    'cn',
    'gtu',
    'description',
    'hsCode',
    'countryOfOrigin',
    'dangerousGoodsClass',
    'unNumber',
  ];

  nullableTextFields.forEach((field) => {
    if (payload[field] !== undefined) {
      out[field] = asText(payload[field]);
    }
  });

  if (payload.saleStartDate !== undefined) out.saleStartDate = toDateOnly(payload.saleStartDate);
  if (payload.saleEndDate !== undefined) out.saleEndDate = toDateOnly(payload.saleEndDate);

  if (out.saleStartDate && out.saleEndDate && out.saleStartDate > out.saleEndDate) {
    throw new AppError(400, 'Sale end date must be after sale start date', {
      code: 'VALIDATION_ERROR',
    });
  }

  if (payload.currency !== undefined) {
    out.currency = asUpperText(payload.currency, 3) || (existing?.currency || 'PLN');
  }

  const decimalFields = [
    // Transitional fields, kept for compatibility with legacy clients.
    'price',
    'oldPrice',
    'cost',
    'weight',
    'length',
    'width',
    'height',
    'stockQuantity',
    'reservedQuantity',
    'orderedQuantity',
  ];

  decimalFields.forEach((field) => {
    if (payload[field] !== undefined) {
      out[field] = asNumber(payload[field], { min: 0 });
    }
  });

  if (payload.warrantyMonths !== undefined) {
    out.warrantyMonths = Math.max(0, Number.parseInt(payload.warrantyMonths, 10) || 0);
  }

  if (payload.shelfLifeDays !== undefined) {
    out.shelfLifeDays = Math.max(0, Number.parseInt(payload.shelfLifeDays, 10) || 0);
  }

  const boolFields = ['trackInventory', 'isSellable', 'isService', 'isSerialized', 'isLotTracked'];
  boolFields.forEach((field) => {
    if (payload[field] !== undefined) out[field] = Boolean(payload[field]);
  });

  const enumFields = {
    status: new Set(['draft', 'active', 'archived']),
    visibility: new Set(['public', 'private']),
  };

  Object.entries(enumFields).forEach(([field, allowed]) => {
    if (payload[field] === undefined) return;
    const next = String(payload[field] || '').trim();
    if (!allowed.has(next)) {
      throw new AppError(400, `${field} has invalid value`, { code: 'VALIDATION_ERROR' });
    }
    out[field] = next;
  });

  const relationFields = {
    brandId: payload.brandId,
    primaryCategoryId: payload.primaryCategoryId,
    subcategoryId: payload.subcategoryId,
    supplierId: payload.supplierId,
    uomId: payload.uomId,
    productTypeId: payload.productTypeId,
    taxCategoryId: payload.taxCategoryId,
    shippingClassId: payload.shippingClassId,
    replacedByProductId: payload.replacedByProductId,
  };

  Object.entries(relationFields).forEach(([key, value]) => {
    if (value === undefined) return;
    out[key] = asText(value);
  });

  if (out.replacedByProductId && existing?.id && String(out.replacedByProductId) === String(existing.id)) {
    throw new AppError(400, 'replacedByProductId cannot reference the same product', {
      code: 'VALIDATION_ERROR',
    });
  }

  if (payload.discontinuedAt !== undefined) {
    out.discontinuedAt = payload.discontinuedAt ? new Date(payload.discontinuedAt) : null;
  }

  return out;
}

// getProductOrThrow: возвращает данные по входным параметрам сервиса.
async function getProductOrThrow(companyId, id) {
  const row = await Product.findOne({ where: { id, companyId } });
  if (!row) throw new AppError(404, 'Product not found', { code: 'NOT_FOUND' });
  return row;
}

// computePricePair: выполняет вспомогательную бизнес-логику сервиса.
function computePricePair({ netPrice, grossPrice, vatRate }) {
  const rate = Number.isFinite(Number(vatRate)) ? Number(vatRate) : 0;
  const multiplier = 1 + rate / 100;

  const net = Number.isFinite(Number(netPrice))
    ? Number(netPrice)
    : Number.isFinite(Number(grossPrice))
      ? Number(grossPrice) / multiplier
      : null;

  const gross = Number.isFinite(Number(grossPrice))
    ? Number(grossPrice)
    : Number.isFinite(Number(net))
      ? Number(net) * multiplier
      : null;

  return {
    netPrice: roundMoney(net),
    grossPrice: roundMoney(gross),
    vatRate: rate,
  };
}

// resolveOrCreatePriceList: выполняет вспомогательную бизнес-логику сервиса.
async function resolveOrCreatePriceList(companyId, payload = {}, fallbackCurrency = 'PLN') {
  if (payload.priceListId) {
    const row = await PriceList.findOne({
      where: { id: payload.priceListId, companyId },
    });
    if (!row) {
      throw new AppError(404, 'Price list not found', { code: 'NOT_FOUND' });
    }
    return row;
  }

  const groupName = asText(payload.groupName);
  if (!groupName) {
    throw new AppError(400, 'priceListId or groupName is required', {
      code: 'VALIDATION_ERROR',
    });
  }

  const byName = await PriceList.findOne({
    where: {
      companyId,
      name: { [Op.iLike]: groupName },
    },
  });

  if (byName) return byName;

  const baseCode = toSlug(groupName).toUpperCase().replace(/-/g, '_').slice(0, 40) || 'SALE';
  let code = baseCode;
  let i = 1;

  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await PriceList.findOne({ where: { companyId, code } });
    if (!exists) break;
    i += 1;
    code = `${baseCode}_${i}`.slice(0, 40);
  }

  return PriceList.create({
    companyId,
    code,
    name: groupName,
    currency: asUpperText(payload.currency, 3) || asUpperText(fallbackCurrency, 3) || 'PLN',
    type: 'b2b',
    isActive: true,
  });
}

// toSpecValue: выполняет вспомогательную бизнес-логику сервиса.
function toSpecValue(spec) {
  if (spec.valueText !== null && spec.valueText !== undefined) return spec.valueText;
  if (spec.valueNumber !== null && spec.valueNumber !== undefined) return Number(spec.valueNumber);
  if (spec.valueBoolean !== null && spec.valueBoolean !== undefined) return Boolean(spec.valueBoolean);
  if (spec.valueDate !== null && spec.valueDate !== undefined) return spec.valueDate;
  if (spec.valueJson !== null && spec.valueJson !== undefined) return spec.valueJson;
  return '';
}

// specValueFields: выполняет вспомогательную бизнес-логику сервиса.
function specValueFields(attributeType, rawValue) {
  const fields = {
    valueText: null,
    valueNumber: null,
    valueBoolean: null,
    valueDate: null,
    valueJson: null,
  };

  if (attributeType === 'number') {
    fields.valueNumber = asNumber(rawValue);
    return fields;
  }

  if (attributeType === 'boolean') {
    fields.valueBoolean = Boolean(rawValue);
    return fields;
  }

  if (attributeType === 'date') {
    const d = rawValue ? new Date(rawValue) : null;
    fields.valueDate = d && !Number.isNaN(d.getTime()) ? d : null;
    return fields;
  }

  fields.valueText = rawValue === undefined || rawValue === null ? '' : String(rawValue);
  return fields;
}

// resolveAttribute: выполняет вспомогательную бизнес-логику сервиса.
async function resolveAttribute(companyId, payload = {}) {
  if (payload.attributeId) {
    const attr = await Attribute.findOne({
      where: { id: payload.attributeId, companyId },
    });
    if (!attr) {
      throw new AppError(404, 'Attribute not found', { code: 'NOT_FOUND' });
    }
    return attr;
  }

  const key = asText(payload.key);
  if (!key) {
    throw new AppError(400, 'attributeId or key is required', {
      code: 'VALIDATION_ERROR',
    });
  }

  const codeBase = `spec_${toSlug(key).replace(/-/g, '_').slice(0, 54)}`;

  let attr = await Attribute.findOne({
    where: {
      companyId,
      code: codeBase,
    },
  });

  if (attr) {
    if (attr.name !== key) {
      await attr.update({ name: key });
    }
    return attr;
  }

  let code = codeBase;
  let i = 1;
  while (true) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await Attribute.findOne({ where: { companyId, code } });
    if (!exists) break;
    i += 1;
    code = `${codeBase}_${i}`.slice(0, 60);
  }

  attr = await Attribute.create({
    companyId,
    code,
    name: key,
    type: 'text',
    isRequired: false,
    isVariant: false,
  });

  return attr;
}

// mapPurchasePriceRow: маппит закупочную цену в DTO для вкладки цен.
function mapPurchasePriceRow(row, product) {
  const supplierName = row?.supplier?.shortName || row?.supplier?.fullName || row?.supplierId || '—';
  const vatRate = Number(product?.taxCategory?.rate || 23);
  const netPrice = Number(row.price || 0);
  const grossPrice = roundMoney(netPrice * (1 + vatRate / 100));

  return {
    id: row.id,
    type: 'purchase',
    supplierId: row.supplierId,
    supplierName,
    priceListId: null,
    groupName: null,
    netPrice: roundMoney(netPrice),
    grossPrice,
    vatRate,
    currency: row.currency || product.currency || 'PLN',
    unit: product?.uom?.symbol || product?.uom?.code || product?.uom?.name || 'шт.',
    minQty: row.moq || 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// mapSalePriceRow: маппит продажную цену в DTO для вкладки цен.
function mapSalePriceRow(row, product) {
  const vatRate = Number(product?.taxCategory?.rate || 23);
  const netPrice = Number(row.price || 0);
  const grossPrice = roundMoney(netPrice * (1 + vatRate / 100));

  return {
    id: row.id,
    type: 'sale',
    supplierId: null,
    supplierName: null,
    priceListId: row.priceListId,
    groupName: row?.priceList?.name || row?.priceList?.code || 'Группа',
    netPrice: roundMoney(netPrice),
    grossPrice,
    vatRate,
    currency: row?.priceList?.currency || product.currency || 'PLN',
    unit: product?.uom?.symbol || product?.uom?.code || product?.uom?.name || 'шт.',
    minQty: row.minQty || 1,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async ({ query = {}, companyId }) => {
  const { page, limit, offset, sort, dir } = parseListQuery(query);
  const where = { companyId };
  const andConditions = [];

  const q = asText(query.search) || asText(query.q);
  if (q) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${q}%` } },
      { sku: { [Op.iLike]: `%${q}%` } },
      { barcode: { [Op.iLike]: `%${q}%` } },
      { ean: { [Op.iLike]: `%${q}%` } },
      { pkwiu: { [Op.iLike]: `%${q}%` } },
      { cn: { [Op.iLike]: `%${q}%` } },
      { gtu: { [Op.iLike]: `%${q}%` } },
    ];
  }

  if (query.brandId) where.brandId = query.brandId;
  if (query.categoryId) where.primaryCategoryId = query.categoryId;
  if (query.subcategoryId) where.subcategoryId = query.subcategoryId;
  if (query.supplierId) where.supplierId = query.supplierId;
  if (query.status) where.status = query.status;
  if (query.visibility) where.visibility = query.visibility;
  if (query.isSellable !== undefined) {
    const parsedSellable = parseBooleanQuery(query.isSellable);
    if (parsedSellable !== null) {
      const today = todayDateOnly();
      if (parsedSellable) {
        andConditions.push({
          isSellable: true,
        });
        andConditions.push({
          [Op.or]: [
            { saleStartDate: { [Op.is]: null } },
            { saleStartDate: { [Op.lte]: today } },
          ],
        });
        andConditions.push({
          [Op.or]: [
            { saleEndDate: { [Op.is]: null } },
            { saleEndDate: { [Op.gte]: today } },
          ],
        });
      } else {
        andConditions.push({
          [Op.or]: [
            { isSellable: false },
            { saleStartDate: { [Op.gt]: today } },
            { saleEndDate: { [Op.lt]: today } },
          ],
        });
      }
    }
  }

  if (andConditions.length) {
    where[Op.and] = [...(where[Op.and] || []), ...andConditions];
  }

  const { rows, count } = await Product.findAndCountAll({
    where,
    include: productInclude,
    order: [[sort, dir]],
    limit,
    offset,
  });

  rows.forEach((row) => applyEffectiveSellable(row));

  return { rows, count, page, limit };
};

// listPicker: возвращает лёгкие product/variant rows для переиспользуемого picker-а.
module.exports.listPicker = async ({ query = {}, companyId }) => {
  const limit = normalizePickerLimit(query.limit);
  const q = asText(query.q);
  const warehouseId = asText(query.warehouseId);
  const includeInactive = parseBooleanQuery(query.includeInactive) === true;
  const qLike = q ? `%${q}%` : null;

  const productIds = [];
  const matchedProductIds = new Set();
  const matchedVariantIds = new Set();

  const pushProductId = (id) => {
    const text = idText(id);
    if (!text || productIds.includes(text)) return;
    productIds.push(text);
  };

  if (qLike) {
    const productSearchFields = PICKER_PRODUCT_SEARCH_FIELDS.filter((field) => hasModelAttribute(Product, field));
    const productOr = productSearchFields.map((field) => ({ [field]: { [Op.iLike]: qLike } }));
    const productWhere = { companyId };
    if (!includeInactive && hasModelAttribute(Product, 'status')) {
      productWhere.status = { [Op.ne]: 'archived' };
    }
    if (productOr.length) productWhere[Op.or] = productOr;

    const [productMatches, optionMatches, variantDirectMatches, externalMatches] = await Promise.all([
      Product.findAll({
        where: productWhere,
        attributes: ['id'],
        order: [['updatedAt', 'DESC']],
        limit,
        raw: true,
      }),
      VariantOption.findAll({
        where: {
          companyId,
          [Op.or]: [
            { name: { [Op.iLike]: qLike } },
            { value: { [Op.iLike]: qLike } },
          ],
        },
        attributes: ['variantId'],
        limit: limit * 3,
        raw: true,
      }),
      ProductVariant.findAll({
        where: {
          companyId,
          ...(includeInactive ? {} : { isActive: true }),
          [Op.or]: [
            { name: { [Op.iLike]: qLike } },
            { sku: { [Op.iLike]: qLike } },
            { barcode: { [Op.iLike]: qLike } },
            { ean: { [Op.iLike]: qLike } },
          ],
        },
        attributes: ['id', 'productId'],
        limit: limit * 3,
        raw: true,
      }),
      ProductExternalRef.findAll({
        where: {
          companyId,
          externalId: { [Op.iLike]: qLike },
        },
        attributes: ['productId', 'variantId'],
        limit: limit * 3,
        raw: true,
      }),
    ]);

    productMatches.forEach((row) => {
      pushProductId(row.id);
      matchedProductIds.add(idText(row.id));
    });

    const optionVariantIds = uniqueTexts(optionMatches.map((row) => row.variantId));
    optionVariantIds.forEach((id) => matchedVariantIds.add(id));

    variantDirectMatches.forEach((row) => {
      pushProductId(row.productId);
      matchedVariantIds.add(idText(row.id));
    });

    externalMatches.forEach((row) => {
      if (row.productId) {
        pushProductId(row.productId);
        if (!row.variantId) matchedProductIds.add(idText(row.productId));
      }
      if (row.variantId) matchedVariantIds.add(idText(row.variantId));
    });

    const missingVariantIds = [...matchedVariantIds].filter(Boolean);
    if (missingVariantIds.length) {
      const variantsByOptionOrExternal = await ProductVariant.findAll({
        where: {
          companyId,
          id: { [Op.in]: missingVariantIds },
          ...(includeInactive ? {} : { isActive: true }),
        },
        attributes: ['id', 'productId'],
        raw: true,
      });
      variantsByOptionOrExternal.forEach((row) => {
        pushProductId(row.productId);
        matchedVariantIds.add(idText(row.id));
      });
    }
  } else {
    const productWhere = { companyId };
    if (!includeInactive && hasModelAttribute(Product, 'status')) {
      productWhere.status = { [Op.ne]: 'archived' };
    }
    const rows = await Product.findAll({
      where: productWhere,
      attributes: ['id'],
      order: [['updatedAt', 'DESC']],
      limit,
      raw: true,
    });
    rows.forEach((row) => pushProductId(row.id));
  }

  if (!productIds.length) {
    return {
      rows: [],
      meta: {
        limit,
        stockScope: warehouseId ? 'warehouse' : 'company',
        thumbnailSource: 'publicProductAttachmentOnly',
      },
    };
  }

  const variantInclude = {
    model: ProductVariant,
    as: 'variants',
    attributes: PICKER_VARIANT_ATTRIBUTES.filter((field) => hasModelAttribute(ProductVariant, field)),
    required: false,
    include: [
      { model: Uom, as: 'uom', attributes: UOM_ATTRIBUTES, required: false },
      {
        model: VariantOption,
        as: 'options',
        attributes: ['id', 'name', 'value', 'sortOrder'],
        required: false,
      },
    ],
  };
  if (!includeInactive) variantInclude.where = { isActive: true };

  const products = await Product.findAll({
    where: { companyId, id: { [Op.in]: productIds } },
    attributes: PICKER_PRODUCT_ATTRIBUTES.filter((field) => hasModelAttribute(Product, field)),
    include: [
      { model: Brand, as: 'brand', attributes: ['id', 'name', 'slug'], required: false },
      { model: Category, as: 'primaryCategory', attributes: ['id', 'name', 'slug', 'parentId'], required: false },
      { model: Uom, as: 'uom', attributes: UOM_ATTRIBUTES, required: false },
      variantInclude,
    ],
    order: [['updatedAt', 'DESC']],
  });

  const productOrder = new Map(productIds.map((id, index) => [String(id), index]));
  products.sort((a, b) => (
    (productOrder.get(String(a.id)) ?? 9999) - (productOrder.get(String(b.id)) ?? 9999)
  ));

  const allVariantIds = [];
  products.forEach((product) => {
    (product.variants || []).forEach((variant) => allVariantIds.push(variant.id));
  });

  const [stockMap, externalRefsMap, purchasePriceMap, thumbnailMap] = await Promise.all([
    buildStockMap({ companyId, productIds, warehouseId }),
    buildExternalRefsMap({ companyId, productIds, variantIds: allVariantIds }),
    buildPurchasePriceMap({ companyId, productIds, variantIds: allVariantIds }),
    buildThumbnailMap({ companyId, productIds }),
  ]);

  const rows = [];

  const makeRow = (product, variant = null) => {
    const productId = idText(product.id);
    const variantId = variant ? idText(variant.id) : null;
    const exactKey = pickerKey(productId, variantId);
    const productKey = pickerKey(productId, null);
    const emptyStock = { onHand: 0, reserved: 0, available: 0 };
    const stock = variantId
      ? stockMap.get(exactKey) || emptyStock
      : stockMap.get(productKey) || emptyStock;
    const variantExternalCodes = variantId ? externalRefsMap.get(exactKey) || [] : [];
    const productExternalCodes = externalRefsMap.get(productKey) || [];
    const variantCost = variantId ? roundMoney(variant?.cost) : null;
    const purchasePrice = (
      (variantId ? purchasePriceMap.get(exactKey) : null)
      || purchasePriceMap.get(productKey)
      || (variantCost !== null
        ? { value: variantCost, currency: variant?.currency || product.currency || 'PLN', source: 'variantCost' }
        : null)
      || (roundMoney(product.cost) !== null
        ? { value: roundMoney(product.cost), currency: product.currency || 'PLN', source: 'productCost' }
        : null)
    );
    const uom = variant?.uom || product.uom || null;

    return {
      productId,
      variantId,
      productName: product.name || null,
      variantLabel: variant ? buildVariantLabel(variant) : null,
      sku: product.sku || null,
      variantSku: variant?.sku || null,
      barcode: variant?.barcode || product.barcode || null,
      ean: variant?.ean || product.ean || null,
      externalCodes: uniqueTexts([...productExternalCodes, ...variantExternalCodes]),
      brand: compactEntity(product.brand, ['id', 'name', 'slug']),
      category: compactEntity(product.primaryCategory, ['id', 'name', 'slug', 'parentId']),
      uom: compactUom(uom),
      stock: {
        onHand: roundQty(stock.onHand),
        reserved: roundQty(stock.reserved),
        available: roundQty(stock.available),
      },
      purchasePrice,
      thumbnailUrl: thumbnailMap.get(productId) || null,
    };
  };

  products.forEach((product) => {
    const variants = Array.isArray(product.variants) ? product.variants : [];
    if (!variants.length) {
      if (!qLike || matchedProductIds.has(idText(product.id))) {
        rows.push(makeRow(product, null));
      }
      return;
    }

    const shouldIncludeAllVariants = !qLike || matchedProductIds.has(idText(product.id));
    const selectedVariants = shouldIncludeAllVariants
      ? variants
      : variants.filter((variant) => matchedVariantIds.has(idText(variant.id)));

    selectedVariants.forEach((variant) => rows.push(makeRow(product, variant)));
  });

  return {
    rows: rows.slice(0, limit),
    meta: {
      limit,
      stockScope: warehouseId ? 'warehouse' : 'company',
      thumbnailSource: 'publicProductAttachmentOnly',
    },
  };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (companyId, id) => {
  const row = await Product.findOne({
    where: { id, companyId },
    include: productInclude,
  });
  return applyEffectiveSellable(row);
};

// create: создаёт новую запись и возвращает результат.
module.exports.create = async ({ companyId, payload = {} }) => {
  await validateReferences(companyId, payload);
  const data = await buildWritePayload(companyId, payload, null);

  if (!data.slug) {
    data.slug = await ensureUniqueSlug(companyId, toSlug(data.name || payload.name || 'product'));
  }

  const created = await Product.create({
    companyId,
    ...data,
  });

  return module.exports.getById(companyId, created.id);
};

// update: обновляет запись и возвращает актуальные данные.
module.exports.update = async ({ companyId, id, payload = {} }) => {
  const row = await getProductOrThrow(companyId, id);
  await validateReferences(companyId, payload);

  const patch = await buildWritePayload(companyId, payload, row);
  if (!Object.keys(patch).length) {
    return module.exports.getById(companyId, id);
  }

  await row.update(patch);
  return module.exports.getById(companyId, id);
};

// publish: выполняет вспомогательную бизнес-логику сервиса.
module.exports.publish = async (companyId, id) => {
  await getProductOrThrow(companyId, id);
  await Product.update(
    { status: 'active', publishedAt: sequelize.fn('NOW') },
    { where: { companyId, id } }
  );
};

// archive: выполняет вспомогательную бизнес-логику сервиса.
module.exports.archive = async (companyId, id) => {
  await getProductOrThrow(companyId, id);
  await Product.update({ status: 'archived' }, { where: { companyId, id } });
};

// duplicate: выполняет вспомогательную бизнес-логику сервиса.
module.exports.duplicate = (companyId, id, { skuSuffix = '-COPY' } = {}) =>
  withTx(async (t) => {
    const src = await Product.findOne({
      where: { companyId, id },
      include: [{ model: ProductVariant, as: 'variants' }],
      transaction: t,
    });
    if (!src) return null;

    const copyName = `${src.name} copy`;
    const copySlug = await ensureUniqueSlug(companyId, toSlug(copyName));

    const copy = await Product.create(
      {
        companyId,
        name: copyName,
        slug: copySlug,
        sku: src.sku ? `${src.sku}${skuSuffix}` : null,
        status: 'draft',
        currency: src.currency || 'PLN',
      },
      { transaction: t }
    );

    for (const variant of src.variants || []) {
      // eslint-disable-next-line no-await-in-loop
      await ProductVariant.create(
        {
          companyId,
          productId: copy.id,
          name: variant.name,
          sku: variant.sku ? `${variant.sku}${skuSuffix}` : null,
        },
        { transaction: t }
      );
    }

    return copy;
  }, null);

// variantMatrix: выполняет вспомогательную бизнес-логику сервиса.
module.exports.variantMatrix = (companyId, productId, attrs = [], opts = {}, tx = null) =>
  withTx(async (t) => {
    const product = await Product.findOne({
      where: { companyId, id: productId },
      transaction: t,
    });

    if (!product) return null;

    const combos = attrs.reduce((acc, attr) => {
      if (!attr.options?.length) return acc;
      const next = [];
      for (const combo of acc) {
        for (const option of attr.options) {
          next.push([...combo, { attr, option }]);
        }
      }
      return next;
    }, [[]]);

    const baseSku = opts.baseSku || product.sku || 'PRD';
    const skuPattern = opts.skuPattern || '${base}-${codes}';
    const created = [];

    for (const combo of combos) {
      const codes = combo
        .map((x) => x.option.code || x.option.value)
        .join('-')
        .toUpperCase();
      const sku = skuPattern.replace('${base}', baseSku).replace('${codes}', codes);

      // eslint-disable-next-line no-await-in-loop
      const variant = await ProductVariant.create(
        { companyId, productId, sku },
        { transaction: t }
      );

      // eslint-disable-next-line no-await-in-loop
      await VariantOption.bulkCreate(
        combo.map((x) => ({
          companyId,
          variantId: variant.id,
          name: x.attr.name,
          value: x.option.value,
        })),
        { transaction: t }
      );

      created.push(variant);
    }

    return created;
  }, tx);

// upsertAttrs: выполняет вспомогательную бизнес-логику сервиса.
module.exports.upsertAttrs = (companyId, productId, values = [], tx = null) =>
  withTx(async (t) => {
    await getProductOrThrow(companyId, productId);

    await ProductAttributeValue.destroy({
      where: { companyId, productId },
      transaction: t,
    });

    if (Array.isArray(values) && values.length > 0) {
      await ProductAttributeValue.bulkCreate(
        values.map((item) => ({
          ...item,
          companyId,
          productId,
        })),
        { transaction: t }
      );
    }

    return Product.findOne({
      where: { companyId, id: productId },
      include: [{ model: ProductAttributeValue, as: 'attributes' }],
      transaction: t,
    });
  }, tx);

// listPrices: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.listPrices = async ({ companyId, productId }) => {
  const product = await Product.findOne({
    where: { id: productId, companyId },
    include: [
      { model: Uom, as: 'uom', attributes: UOM_ATTRIBUTES },
      { model: TaxCategory, as: 'taxCategory', attributes: ['id', 'name', 'rate'] },
    ],
  });

  if (!product) {
    throw new AppError(404, 'Product not found', { code: 'NOT_FOUND' });
  }

  const [purchaseRows, saleRows] = await Promise.all([
    ProductSupplier.findAll({
      where: { companyId, productId },
      include: [
        {
          model: Counterparty,
          as: 'supplier',
          attributes: ['id', 'shortName', 'fullName', 'type'],
        },
      ],
      order: [['createdAt', 'DESC']],
    }),
    PriceListItem.findAll({
      where: { companyId, productId },
      include: [
        {
          model: PriceList,
          as: 'priceList',
          attributes: ['id', 'name', 'code', 'currency', 'type'],
        },
      ],
      order: [['createdAt', 'DESC']],
    }),
  ]);

  return {
    purchase: purchaseRows.map((row) => mapPurchasePriceRow(row, product)),
    sale: saleRows.map((row) => mapSalePriceRow(row, product)),
    meta: {
      sourceOfTruth: 'price-module',
      deprecatedProductFields: PRODUCT_DEPRECATED_FIELDS,
      transitionalProductFields: {
        price: product?.price ?? null,
        oldPrice: product?.oldPrice ?? null,
        cost: product?.cost ?? null,
      },
    },
  };
};

// createPrice: создаёт новую запись и возвращает результат.
module.exports.createPrice = async ({ companyId, productId, payload = {} }) => {
  const product = await Product.findOne({
    where: { id: productId, companyId },
    include: [
      { model: Uom, as: 'uom', attributes: UOM_ATTRIBUTES },
      { model: TaxCategory, as: 'taxCategory', attributes: ['id', 'name', 'rate'] },
    ],
  });

  if (!product) throw new AppError(404, 'Product not found', { code: 'NOT_FOUND' });

  const vatRate = Number.isFinite(Number(payload.vatRate))
    ? Number(payload.vatRate)
    : Number(product?.taxCategory?.rate || 23);

  const pair = computePricePair({
    netPrice: payload.netPrice,
    grossPrice: payload.grossPrice,
    vatRate,
  });

  if (pair.netPrice === null) {
    throw new AppError(400, 'netPrice or grossPrice is required', {
      code: 'VALIDATION_ERROR',
    });
  }

  if (payload.type === 'purchase') {
    await assertExistsInCompany(Counterparty, companyId, payload.supplierId, 'Supplier');

    const row = await ProductSupplier.create({
      companyId,
      productId,
      supplierId: payload.supplierId,
      currency: asUpperText(payload.currency, 3) || product.currency || 'PLN',
      price: pair.netPrice,
      moq: Math.max(1, Number.parseInt(payload.minQty || 1, 10) || 1),
    });

    const created = await ProductSupplier.findOne({
      where: { id: row.id, companyId },
      include: [
        {
          model: Counterparty,
          as: 'supplier',
          attributes: ['id', 'shortName', 'fullName', 'type'],
        },
      ],
    });

    return mapPurchasePriceRow(created, product);
  }

  const priceList = await resolveOrCreatePriceList(companyId, payload, product.currency || 'PLN');
  const minQty = Math.max(1, Number.parseInt(payload.minQty || 1, 10) || 1);

  let row = await PriceListItem.findOne({
    where: {
      companyId,
      priceListId: priceList.id,
      productId,
      variantId: null,
      minQty,
    },
  });

  if (row) {
    await row.update({ price: pair.netPrice });
  } else {
    row = await PriceListItem.create({
      companyId,
      priceListId: priceList.id,
      productId,
      minQty,
      price: pair.netPrice,
    });
  }

  const created = await PriceListItem.findOne({
    where: { id: row.id, companyId },
    include: [
      {
        model: PriceList,
        as: 'priceList',
        attributes: ['id', 'name', 'code', 'currency', 'type'],
      },
    ],
  });

  return mapSalePriceRow(created, product);
};

// updatePrice: обновляет запись и возвращает актуальные данные.
module.exports.updatePrice = async ({ companyId, productId, priceId, payload = {} }) => {
  const product = await Product.findOne({
    where: { id: productId, companyId },
    include: [
      { model: Uom, as: 'uom', attributes: UOM_ATTRIBUTES },
      { model: TaxCategory, as: 'taxCategory', attributes: ['id', 'name', 'rate'] },
    ],
  });
  if (!product) throw new AppError(404, 'Product not found', { code: 'NOT_FOUND' });

  const purchase = await ProductSupplier.findOne({ where: { id: priceId, companyId, productId } });

  if (purchase) {
    if (payload.supplierId !== undefined) {
      await assertExistsInCompany(Counterparty, companyId, payload.supplierId, 'Supplier');
      purchase.supplierId = asText(payload.supplierId);
    }

    if (payload.currency !== undefined) {
      purchase.currency = asUpperText(payload.currency, 3) || purchase.currency;
    }

    if (payload.minQty !== undefined) {
      purchase.moq = Math.max(1, Number.parseInt(payload.minQty, 10) || 1);
    }

    if (payload.netPrice !== undefined || payload.grossPrice !== undefined || payload.vatRate !== undefined) {
      const rate = Number.isFinite(Number(payload.vatRate))
        ? Number(payload.vatRate)
        : Number(product?.taxCategory?.rate || 23);
      const pair = computePricePair({
        netPrice: payload.netPrice !== undefined ? payload.netPrice : purchase.price,
        grossPrice: payload.grossPrice,
        vatRate: rate,
      });
      purchase.price = pair.netPrice;
    }

    await purchase.save();

    const fresh = await ProductSupplier.findOne({
      where: { id: purchase.id, companyId },
      include: [{ model: Counterparty, as: 'supplier', attributes: ['id', 'shortName', 'fullName', 'type'] }],
    });

    return mapPurchasePriceRow(fresh, product);
  }

  const sale = await PriceListItem.findOne({ where: { id: priceId, companyId, productId } });
  if (!sale) {
    throw new AppError(404, 'Price not found', { code: 'NOT_FOUND' });
  }

  if (payload.priceListId !== undefined || payload.groupName !== undefined) {
    const list = await resolveOrCreatePriceList(companyId, payload, product.currency || 'PLN');
    sale.priceListId = list.id;
  }

  if (payload.minQty !== undefined) {
    sale.minQty = Math.max(1, Number.parseInt(payload.minQty, 10) || 1);
  }

  if (payload.netPrice !== undefined || payload.grossPrice !== undefined || payload.vatRate !== undefined) {
    const rate = Number.isFinite(Number(payload.vatRate))
      ? Number(payload.vatRate)
      : Number(product?.taxCategory?.rate || 23);
    const pair = computePricePair({
      netPrice: payload.netPrice !== undefined ? payload.netPrice : sale.price,
      grossPrice: payload.grossPrice,
      vatRate: rate,
    });
    sale.price = pair.netPrice;
  }

  await sale.save();

  const fresh = await PriceListItem.findOne({
    where: { id: sale.id, companyId },
    include: [{ model: PriceList, as: 'priceList', attributes: ['id', 'name', 'code', 'currency', 'type'] }],
  });

  return mapSalePriceRow(fresh, product);
};

// removePrice: удаляет запись с учётом бизнес-ограничений.
module.exports.removePrice = async ({ companyId, productId, priceId }) => {
  const purchaseDeleted = await ProductSupplier.destroy({
    where: { id: priceId, companyId, productId },
  });
  if (purchaseDeleted) return true;

  const saleDeleted = await PriceListItem.destroy({
    where: { id: priceId, companyId, productId },
  });
  return Boolean(saleDeleted);
};

// listSpecifications: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.listSpecifications = async ({ companyId, productId }) => {
  await getProductOrThrow(companyId, productId);

  const rows = await ProductAttributeValue.findAll({
    where: { companyId, productId },
    include: [
      {
        model: Attribute,
        as: 'attribute',
        attributes: ['id', 'code', 'name', 'type', 'unit'],
      },
    ],
    order: [[{ model: Attribute, as: 'attribute' }, 'name', 'ASC']],
  });

  return rows.map((row) => ({
    id: row.id,
    attributeId: row.attributeId,
    key: row?.attribute?.name || row?.attribute?.code || 'Свойство',
    code: row?.attribute?.code || null,
    type: row?.attribute?.type || 'text',
    value: toSpecValue(row),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }));
};

// createSpecification: создаёт новую запись и возвращает результат.
module.exports.createSpecification = async ({ companyId, productId, payload = {} }) => {
  await getProductOrThrow(companyId, productId);
  const attribute = await resolveAttribute(companyId, payload);

  const fields = specValueFields(attribute.type, payload.value);

  let row = await ProductAttributeValue.findOne({
    where: {
      companyId,
      productId,
      attributeId: attribute.id,
    },
  });

  if (row) {
    await row.update(fields);
  } else {
    row = await ProductAttributeValue.create({
      companyId,
      productId,
      attributeId: attribute.id,
      ...fields,
    });
  }

  const fresh = await ProductAttributeValue.findOne({
    where: { id: row.id, companyId, productId },
    include: [{ model: Attribute, as: 'attribute', attributes: ['id', 'code', 'name', 'type', 'unit'] }],
  });

  return {
    id: fresh.id,
    attributeId: fresh.attributeId,
    key: fresh?.attribute?.name || fresh?.attribute?.code || 'Свойство',
    code: fresh?.attribute?.code || null,
    type: fresh?.attribute?.type || 'text',
    value: toSpecValue(fresh),
    createdAt: fresh.createdAt,
    updatedAt: fresh.updatedAt,
  };
};

// updateSpecification: обновляет запись и возвращает актуальные данные.
module.exports.updateSpecification = async ({ companyId, productId, specificationId, payload = {} }) => {
  await getProductOrThrow(companyId, productId);

  const row = await ProductAttributeValue.findOne({
    where: { id: specificationId, companyId, productId },
    include: [{ model: Attribute, as: 'attribute', attributes: ['id', 'code', 'name', 'type', 'unit'] }],
  });

  if (!row) {
    throw new AppError(404, 'Specification not found', { code: 'NOT_FOUND' });
  }

  let attribute = row.attribute;
  if (payload.attributeId !== undefined || payload.key !== undefined) {
    attribute = await resolveAttribute(companyId, payload);
    row.attributeId = attribute.id;
  }

  if (payload.value !== undefined) {
    const fields = specValueFields(attribute.type, payload.value);
    row.valueText = fields.valueText;
    row.valueNumber = fields.valueNumber;
    row.valueBoolean = fields.valueBoolean;
    row.valueDate = fields.valueDate;
    row.valueJson = fields.valueJson;
  }

  await row.save();

  const fresh = await ProductAttributeValue.findOne({
    where: { id: row.id, companyId, productId },
    include: [{ model: Attribute, as: 'attribute', attributes: ['id', 'code', 'name', 'type', 'unit'] }],
  });

  return {
    id: fresh.id,
    attributeId: fresh.attributeId,
    key: fresh?.attribute?.name || fresh?.attribute?.code || 'Свойство',
    code: fresh?.attribute?.code || null,
    type: fresh?.attribute?.type || 'text',
    value: toSpecValue(fresh),
    createdAt: fresh.createdAt,
    updatedAt: fresh.updatedAt,
  };
};

// removeSpecification: удаляет запись с учётом бизнес-ограничений.
module.exports.removeSpecification = async ({ companyId, productId, specificationId }) => {
  const deleted = await ProductAttributeValue.destroy({
    where: { id: specificationId, companyId, productId },
  });
  return Boolean(deleted);
};

// listMovements: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.listMovements = async ({ companyId, productId, query = {} }) => {
  await getProductOrThrow(companyId, productId);

  const page = Math.max(1, Number.parseInt(query.page || 1, 10) || 1);
  const limit = Math.max(1, Math.min(100, Number.parseInt(query.limit || 50, 10) || 50));
  const offset = (page - 1) * limit;

  const { rows, count } = await StockMove.findAndCountAll({
    where: { companyId, productId },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  const warehouseIds = [...new Set(rows.map((row) => row.warehouseId).filter(Boolean))];
  const warehouses = warehouseIds.length
    ? await Warehouse.findAll({
      where: { companyId, id: { [Op.in]: warehouseIds } },
      attributes: ['id', 'code', 'name'],
    })
    : [];

  const warehouseMap = new Map(warehouses.map((item) => [String(item.id), item]));

  const mapped = rows.map((row) => {
    const warehouse = warehouseMap.get(String(row.warehouseId || ''));
    return {
      id: row.id,
      type: row.type,
      qty: row.qty,
      warehouseId: row.warehouseId,
      warehouseName: warehouse?.name || warehouse?.code || row.warehouseId || null,
      fromLocationId: row.fromLocationId,
      toLocationId: row.toLocationId,
      refType: row.refType,
      refId: row.refId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });

  return { rows: mapped, count, page, limit };
};
