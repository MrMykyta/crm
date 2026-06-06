export const LINE_TYPE_LABELS = Object.freeze({
  product: 'Product',
  service: 'Service',
  custom: 'Custom',
  fee: 'Fee',
  discount: 'Discount',
});

export function asBool(value) {
  return value === true || value === 'true' || value === 1 || value === '1';
}

export function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function getLineTypeLabel(lineType) {
  return LINE_TYPE_LABELS[lineType] || LINE_TYPE_LABELS.custom;
}

export function getProductInventoryKind(product = {}) {
  if (asBool(product?.isService)) return 'service';
  if (asBool(product?.trackInventory)) return 'stock';
  return 'nonStock';
}

export function getProductInventoryLabel(product = {}) {
  const kind = getProductInventoryKind(product);
  if (kind === 'service') return 'Service';
  if (kind === 'stock') return 'Stock';
  return 'Non-stock';
}

export function getProductLineSemantics(product = {}) {
  const kind = getProductInventoryKind(product);
  if (kind === 'service') {
    return {
      lineType: 'service',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
    };
  }

  const affectsInventory = kind === 'stock';
  return {
    lineType: 'product',
    affectsInventory,
    isStockTrackedSnapshot: affectsInventory,
  };
}

export function getCustomLineSemantics() {
  return {
    lineType: 'custom',
    affectsInventory: false,
    isStockTrackedSnapshot: false,
  };
}

export function normalizeLineSemantics(item = {}) {
  if (!item?.productId) {
    const lineType = ['custom', 'fee', 'discount'].includes(item?.lineType) ? item.lineType : 'custom';
    return {
      lineType,
      affectsInventory: false,
      isStockTrackedSnapshot: false,
    };
  }

  const lineType = item?.lineType || (asBool(item?.isServiceSnapshot) ? 'service' : 'product');
  if (lineType === 'service') {
    return {
      lineType: 'service',
      affectsInventory: false,
      isStockTrackedSnapshot: false,
    };
  }

  return {
    lineType,
    affectsInventory: asBool(item?.affectsInventory),
    isStockTrackedSnapshot: asBool(item?.isStockTrackedSnapshot),
  };
}

export function isInventoryLine(item = {}) {
  return Boolean(item?.productId) && asBool(item?.affectsInventory);
}

export function getAvailabilitySnapshot(productOrItem = {}) {
  const meta = productOrItem?.metadataSnapshot || productOrItem?.metadata || productOrItem?.meta || {};
  const stockQuantity = asNumber(
    productOrItem?.stockQuantity ?? meta?.stockQuantity ?? meta?.stock_quantity,
    0
  );
  const reservedQuantity = asNumber(
    productOrItem?.reservedQuantity ?? meta?.reservedQuantity ?? meta?.reserved_quantity,
    0
  );
  return {
    stockQuantity,
    reservedQuantity,
    availableQuantity: stockQuantity - reservedQuantity,
  };
}

export function buildProductMetadataSnapshot(product = {}) {
  const base = product?.metadata || product?.meta || {};
  const availability = getAvailabilitySnapshot(product);
  return {
    ...(base && typeof base === 'object' && !Array.isArray(base) ? base : {}),
    stockQuantity: availability.stockQuantity,
    reservedQuantity: availability.reservedQuantity,
    availableQuantity: availability.availableQuantity,
    trackInventory: asBool(product?.trackInventory),
    isService: asBool(product?.isService),
  };
}
