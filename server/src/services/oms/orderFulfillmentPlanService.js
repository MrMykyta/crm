'use strict';

const {
  Warehouse,
  CompanyWarehouseDocumentSetting,
} = require('../../models');
const stockBalanceService = require('../wms/stockBalanceService');

function asText(value) {
  return String(value ?? '').trim();
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundQty(value) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 1e4) / 1e4;
}

function unique(values = []) {
  return [...new Set(values.map((value) => asText(value)).filter(Boolean))];
}

function isStockTrackedLine(item) {
  if (!item?.productId) return false;
  const lineType = asText(item.lineType).toLowerCase();
  if (lineType && lineType !== 'product') return false;
  return Boolean(item.affectsInventory || item.isStockTrackedSnapshot || item.product?.trackInventory);
}

function getItemName(item) {
  return item?.nameSnapshot || item?.product?.name || item?.skuSnapshot || item?.productId || null;
}

function getItemSku(item) {
  return item?.skuSnapshot || item?.product?.sku || item?.sku || null;
}

function addWarning(warnings, code, payload = {}) {
  if (!code) return;
  const exists = warnings.some((warning) => warning?.code === code && warning?.orderItemId === payload.orderItemId);
  if (!exists) warnings.push({ code, ...payload });
}

function buildReservationIndex(reservations = []) {
  const byOrderItem = new Map();
  const active = reservations.filter((reservation) => asText(reservation?.status).toLowerCase() === 'active');
  for (const reservation of active) {
    const orderItemId = asText(reservation.orderItemId);
    if (!orderItemId) continue;
    const current = byOrderItem.get(orderItemId) || {
      qty: 0,
      byWarehouse: new Map(),
    };
    const qty = roundQty(asNumber(reservation.qty, 0));
    current.qty = roundQty(current.qty + qty);
    const warehouseId = asText(reservation.warehouseId);
    if (warehouseId) {
      current.byWarehouse.set(warehouseId, roundQty((current.byWarehouse.get(warehouseId) || 0) + qty));
    }
    byOrderItem.set(orderItemId, current);
  }
  return byOrderItem;
}

function buildFulfilledIndex(shipments = []) {
  const byOrderItem = new Map();
  for (const shipment of shipments) {
    const status = asText(shipment?.status).toLowerCase();
    if (!['shipped', 'completed', 'fulfilled'].includes(status)) continue;
    const items = Array.isArray(shipment.items) ? shipment.items : [];
    for (const item of items) {
      const orderItemId = asText(item.orderItemId);
      if (!orderItemId) continue;
      byOrderItem.set(orderItemId, roundQty((byOrderItem.get(orderItemId) || 0) + asNumber(item.qty, 0)));
    }
  }
  return byOrderItem;
}

async function loadDefaultWarehouseId(companyId, warehouses, transaction) {
  const setting = await CompanyWarehouseDocumentSetting.findOne({
    where: { companyId },
    attributes: ['defaultWarehouseId'],
    transaction,
  });
  const configuredId = asText(setting?.defaultWarehouseId);
  if (configuredId && warehouses.some((warehouse) => String(warehouse.id) === configuredId)) {
    return configuredId;
  }
  return warehouses[0]?.id || null;
}

function buildBalanceIndex(balanceRows = []) {
  const byLineKey = new Map();
  for (const row of balanceRows) {
    const key = `${row.productId}|${row.variantId || ''}|${row.warehouseId}`;
    byLineKey.set(key, {
      warehouseId: row.warehouseId,
      warehouseName: row.warehouseName || null,
      onHandQty: roundQty(asNumber(row.onHand, 0)),
      reservedQty: roundQty(asNumber(row.reserved, 0)),
      availableQty: roundQty(asNumber(row.available, 0)),
    });
  }
  return byLineKey;
}

function pickBestLineWarehouse(options, remainingQty) {
  const covering = options
    .filter((option) => option.availableQty >= remainingQty)
    .sort((a, b) => b.availableQty - a.availableQty);
  if (covering.length) return covering[0];
  return [...options].sort((a, b) => b.availableQty - a.availableQty)[0] || null;
}

function pickSingleWarehouse({ warehouses, stockLines, defaultWarehouseId }) {
  if (!stockLines.length || !warehouses.length) return null;
  const covering = warehouses
    .map((warehouse) => {
      const warehouseId = String(warehouse.id);
      const totalAvailable = stockLines.reduce((sum, line) => {
        const option = line.warehouseOptions.find((candidate) => candidate.warehouseId === warehouseId);
        return sum + asNumber(option?.availableQty, 0);
      }, 0);
      const coversAll = stockLines.every((line) => {
        const option = line.warehouseOptions.find((candidate) => candidate.warehouseId === warehouseId);
        return asNumber(option?.availableQty, 0) >= line.remainingQty;
      });
      return {
        warehouseId,
        warehouseName: warehouse.name || warehouse.code || null,
        coversAll,
        totalAvailable: roundQty(totalAvailable),
      };
    })
    .filter((candidate) => candidate.coversAll);

  if (!covering.length) return null;
  const defaultCovering = covering.find((candidate) => candidate.warehouseId === defaultWarehouseId);
  if (defaultCovering) return defaultCovering;
  return covering.sort((a, b) => b.totalAvailable - a.totalAvailable)[0] || null;
}

async function buildOrderFulfillmentPlan(order, related = {}, options = {}) {
  const companyId = asText(order?.companyId);
  if (!companyId) return null;

  const transaction = options.transaction || null;
  const items = Array.isArray(order.items) ? order.items : [];
  const warnings = [];
  const reservations = Array.isArray(related.reservations) ? related.reservations : [];
  const shipments = Array.isArray(related.shipments) ? related.shipments : [];
  const reservationIndex = buildReservationIndex(reservations);
  const fulfilledIndex = buildFulfilledIndex(shipments);
  const productIds = unique(items.map((item) => item.productId));

  const [warehouses, balanceRows] = await Promise.all([
    Warehouse.findAll({
      where: { companyId, isActive: true },
      attributes: ['id', 'code', 'name'],
      order: [['createdAt', 'ASC']],
      transaction,
    }),
    productIds.length
      ? Promise.all(productIds.map((productId) => (
        stockBalanceService.listStockBalances(companyId, { productId }, { transaction })
      ))).then((rows) => rows.flat())
      : [],
  ]);

  const defaultWarehouseId = await loadDefaultWarehouseId(companyId, warehouses, transaction);
  const balanceIndex = buildBalanceIndex(balanceRows);
  if (!warehouses.length && productIds.length) {
    addWarning(warnings, 'no_warehouse');
  }

  const lines = items.map((item) => {
    const requiredQty = roundQty(asNumber(item.qty ?? item.quantity, 0));
    const reserved = reservationIndex.get(asText(item.id)) || { qty: 0, byWarehouse: new Map() };
    const fulfilledQty = roundQty(asNumber(fulfilledIndex.get(asText(item.id)), 0));
    const reservedQty = roundQty(reserved.qty);
    const remainingQty = roundQty(Math.max(0, requiredQty - reservedQty - fulfilledQty));
    const stockTracked = isStockTrackedLine(item);

    if (!stockTracked) {
      return {
        orderItemId: item.id,
        productId: item.productId || null,
        sku: getItemSku(item),
        name: getItemName(item),
        requiredQty,
        reservedQty,
        fulfilledQty,
        recommendedWarehouseId: null,
        recommendedWarehouseName: null,
        availableQty: 0,
        shortageQty: 0,
        status: 'not_stock_tracked',
        warehouseOptions: [],
        remainingQty,
        stockTracked: false,
      };
    }

    if (reservedQty > 0) addWarning(warnings, 'reservation_exists', { orderItemId: item.id });
    if (fulfilledQty >= requiredQty && requiredQty > 0) {
      addWarning(warnings, 'already_fulfilled', { orderItemId: item.id });
    }

    const warehouseOptions = warehouses.map((warehouse) => {
      const warehouseId = String(warehouse.id);
      const key = `${item.productId}|${item.variantId || ''}|${warehouseId}`;
      const balance = balanceIndex.get(key) || {};
      const availableQty = roundQty(asNumber(balance.availableQty, 0));
      return {
        warehouseId,
        warehouseName: warehouse.name || warehouse.code || null,
        availableQty,
        onHandQty: roundQty(asNumber(balance.onHandQty, 0)),
        reservedQty: roundQty(asNumber(balance.reservedQty, 0)),
        canCoverLine: availableQty >= remainingQty,
      };
    });

    const best = pickBestLineWarehouse(warehouseOptions, remainingQty);
    const availableQty = roundQty(asNumber(best?.availableQty, 0));
    const totalAvailable = roundQty(warehouseOptions.reduce((sum, option) => sum + asNumber(option.availableQty, 0), 0));
    const shortageQty = roundQty(Math.max(0, remainingQty - Math.max(availableQty, totalAvailable > 0 ? Math.min(totalAvailable, remainingQty) : 0)));
    let status = 'ready';
    if (remainingQty <= 0 && fulfilledQty >= requiredQty) status = 'already_fulfilled';
    else if (remainingQty <= 0) status = 'reserved';
    else if (!warehouses.length || totalAvailable <= 0) status = 'shortage';
    else if (shortageQty > 0) status = 'shortage';
    else if (!best?.canCoverLine) status = 'partial';

    if (status === 'shortage') {
      addWarning(warnings, totalAvailable <= 0 ? 'no_stock' : 'partial_stock', { orderItemId: item.id });
    } else if (best?.canCoverLine && remainingQty > 0 && roundQty(availableQty - remainingQty) <= 0) {
      addWarning(warnings, 'low_stock_after_fulfillment', { orderItemId: item.id });
    }

    return {
      orderItemId: item.id,
      productId: item.productId || null,
      sku: getItemSku(item),
      name: getItemName(item),
      requiredQty,
      reservedQty,
      fulfilledQty,
      recommendedWarehouseId: best?.warehouseId || null,
      recommendedWarehouseName: best?.warehouseName || null,
      availableQty,
      shortageQty,
      status,
      warehouseOptions,
      remainingQty,
      stockTracked: true,
    };
  });

  const stockLines = lines.filter((line) => line.stockTracked && line.remainingQty > 0);
  const singleWarehouse = pickSingleWarehouse({ warehouses, stockLines, defaultWarehouseId });
  const hasShortage = lines.some((line) => line.stockTracked && line.status === 'shortage');
  const hasPartial = lines.some((line) => line.stockTracked && line.status === 'partial');
  const hasReservableLines = stockLines.length > 0;
  const orderStatus = asText(order.status).toLowerCase();
  const isTerminalOrder = ['cancelled', 'returned', 'completed'].includes(orderStatus);

  let status = 'not_required';
  let mode = 'not_required';
  if (hasShortage) {
    status = 'shortage';
    mode = 'shortage';
  } else if (singleWarehouse) {
    status = 'ready';
    mode = 'single_warehouse';
  } else if (hasPartial || stockLines.length > 1) {
    status = hasReservableLines ? 'partial' : 'reserved';
    mode = hasReservableLines ? 'split_suggested' : 'not_required';
  } else if (hasReservableLines) {
    status = 'ready';
    mode = 'single_warehouse';
  } else if (lines.some((line) => line.status === 'reserved')) {
    status = 'reserved';
  }

  const recommendedWarehouseId = singleWarehouse?.warehouseId || null;
  const recommendedWarehouseName = singleWarehouse?.warehouseName || null;
  const dtoLines = lines.map((line) => {
    if (recommendedWarehouseId && line.stockTracked && line.remainingQty > 0) {
      const option = line.warehouseOptions.find((candidate) => candidate.warehouseId === recommendedWarehouseId);
      return {
        ...line,
        recommendedWarehouseId,
        recommendedWarehouseName,
        availableQty: roundQty(asNumber(option?.availableQty, line.availableQty)),
      };
    }
    return line;
  }).map(({ remainingQty, stockTracked, ...line }) => line);

  return {
    status,
    mode,
    recommendedWarehouseId,
    recommendedWarehouseName,
    canReserve: hasReservableLines && !hasShortage && !isTerminalOrder,
    canShip: !hasShortage && !isTerminalOrder && lines.some((line) => line.stockTracked && (line.reservedQty > 0 || line.fulfilledQty > 0)),
    warnings,
    lines: dtoLines,
  };
}

module.exports = {
  buildOrderFulfillmentPlan,
};
