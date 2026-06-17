function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function getRows(input = {}) {
  return Array.isArray(input.rows) ? input.rows : (Array.isArray(input.items) ? input.items : []);
}

function getHeader(input = {}) {
  return input.header || input.form || {};
}

function buildReceiptPayload(input = {}) {
  const header = getHeader(input);
  return {
    warehouseId: header.warehouseId,
    inboundLocationId: header.inboundLocationId || null,
    issueDate: header.issueDate || null,
    items: getRows(input).map((item) => ({
      productId: item.productId,
      variantId: asText(item.variantId) || null,
      lotNumber: asText(item.lotNumber) || null,
      qtyExpected: round4(asNumber(item.qtyExpected, 0)),
    })),
  };
}

function buildReceiptDraftHeaderPatch(input = {}) {
  const header = getHeader(input);
  return {
    warehouseId: header.warehouseId,
    inboundLocationId: asText(header.inboundLocationId) || null,
  };
}

function buildReceiptDraftItemBody(input = {}) {
  const row = input.row || input.item || input;
  const payload = {
    productId: row.productId,
    variantId: asText(row.variantId) || null,
    lotNumber: asText(row.lotNumber) || null,
    qtyExpected: round4(asNumber(row.qtyExpected, 0)),
    unitCost: asText(row.unitCost) ? asNumber(row.unitCost, 0) : null,
    currency: asText(row.currency) || null,
  };
  if (asText(row.serialNumber)) payload.serialNumber = asText(row.serialNumber);
  return payload;
}

function buildReceiptDraftItemPatch(input = {}) {
  return buildReceiptDraftItemBody(input);
}

function buildShipmentPayload(input = {}) {
  const header = getHeader(input);
  const rows = getRows(input)
    .filter((item) => asText(item.productId) && asNumber(item.qty, 0) > 0)
    .map((item) => ({
      productId: item.productId,
      variantId: item.variantId || undefined,
      qty: round4(asNumber(item.qty, 0)),
    }));
  const orderId = asText(header.orderId);
  return {
    warehouseId: header.warehouseId,
    ...(orderId ? { orderId } : {}),
    items: rows,
  };
}

function buildTransferPayload(input = {}) {
  const header = getHeader(input);
  return {
    fromWarehouseId: header.fromWarehouseId,
    toWarehouseId: header.toWarehouseId,
    sourceLocationId: header.fromLocationId || header.sourceLocationId || null,
    targetLocationId: header.toLocationId || header.targetLocationId || null,
    issueDate: header.issueDate || null,
    items: getRows(input).map((item) => ({
      productId: item.productId,
      variantId: asText(item.variantId) || null,
      qty: round4(asNumber(item.qty, 0)),
    })),
  };
}

function buildAdjustmentPayload(input = {}) {
  const header = getHeader(input);
  const optionType = input.options?.documentType || input.documentType;
  const type = asText(optionType || header.documentType || 'PW').toUpperCase();
  return {
    documentType: type,
    warehouseId: header.warehouseId,
    reason: asText(header.reason) || null,
    issueDate: header.issueDate || null,
    items: getRows(input).map((item) => {
      const absQty = Math.abs(round4(asNumber(item.qtyDelta, 0)));
      return {
        productId: item.productId,
        variantId: asText(item.variantId) || null,
        locationId: asText(header.locationId) || null,
        qtyDelta: type === 'RW' ? -absQty : absQty,
      };
    }),
  };
}

function buildCycleCountPayload(input = {}) {
  const header = getHeader(input);
  return {
    warehouseId: header.warehouseId,
  };
}

function buildCountedItems(input = {}) {
  return getRows(input).map((item) => ({
    locationId: asText(item.locationId) || null,
    productId: item.productId,
    variantId: asText(item.variantId) || null,
    lotId: asText(item.lotId) || null,
    serialId: asText(item.serialId) || null,
    qtyCounted: round4(asNumber(item.qtyCounted, 0)),
  }));
}

function buildCycleCountItemsPayload(input = {}) {
  return {
    items: buildCountedItems(input),
  };
}

function buildReceiveLinePayload(line = {}, input = {}) {
  const header = getHeader(input);
  const qtyExpected = asNumber(line.qtyExpected ?? line.qty, 0);
  const qtyReceived = asNumber(line.qtyReceived, 0);
  return {
    qty: round4(qtyExpected - qtyReceived),
    toLocationId: asText(header.inboundLocationId) || null,
    lotId: line.lotId || null,
  };
}

function buildShipItemPayload(line = {}, input = {}) {
  const header = getHeader(input);
  const plannedQty = asNumber(line.qty, 0);
  const shippedQty = asNumber(line.qtyShipped, 0);
  return {
    qty: round4(plannedQty - shippedQty),
    fromLocationId: asText(header.fromLocationId || header.sourceLocationId) || null,
  };
}

function buildExecuteLinePayload(line = {}, input = {}) {
  const header = getHeader(input);
  const plannedQty = asNumber(line.qty, 0);
  const movedQty = asNumber(line.movedQty, 0);
  return {
    fromLocationId: asText(header.fromLocationId || header.sourceLocationId) || null,
    toLocationId: asText(header.toLocationId || header.targetLocationId) || null,
    qty: round4(plannedQty - movedQty),
  };
}

const payloadBuilders = {
  asNumber,
  asText,
  buildAdjustmentPayload,
  buildCountedItems,
  buildCycleCountItemsPayload,
  buildCycleCountPayload,
  buildExecuteLinePayload,
  buildReceiptPayload,
  buildReceiptDraftHeaderPatch,
  buildReceiptDraftItemBody,
  buildReceiptDraftItemPatch,
  buildReceiveLinePayload,
  buildShipmentPayload,
  buildShipItemPayload,
  buildTransferPayload,
  round4,
};

export {
  asNumber,
  asText,
  buildAdjustmentPayload,
  buildCountedItems,
  buildCycleCountItemsPayload,
  buildCycleCountPayload,
  buildExecuteLinePayload,
  buildReceiptPayload,
  buildReceiptDraftHeaderPatch,
  buildReceiptDraftItemBody,
  buildReceiptDraftItemPatch,
  buildReceiveLinePayload,
  buildShipmentPayload,
  buildShipItemPayload,
  buildTransferPayload,
  round4,
};

export default payloadBuilders;
