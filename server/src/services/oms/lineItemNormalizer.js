'use strict';

const { Op } = require('sequelize');
const AppError = require('../../errors/AppError');
const {
  Product,
  ProductVariant,
  Uom,
  TaxCategory,
  ProductType,
} = require('../../models');

const LINE_TYPES = Object.freeze(['product', 'service', 'custom', 'fee', 'discount']);

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asOptionalText(value) {
  const text = asText(value);
  return text || null;
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeLineType(value) {
  const lineType = asText(value).toLowerCase();
  if (!lineType) return null;
  if (!LINE_TYPES.includes(lineType)) {
    throw new AppError(400, `Unsupported lineType "${value}"`, { code: 'VALIDATION_ERROR' });
  }
  return lineType;
}

function pickMetadata(input, product, variant) {
  if (input.metadataSnapshot && typeof input.metadataSnapshot === 'object') {
    return input.metadataSnapshot;
  }
  const metadata = {};
  if (product?.id) metadata.productId = product.id;
  if (variant?.id) metadata.variantId = variant.id;
  if (product?.barcode) metadata.barcode = product.barcode;
  if (product?.ean) metadata.ean = product.ean;
  if (variant?.barcode) metadata.variantBarcode = variant.barcode;
  return Object.keys(metadata).length ? metadata : null;
}

async function loadProductContext({ companyId, productId, variantId, transaction }) {
  if (!productId) {
    return { product: null, variant: null };
  }

  const product = await Product.findOne({
    where: { id: productId, companyId },
    include: [
      { model: Uom, as: 'uom', attributes: ['id', 'code', 'name', 'symbol'], required: false },
      { model: TaxCategory, as: 'taxCategory', attributes: ['id', 'code', 'name', 'rate'], required: false },
      { model: ProductType, as: 'type', attributes: ['id', 'name', 'code'], required: false },
    ],
    transaction,
  });
  if (!product) {
    throw new AppError(400, `productId ${productId} is invalid`, { code: 'VALIDATION_ERROR' });
  }

  let variant = null;
  if (variantId) {
    variant = await ProductVariant.findOne({
      where: {
        id: variantId,
        companyId,
        productId,
        [Op.or]: [{ isActive: true }, { isActive: null }],
      },
      include: [
        { model: Uom, as: 'uom', attributes: ['id', 'code', 'name', 'symbol'], required: false },
      ],
      transaction,
    });
    if (!variant) {
      throw new AppError(400, `variantId ${variantId} is invalid`, { code: 'VALIDATION_ERROR' });
    }
  }

  return { product, variant };
}

function buildSnapshots(input, product, variant) {
  const unit = variant?.uom || product?.uom || null;
  const taxCategory = product?.taxCategory || null;
  return {
    skuSnapshot: asOptionalText(input.skuSnapshot || input.sku || variant?.sku || product?.sku),
    nameSnapshot: asOptionalText(input.nameSnapshot || input.name || product?.name),
    descriptionSnapshot: asOptionalText(input.descriptionSnapshot || input.description || product?.description),
    unitSnapshot: asOptionalText(
      input.unitSnapshot || input.unit || unit?.symbol || unit?.code || unit?.name
    ),
    vatRateSnapshot: asNumber(
      input.taxRate ?? input.vatRate ?? input.vatRateSnapshot ?? taxCategory?.rate ?? 0,
      0
    ),
    taxRate: asNumber(
      input.taxRate ?? input.vatRate ?? input.vatRateSnapshot ?? taxCategory?.rate ?? 0,
      0
    ),
    productTypeSnapshot: asOptionalText(
      input.productTypeSnapshot || input.productType || product?.type?.code || product?.type?.name
    ),
    metadataSnapshot: pickMetadata(input, product, variant),
    taxCategoryId: asOptionalText(input.taxCategoryId) || product?.taxCategoryId || taxCategory?.id || null,
    unitId: asOptionalText(input.unitId || input.uomId) || variant?.uomId || product?.uomId || null,
  };
}

function resolveLineSemantics(input, product) {
  const explicitLineType = normalizeLineType(input.lineType);
  const hasProduct = Boolean(product?.id || asOptionalText(input.productId));

  let lineType = explicitLineType;
  if (!lineType) {
    if (!hasProduct) {
      lineType = 'custom';
    } else if (product?.isService === true) {
      lineType = 'service';
    } else {
      lineType = 'product';
    }
  }

  if (lineType === 'product' && product?.isService === true) {
    lineType = 'service';
  }

  const hasHistoricalFlags = (
    input.__preserveLineSemantics === true
    && input.affectsInventory !== undefined
    && input.isStockTrackedSnapshot !== undefined
  );
  if (explicitLineType && hasHistoricalFlags) {
    return {
      lineType,
      affectsInventory: Boolean(input.affectsInventory),
      isStockTrackedSnapshot: Boolean(input.isStockTrackedSnapshot),
    };
  }

  const isStockTrackedSnapshot = Boolean(product?.trackInventory);
  const affectsInventory = (
    lineType === 'product'
    && isStockTrackedSnapshot
    && product?.isService !== true
  );

  return {
    lineType,
    affectsInventory,
    isStockTrackedSnapshot,
  };
}

async function normalizeLineItemInput(input, {
  companyId,
  transaction,
  mode = 'order',
} = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new AppError(400, 'Line item must be an object', { code: 'VALIDATION_ERROR' });
  }
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }
  if (!['offer', 'order', 'invoice'].includes(mode)) {
    throw new AppError(400, `Unsupported line normalization mode "${mode}"`, { code: 'VALIDATION_ERROR' });
  }

  const productId = asOptionalText(input.productId);
  const variantId = asOptionalText(input.variantId);
  const { product, variant } = await loadProductContext({
    companyId,
    productId,
    variantId,
    transaction,
  });
  const snapshots = buildSnapshots(input, product, variant);
  const semantics = resolveLineSemantics(input, product);
  const isCustomLine = semantics.lineType === 'custom';

  if (!productId && !snapshots.nameSnapshot) {
    throw new AppError(400, 'nameSnapshot is required for custom line', {
      code: 'VALIDATION_ERROR',
    });
  }

  return {
    productId: productId || null,
    variantId: variantId || null,
    ...snapshots,
    ...semantics,
    isCustomLine,
    parentLineItemId: asOptionalText(input.parentLineItemId),
    sourceProduct: product,
    sourceVariant: variant,
  };
}

function isInventoryLine(item) {
  const qty = asNumber(item?.qty ?? item?.quantity, 0);
  return Boolean(
    item
    && item.affectsInventory === true
    && item.productId
    && qty > 0
  );
}

module.exports = {
  LINE_TYPES,
  normalizeLineItemInput,
  isInventoryLine,
};
