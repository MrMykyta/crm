function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNumber(value) {
  if (value === undefined || value === null || value === '') return '';
  const parsed = asNumber(value);
  if (parsed === null) return asText(value);
  return String(Math.round((parsed + Number.EPSILON) * 1e4) / 1e4);
}

function pickDate(...values) {
  return asText(values.find((value) => asText(value))).slice(0, 10);
}

function productName(item = {}) {
  return asText(item.product?.name || item.productName || item.nameSnapshot || item.name || item.productId);
}

function productSku(item = {}) {
  return asText(item.variant?.sku || item.product?.sku || item.variantSku || item.sku);
}

function variantLabel(item = {}) {
  return asText(item.variant?.name || item.variantName || item.variantLabel);
}

function locationLabel(location = {}, fallback = '') {
  return asText(location.label || location.code || location.name || fallback);
}

function ccLineKey(row = {}) {
  return [
    row?.locationId || 'null',
    row?.productId || 'null',
    row?.variantId || 'null',
    row?.lotId || 'null',
    row?.serialId || 'null',
  ].join('|');
}

function differenceValue(item = {}) {
  if (item.difference !== undefined && item.difference !== null && item.difference !== '') {
    return formatNumber(item.difference);
  }
  if (item.variance !== undefined && item.variance !== null && item.variance !== '') {
    return formatNumber(item.variance);
  }
  const systemQty = asNumber(item.systemQty);
  const countedQty = asNumber(item.qtyCounted ?? item.countedQty);
  if (systemQty === null || countedQty === null) return '';
  return formatNumber(countedQty - systemQty);
}

function resolveCycleCountSystemQty(item = {}, inventoryQtyByKey = new Map()) {
  const direct = item.systemQty
    ?? item.qtySystem
    ?? item.systemQuantity
    ?? item.qtyOnHand
    ?? item.onHandQty
    ?? item.expectedQty;
  if (direct !== undefined && direct !== null && direct !== '') return formatNumber(direct);
  const fromInventory = inventoryQtyByKey.get(ccLineKey(item));
  if (fromInventory !== undefined) return formatNumber(fromInventory);
  const countedQty = asNumber(item.qtyCounted ?? item.countedQty);
  const difference = asNumber(item.difference ?? item.variance);
  if (countedQty !== null && difference !== null) return formatNumber(countedQty - difference);
  if (countedQty !== null && asText(item.status).toLowerCase() === 'reconciled') return formatNumber(countedQty);
  return '';
}

function baseRow(item = {}, index = 0, prefix = 'posted-item') {
  return {
    localId: item.localId || item.id || `${prefix}-${index}`,
    id: item.id || null,
    isNew: !item.id,
    productId: asText(item.productId),
    variantId: asText(item.variantId),
    productName: productName(item),
    pickerProductName: productName(item),
    sku: productSku(item),
    variantLabel: variantLabel(item),
    pickerVariantLabel: variantLabel(item),
    status: asText(item.status),
  };
}

export function mapShipmentToShellPosted(shipment = {}) {
  const items = Array.isArray(shipment.items) ? shipment.items : [];
  return {
    header: {
      warehouseId: asText(shipment.warehouseId),
      fromLocationId: asText(shipment.fromLocationId || shipment.locationId),
      counterpartyId: asText(
        shipment.counterparty?.name
        || shipment.customer?.name
        || shipment.counterpartyName
        || shipment.customerName
        || shipment.counterpartyId
      ),
      orderId: asText(shipment.order?.number || shipment.orderNumber || shipment.orderId),
      issueDate: pickDate(shipment.issueDate, shipment.shippedAt, shipment.createdAt),
      documentNumber: asText(shipment.number || shipment.documentNumber || shipment.code || shipment.id),
      status: asText(shipment.status),
    },
    rows: items.map((item, index) => ({
      ...baseRow(item, index, 'shipment-item'),
      qty: asText(item.qty ?? item.quantity ?? ''),
      qtyShipped: asText(item.qtyShipped ?? item.shippedQty ?? item.processedQty ?? ''),
      fromLocationId: asText(item.fromLocationId || shipment.fromLocationId || shipment.locationId),
      fromLocationIdLabel: locationLabel(item.fromLocation || shipment.fromLocation || shipment.location),
    })),
  };
}

export function mapTransferToShellPosted(transfer = {}) {
  const items = Array.isArray(transfer.items) ? transfer.items : [];
  return {
    header: {
      fromWarehouseId: asText(transfer.fromWarehouseId),
      toWarehouseId: asText(transfer.toWarehouseId),
      sourceLocationId: asText(transfer.sourceLocationId || transfer.fromLocationId),
      targetLocationId: asText(transfer.targetLocationId || transfer.toLocationId),
      issueDate: pickDate(transfer.issueDate, transfer.completedAt, transfer.createdAt),
      documentNumber: asText(transfer.number || transfer.documentNumber || transfer.code || transfer.id),
      status: asText(transfer.status),
    },
    rows: items.map((item, index) => ({
      ...baseRow(item, index, 'transfer-item'),
      qty: asText(item.qty ?? item.quantity ?? ''),
      movedQty: asText(item.movedQty ?? item.qtyMoved ?? item.processedQty ?? ''),
      fromLocationId: asText(item.fromLocationId || transfer.sourceLocationId || transfer.fromLocationId),
      fromLocationIdLabel: locationLabel(item.fromLocation || transfer.sourceLocation || transfer.fromLocation),
      toLocationId: asText(item.toLocationId || transfer.targetLocationId || transfer.toLocationId),
      toLocationIdLabel: locationLabel(item.toLocation || transfer.targetLocation || transfer.toLocation),
    })),
  };
}

export function mapAdjustmentToShellPosted(adjustment = {}, config = {}) {
  const items = Array.isArray(adjustment.items) ? adjustment.items : [];
  const documentType = asText(adjustment.documentType || config.type).toUpperCase();
  return {
    header: {
      documentType: documentType || config.type,
      warehouseId: asText(adjustment.warehouseId),
      locationId: asText(adjustment.locationId || items[0]?.locationId),
      reason: asText(adjustment.reason),
      issueDate: pickDate(adjustment.issueDate, adjustment.postedAt, adjustment.createdAt),
      documentNumber: asText(adjustment.number || adjustment.documentNumber || adjustment.code || adjustment.id),
      status: asText(adjustment.status),
    },
    rows: items.map((item, index) => ({
      ...baseRow(item, index, 'adjustment-item'),
      qtyDelta: asText(item.qtyDelta ?? item.qty ?? ''),
      reason: asText(item.reason || adjustment.reason),
      locationId: asText(item.locationId || adjustment.locationId),
      locationIdLabel: locationLabel(item.location || adjustment.location),
    })),
  };
}

export function mapCycleCountToShellPosted(cycleCount = {}, inventoryItems = []) {
  const items = Array.isArray(cycleCount.items) ? cycleCount.items : [];
  const inventoryQtyByKey = new Map();
  if (Array.isArray(inventoryItems)) {
    inventoryItems.forEach((row) => {
      const key = ccLineKey(row);
      const nextQty = asNumber(row?.qtyOnHand ?? row?.onHandQty ?? row?.quantity, 0) || 0;
      inventoryQtyByKey.set(key, (inventoryQtyByKey.get(key) || 0) + nextQty);
    });
  }
  return {
    header: {
      warehouseId: asText(cycleCount.warehouseId),
      locationId: asText(cycleCount.locationId || items[0]?.locationId),
      status: asText(cycleCount.status),
      createdAt: pickDate(cycleCount.createdAt, cycleCount.issueDate),
      documentNumber: asText(cycleCount.number || cycleCount.documentNumber || cycleCount.code || cycleCount.id),
    },
    rows: items.map((item, index) => {
      const systemQty = resolveCycleCountSystemQty(item, inventoryQtyByKey);
      const qtyCounted = formatNumber(item.qtyCounted ?? item.countedQty ?? '');
      const difference = differenceValue({ ...item, systemQty });
      return {
        ...baseRow(item, index, 'cycle-count-item'),
        locationId: asText(item.locationId || cycleCount.locationId),
        locationIdLabel: locationLabel(item.location || cycleCount.location),
        lotId: asText(item.lotId),
        serialId: asText(item.serialId),
        systemQty,
        qtyCounted,
        difference,
      };
    }),
  };
}
