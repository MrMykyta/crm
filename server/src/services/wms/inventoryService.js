'use strict';

// inventoryService — WMS stock engine (Phase 0).
// Источник истины: inventory_items.qty_on_hand (остаток) + reservations (резерв, status='active').
// inventory_items.qty_reserved в MVP НЕ используется как источник истины (только default 0 при создании строки).

const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const { InventoryItem, StockMove, Reservation } = require('../../models');
const productStockCacheService = require('../pim/productStockCacheService');

const MOVE_TYPES = new Set(['receipt', 'putaway', 'pick', 'pack', 'ship', 'adjustment', 'transfer']);
const INBOUND_TYPES = new Set(['receipt']);
const OUTBOUND_TYPES = new Set(['pick', 'pack', 'ship']);

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function assertPositiveQty(qty) {
  const n = Number(qty);
  if (!Number.isFinite(n) || n <= 0) {
    throw new AppError(400, 'qty must be greater than 0', { code: 'VALIDATION_ERROR' });
  }
  return n;
}

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function inferMoveDirection({ type, refType, hasFromLocationId, hasToLocationId, fromLocationId, toLocationId }) {
  const debit = Boolean(fromLocationId);
  const credit = Boolean(toLocationId);
  if (debit || credit) return { debit, credit };

  const normalizedRefType = String(refType || '').toUpperCase();
  if (INBOUND_TYPES.has(type) || normalizedRefType === 'PW') {
    return { debit: false, credit: true };
  }
  if (OUTBOUND_TYPES.has(type) || normalizedRefType === 'RW') {
    return { debit: true, credit: false };
  }
  if (type === 'adjustment') {
    throw new AppError(400, 'Adjustment move direction requires refType PW or RW', { code: 'VALIDATION_ERROR' });
  }
  if (type === 'transfer') {
    if (hasFromLocationId && !hasToLocationId) return { debit: true, credit: false };
    if (hasToLocationId && !hasFromLocationId) return { debit: false, credit: true };
    throw new AppError(400, 'Transfer move direction requires source or target side', { code: 'VALIDATION_ERROR' });
  }
  if (type === 'putaway') {
    if (hasFromLocationId && !hasToLocationId) return { debit: true, credit: false };
    return { debit: false, credit: true };
  }
  throw new AppError(400, 'Stock move direction could not be inferred', { code: 'VALIDATION_ERROR' });
}

// Ключ строки остатка (склад+локация+продукт+вариант+партия+серийник).
// Для nullable полей передаём явный null → Sequelize строит `field IS NULL`.
function buildItemWhere({ companyId, warehouseId, locationId, productId, variantId, lotId, serialId }) {
  return {
    companyId,
    warehouseId,
    locationId,
    productId,
    variantId: variantId ?? null,
    lotId: lotId ?? null,
    serialId: serialId ?? null,
  };
}

async function findItemForUpdate(key, transaction) {
  return InventoryItem.findOne({
    where: buildItemWhere(key),
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

async function findOrCreateItemForUpdate(key, transaction) {
  const where = buildItemWhere(key);
  const [row] = await InventoryItem.findOrCreate({
    where,
    defaults: { ...where, qtyOnHand: 0, qtyReserved: 0 },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  return row;
}

// getOnHand: Σ inventory_items.qty_on_hand по companyId + warehouseId + productId + variantId.
async function getOnHand({ companyId, warehouseId, productId, variantId = null }, { transaction = null } = {}) {
  const sum = await InventoryItem.sum('qtyOnHand', {
    where: { companyId, warehouseId, productId, variantId: variantId ?? null },
    transaction,
  });
  return toNumber(sum);
}

// getReserved: Σ reservations.qty WHERE status='active' (источник истины по резерву в MVP).
async function getReserved({ companyId, warehouseId, productId, variantId = null }, { transaction = null } = {}) {
  const sum = await Reservation.sum('qty', {
    where: { companyId, warehouseId, productId, variantId: variantId ?? null, status: 'active' },
    transaction,
  });
  return toNumber(sum);
}

// getAvailable = getOnHand − getReserved.
async function getAvailable(params, { transaction = null } = {}) {
  const [onHand, reserved] = await Promise.all([
    getOnHand(params, { transaction }),
    getReserved(params, { transaction }),
  ]);
  return round4(onHand - reserved);
}

// applyMove: единственная точка мутации остатка. Всё внутри транзакции, под FOR UPDATE.
async function applyMove(payload = {}, { transaction } = {}) {
  const hasFromLocationId = hasOwn(payload, 'fromLocationId');
  const hasToLocationId = hasOwn(payload, 'toLocationId');
  const {
    companyId,
    type,
    warehouseId,
    fromLocationId = null,
    toLocationId = null,
    productId,
    variantId = null,
    lotId = null,
    serialId = null,
    qty,
    refType = null,
    refId = null,
    refItemId = null,
  } = payload;

  if (!companyId) throw new AppError(400, 'companyId is required', { code: 'VALIDATION_ERROR' });
  if (!warehouseId) throw new AppError(400, 'warehouseId is required', { code: 'VALIDATION_ERROR' });
  if (!productId) throw new AppError(400, 'productId is required', { code: 'VALIDATION_ERROR' });
  if (!type || !MOVE_TYPES.has(type)) {
    throw new AppError(400, `Invalid stock move type "${type}"`, { code: 'VALIDATION_ERROR' });
  }
  const moveQty = assertPositiveQty(qty);
  const direction = inferMoveDirection({
    type,
    refType,
    hasFromLocationId,
    hasToLocationId,
    fromLocationId,
    toLocationId,
  });

  return withTx(async (t) => {
    if (direction.debit) {
      const sourceLocationId = fromLocationId || null;
      // Лочим строку-источник, затем считаем доступность в той же транзакции.
      const from = await findItemForUpdate(
        { companyId, warehouseId, locationId: sourceLocationId, productId, variantId, lotId, serialId },
        t
      );
      const onHandAtLocation = from ? round4(from.qtyOnHand) : 0;

      // Hard-режим: нельзя списать больше, чем доступно (on_hand − reserved) по продукту/варианту на складе.
      const available = await getAvailable({ companyId, warehouseId, productId, variantId }, { transaction: t });
      if (available < moveQty) {
        throw new AppError(409, 'Insufficient available stock to issue', {
          code: 'INSUFFICIENT_STOCK',
          details: { companyId, warehouseId, productId, variantId: variantId ?? null, requested: moveQty, available },
        });
      }
      // Физическая проверка: в указанной локации должно лежать достаточно (нельзя уводить локацию в минус).
      if (!from || onHandAtLocation < moveQty) {
        throw new AppError(409, sourceLocationId ? 'Insufficient stock at source location' : 'Insufficient stock at warehouse level', {
          code: 'INSUFFICIENT_STOCK',
          details: { companyId, warehouseId, productId, fromLocationId: sourceLocationId, requested: moveQty, onHandAtLocation },
        });
      }
      await from.update({ qtyOnHand: round4(onHandAtLocation - moveQty) }, { transaction: t });
    }

    if (direction.credit) {
      const targetLocationId = toLocationId || null;
      const to = await findOrCreateItemForUpdate(
        { companyId, warehouseId, locationId: targetLocationId, productId, variantId, lotId, serialId },
        t
      );
      await to.update({ qtyOnHand: round4(toNumber(to.qtyOnHand) + moveQty) }, { transaction: t });
    }

    const move = await StockMove.create(
      {
        companyId,
        type,
        warehouseId,
        fromLocationId,
        toLocationId,
        productId,
        variantId: variantId ?? null,
        lotId: lotId ?? null,
        serialId: serialId ?? null,
        qty: moveQty,
        refType,
        refId,
        refItemId,
      },
      { transaction: t }
    );

    await productStockCacheService.recalcProductStock(companyId, productId, { transaction: t });

    return move;
  }, transaction);
}

module.exports = {
  applyMove,
  getOnHand,
  getReserved,
  getAvailable,
};
