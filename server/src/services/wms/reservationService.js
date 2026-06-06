'use strict';

const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const Inventory = require('./inventoryService');
const productStockCacheService = require('../pim/productStockCacheService');
const { resolveDefaultWarehouseId } = require('./warehouseResolver');
const { Reservation, Order, OrderItem } = require('../../models');
const { isInventoryLine } = require('../oms/lineItemNormalizer');

function asText(value) {
  return String(value ?? '').trim();
}

function asNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function buildKey(warehouseId, productId, variantId) {
  return `${warehouseId}|${productId}|${variantId || ''}`;
}

function parsePaging(query = {}) {
  const page = Math.max(parseInt(query.page || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

function buildOrder(query = {}) {
  const sort = String(query.sort || 'createdAt:desc').split(',').filter(Boolean);
  if (!sort.length) return [['createdAt', 'DESC']];
  return sort.map((item) => {
    const [field, direction] = item.split(':');
    return [field, (direction || 'asc').toUpperCase()];
  });
}

function buildWhere(query = {}, user = {}) {
  const where = {};
  if (query.companyId) where.companyId = query.companyId;
  else if (user?.companyId) where.companyId = user.companyId;
  if (query.orderId) where.orderId = query.orderId;
  if (query.warehouseId) where.warehouseId = query.warehouseId;
  if (query.status) where.status = query.status;
  if (query.productId) where.productId = query.productId;
  if (query.variantId !== undefined) where.variantId = query.variantId || null;
  return where;
}

async function loadOrderForCompany(orderId, companyId, transaction) {
  if (!orderId) throw new AppError(400, 'orderId is required', { code: 'VALIDATION_ERROR' });
  const where = { id: orderId };
  if (companyId) where.companyId = companyId;

  const order = await Order.findOne({
    where,
    attributes: ['id', 'companyId', 'status'],
    transaction,
    lock: transaction?.LOCK?.UPDATE,
  });

  if (!order) {
    throw new AppError(404, 'Order not found', { code: 'NOT_FOUND' });
  }

  return order;
}

function mapReservableItems(items = []) {
  return items
    .filter(isInventoryLine)
    .map((item) => ({
      id: item.id,
      orderId: item.orderId,
      productId: item.productId,
      variantId: item.variantId || null,
      qty: round4(asNumber(item.qty, 0)),
      lineName: item.nameSnapshot || item.skuSnapshot || null,
    }))
    .filter((item) => item.qty > 0);
}

function buildRequiredByKey(reservableItems, warehouseId) {
  const requiredByKey = new Map();
  reservableItems.forEach((item) => {
    const key = buildKey(warehouseId, item.productId, item.variantId);
    const current = asNumber(requiredByKey.get(key), 0);
    requiredByKey.set(key, round4(current + item.qty));
  });
  return requiredByKey;
}

function buildOwnActiveByKey(activeReservations = []) {
  const map = new Map();
  activeReservations.forEach((row) => {
    const key = buildKey(row.warehouseId, row.productId, row.variantId || null);
    const current = asNumber(map.get(key), 0);
    map.set(key, round4(current + asNumber(row.qty, 0)));
  });
  return map;
}

async function reserveOrder(orderId, options = {}) {
  const outerTx = options.transaction || null;
  return withTx(async (t) => {
    const order = await loadOrderForCompany(orderId, options.companyId || null, t);
    const companyId = order.companyId;
    const warehouseId = options.warehouseId || (await resolveDefaultWarehouseId(companyId, { transaction: t }));

    const [orderItems, existingReservations] = await Promise.all([
      OrderItem.findAll({
        where: { companyId, orderId: order.id },
        attributes: [
          'id',
          'orderId',
          'productId',
          'variantId',
          'qty',
          'nameSnapshot',
          'skuSnapshot',
          'affectsInventory',
          'lineType',
          'isStockTrackedSnapshot',
        ],
        transaction: t,
        lock: t.LOCK.UPDATE,
      }),
      Reservation.findAll({
        where: { companyId, orderId: order.id },
        transaction: t,
        lock: t.LOCK.UPDATE,
      }),
    ]);

    const reservableItems = mapReservableItems(orderItems);
    const activeReservations = existingReservations.filter((row) => row.status === 'active');

    if (!reservableItems.length) {
      const affectedProductIds = [
        ...new Set(
          [
            ...orderItems.map((item) => item.productId).filter(Boolean),
            ...activeReservations.map((row) => row.productId).filter(Boolean),
          ].map((id) => String(id))
        ),
      ];
      if (activeReservations.length) {
        await Reservation.update(
          { status: 'cancelled' },
          {
            where: {
              id: { [Op.in]: activeReservations.map((row) => row.id) },
            },
            transaction: t,
          }
        );
      }

      if (affectedProductIds.length) {
        await productStockCacheService.recalcProductsStock(companyId, affectedProductIds, { transaction: t });
      }
      return {
        orderId: order.id,
        companyId,
        warehouseId,
        reservedItems: [],
        activeReservations: 0,
      };
    }

    const requiredByKey = buildRequiredByKey(reservableItems, warehouseId);
    const ownActiveByKey = buildOwnActiveByKey(activeReservations);
    const deficits = [];

    // Hard mode: reserve must be all-or-nothing.
    for (const [key, requiredQty] of requiredByKey.entries()) {
      const [keyWarehouseId, productId, variantIdRaw] = key.split('|');
      const variantId = variantIdRaw || null;

      // eslint-disable-next-line no-await-in-loop
      const available = await Inventory.getAvailable(
        { companyId, warehouseId: keyWarehouseId, productId, variantId },
        { transaction: t }
      );
      const ownActiveQty = asNumber(ownActiveByKey.get(key), 0);
      const effectiveAvailable = round4(asNumber(available, 0) + ownActiveQty);
      if (requiredQty > effectiveAvailable) {
        deficits.push({
          warehouseId: keyWarehouseId,
          productId,
          variantId,
          requiredQty,
          availableQty: effectiveAvailable,
          deficitQty: round4(requiredQty - effectiveAvailable),
          orderItems: reservableItems
            .filter((item) => (
              item.productId === productId
              && (item.variantId || null) === variantId
            ))
            .map((item) => ({
              orderItemId: item.id,
              qty: item.qty,
              name: item.lineName,
            })),
        });
      }
    }

    if (deficits.length) {
      throw new AppError(409, 'Insufficient available stock for order confirmation', {
        code: 'INSUFFICIENT_STOCK',
        details: { orderId: order.id, deficits },
      });
    }

    const existingByOrderItemId = new Map(existingReservations.map((row) => [row.orderItemId, row]));
    const activeOrderItemIds = new Set(reservableItems.map((item) => item.id));

    for (const item of reservableItems) {
      const existing = existingByOrderItemId.get(item.id);
      const nextQty = item.qty;
      const payload = {
        warehouseId,
        productId: item.productId,
        variantId: item.variantId,
        qty: nextQty,
        status: 'active',
      };

      if (!existing) {
        // eslint-disable-next-line no-await-in-loop
        await Reservation.create(
          {
            companyId,
            orderId: order.id,
            orderItemId: item.id,
            ...payload,
          },
          { transaction: t }
        );
      } else {
        // eslint-disable-next-line no-await-in-loop
        await existing.update(payload, { transaction: t });
      }
    }

    const staleActive = activeReservations.filter((row) => !activeOrderItemIds.has(row.orderItemId));
    if (staleActive.length) {
      await Reservation.update(
        { status: 'cancelled' },
        {
          where: { id: { [Op.in]: staleActive.map((row) => row.id) } },
          transaction: t,
        }
      );
    }

    const affectedProductIds = [
      ...new Set(
        [
          ...reservableItems.map((item) => item.productId).filter(Boolean),
          ...activeReservations.map((row) => row.productId).filter(Boolean),
        ].map((id) => String(id))
      ),
    ];

    if (affectedProductIds.length) {
      await productStockCacheService.recalcProductsStock(companyId, affectedProductIds, { transaction: t });
    }

    const activeCount = await Reservation.count({
      where: { companyId, orderId: order.id, status: 'active' },
      transaction: t,
    });

    return {
      orderId: order.id,
      companyId,
      warehouseId,
      reservedItems: reservableItems,
      activeReservations: activeCount,
    };
  }, outerTx);
}

async function releaseOrderReservations(orderId, options = {}) {
  const outerTx = options.transaction || null;
  return withTx(async (t) => {
    const order = await loadOrderForCompany(orderId, options.companyId || null, t);
    const affectedRows = await Reservation.findAll({
      where: {
        companyId: order.companyId,
        orderId: order.id,
        status: 'active',
      },
      attributes: ['productId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const [affectedCount] = await Reservation.update(
      { status: 'cancelled' },
      {
        where: {
          companyId: order.companyId,
          orderId: order.id,
          status: 'active',
        },
        transaction: t,
      }
    );

    const affectedProductIds = [...new Set(affectedRows.map((row) => String(row.productId || '')).filter(Boolean))];
    if (affectedProductIds.length) {
      await productStockCacheService.recalcProductsStock(order.companyId, affectedProductIds, { transaction: t });
    }

    return {
      orderId: order.id,
      companyId: order.companyId,
      releasedCount: affectedCount,
    };
  }, outerTx);
}

async function fulfillOrderReservations(orderId, options = {}) {
  const outerTx = options.transaction || null;
  return withTx(async (t) => {
    const order = await loadOrderForCompany(orderId, options.companyId || null, t);
    const affectedRows = await Reservation.findAll({
      where: {
        companyId: order.companyId,
        orderId: order.id,
        status: 'active',
      },
      attributes: ['productId'],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    const [affectedCount] = await Reservation.update(
      { status: 'fulfilled' },
      {
        where: {
          companyId: order.companyId,
          orderId: order.id,
          status: 'active',
        },
        transaction: t,
      }
    );

    const affectedProductIds = [...new Set(affectedRows.map((row) => String(row.productId || '')).filter(Boolean))];
    if (affectedProductIds.length) {
      await productStockCacheService.recalcProductsStock(order.companyId, affectedProductIds, { transaction: t });
    }

    return {
      orderId: order.id,
      companyId: order.companyId,
      fulfilledCount: affectedCount,
    };
  }, outerTx);
}

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
async function list({ query = {}, user = {} } = {}) {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);
  const { rows, count } = await Reservation.findAndCountAll({ where, order, limit, offset });
  return { rows, count, page, limit };
}

// getById: возвращает данные по входным параметрам сервиса.
async function getById(id) {
  return id ? Reservation.findByPk(id, {}) : null;
}

// create: создаёт новую запись и возвращает результат.
async function create(payload = {}) {
  if (!payload.companyId) throw new Error('companyId is required');
  return Reservation.create(payload);
}

// update: обновляет запись и возвращает актуальные данные.
async function update(id, payload = {}) {
  if (!id) throw new Error('id is required');
  const row = await Reservation.findByPk(id);
  if (!row) return null;
  if (payload.companyId && payload.companyId !== row.companyId) throw new Error('companyId mismatch');
  await row.update(payload);
  return getById(id);
}

// remove: удаляет запись с учётом бизнес-ограничений.
async function remove(id) {
  return id ? Reservation.destroy({ where: { id } }) : 0;
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  reserveOrder,
  releaseOrderReservations,
  fulfillOrderReservations,
};
