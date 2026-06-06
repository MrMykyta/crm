'use strict';

const { Op } = require('sequelize');
const { withTx } = require('../../utils/tx');
const AppError = require('../../errors/AppError');
const {
  CompanyWarehouseDocumentSetting,
  CostLayer,
  StockMove,
  StockMoveCostAllocation,
} = require('../../models');

const COST_METHOD_FIFO = 'FIFO';
const COST_METHOD_AVCO = 'AVCO';
const SUPPORTED_COST_METHODS = new Set([COST_METHOD_FIFO]);
const CONFIGURED_COST_METHODS = new Set([COST_METHOD_FIFO, COST_METHOD_AVCO]);

function toNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function round4(value) {
  return Math.round((Number(value) + Number.EPSILON) * 1e4) / 1e4;
}

function normalizeCurrency(value) {
  const currency = String(value || 'PLN').trim().toUpperCase();
  return currency || 'PLN';
}

function normalizeCostMethod(value) {
  const method = String(value || COST_METHOD_FIFO).trim().toUpperCase();
  return CONFIGURED_COST_METHODS.has(method) ? method : method;
}

function assertMove(move) {
  if (!move || !move.id) {
    throw new AppError(400, 'stock move is required', { code: 'VALIDATION_ERROR' });
  }
  if (!move.companyId) {
    throw new AppError(400, 'stock move companyId is required', { code: 'VALIDATION_ERROR' });
  }
  if (!move.warehouseId) {
    throw new AppError(400, 'stock move warehouseId is required', { code: 'VALIDATION_ERROR' });
  }
  if (!move.productId) {
    throw new AppError(400, 'stock move productId is required', { code: 'VALIDATION_ERROR' });
  }
  const qty = toNumber(move.qty, NaN);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new AppError(400, 'stock move qty must be greater than 0', { code: 'VALIDATION_ERROR' });
  }
  return qty;
}

async function getInventoryCostMethod(companyId, transaction) {
  const settings = await CompanyWarehouseDocumentSetting.findOne({
    where: { companyId },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  return normalizeCostMethod(settings?.inventoryCostMethod || COST_METHOD_FIFO);
}

async function assertFifoCosting(companyId, transaction) {
  const method = await getInventoryCostMethod(companyId, transaction);
  if (!SUPPORTED_COST_METHODS.has(method)) {
    throw new AppError(409, 'COST_METHOD_NOT_IMPLEMENTED', {
      code: 'COST_METHOD_NOT_IMPLEMENTED',
      details: { companyId, inventoryCostMethod: method },
    });
  }
  return method;
}

// Outgoing FIFO consumption is blocked until the company has been opened-balance initialized.
// Only consumeFifoLayers / transferFifoLayers call this; createIncomingLayer never does
// (PZ/PW with explicit cost is always allowed).
async function assertCostingInitialized(companyId, transaction) {
  const settings = await CompanyWarehouseDocumentSetting.findOne({
    where: { companyId },
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
  if (!settings || !settings.costingInitializedAt) {
    throw new AppError(409, 'COSTING_NOT_INITIALIZED', {
      code: 'COSTING_NOT_INITIALIZED',
      details: { companyId },
    });
  }
  return settings.costingInitializedAt;
}

function assertIncomingCostInput(move, costInput = {}) {
  const qty = assertMove(move);
  const unitCost = toNumber(costInput.unitCost ?? costInput.unit_cost ?? move.unitCost, NaN);
  if (!Number.isFinite(unitCost) || unitCost < 0) {
    throw new AppError(400, 'unitCost must be a non-negative number', {
      code: 'VALIDATION_ERROR',
      details: { moveId: move.id, unitCost: costInput.unitCost ?? costInput.unit_cost ?? move.unitCost },
    });
  }
  const totalCostInput = costInput.totalCost ?? costInput.total_cost ?? move.totalCost;
  const totalCost = totalCostInput === null || totalCostInput === undefined || totalCostInput === ''
    ? round4(qty * unitCost)
    : round4(toNumber(totalCostInput, qty * unitCost));
  const currency = normalizeCurrency(costInput.currency || move.currency);
  return { qty, unitCost: round4(unitCost), totalCost, currency };
}

async function reloadMove(move, transaction) {
  return StockMove.findByPk(move.id, { transaction });
}

async function existingAllocationsForMove(stockMoveId, transaction) {
  return StockMoveCostAllocation.findAll({
    where: { stockMoveId },
    order: [['createdAt', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: transaction ? transaction.LOCK.UPDATE : undefined,
  });
}

function summarizeAllocations(allocations = []) {
  const totalQty = round4(allocations.reduce((sum, row) => sum + toNumber(row.qty), 0));
  const totalCost = round4(allocations.reduce((sum, row) => sum + toNumber(row.totalCost), 0));
  const unitCost = totalQty > 0 ? round4(totalCost / totalQty) : 0;
  const currency = normalizeCurrency(allocations[0]?.currency || allocations[0]?.costLayer?.currency);
  return { totalQty, totalCost, unitCost, currency };
}

async function updateMoveCost(move, { unitCost, totalCost, currency, costMethod }, transaction) {
  await StockMove.update(
    {
      unitCost: round4(unitCost),
      totalCost: round4(totalCost),
      currency: normalizeCurrency(currency),
      costMethod: normalizeCostMethod(costMethod),
    },
    { where: { id: move.id }, transaction }
  );
  return reloadMove(move, transaction);
}

async function createIncomingLayer(move, costInput = {}, transaction = null) {
  return withTx(async (t) => {
    const qty = assertMove(move);
    const costMethod = await assertFifoCosting(move.companyId, t);

    const existing = await CostLayer.findOne({
      where: { sourceMoveId: move.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (existing) {
      return {
        layer: existing,
        move: await reloadMove(move, t),
        created: false,
      };
    }

    const cost = assertIncomingCostInput(move, costInput);
    const locationId = move.toLocationId || move.fromLocationId || null;

    const layer = await CostLayer.create(
      {
        companyId: move.companyId,
        warehouseId: move.warehouseId,
        locationId,
        productId: move.productId,
        variantId: move.variantId ?? null,
        sourceMoveId: move.id,
        sourceRefType: move.refType || null,
        sourceRefId: move.refId || null,
        sourceRefItemId: move.refItemId || null,
        qtyIn: qty,
        qtyRemaining: qty,
        unitCost: cost.unitCost,
        totalCost: cost.totalCost,
        currency: cost.currency,
        receivedAt: move.createdAt || new Date(),
      },
      { transaction: t }
    );

    const costedMove = await updateMoveCost(
      move,
      {
        unitCost: cost.unitCost,
        totalCost: cost.totalCost,
        currency: cost.currency,
        costMethod,
      },
      t
    );

    return { layer, move: costedMove, created: true };
  }, transaction);
}

function buildFifoLayerWhere(move) {
  const where = {
    companyId: move.companyId,
    warehouseId: move.warehouseId,
    productId: move.productId,
    variantId: move.variantId ?? null,
    qtyRemaining: { [Op.gt]: 0 },
  };
  if (move.fromLocationId) {
    where.locationId = move.fromLocationId;
  }
  return where;
}

function planFifoConsumption(move, layers) {
  let remaining = round4(toNumber(move.qty));
  const planned = [];

  for (const layer of layers) {
    if (remaining <= 0) break;
    const available = round4(toNumber(layer.qtyRemaining));
    if (available <= 0) continue;
    const qty = round4(Math.min(available, remaining));
    const unitCost = round4(toNumber(layer.unitCost));
    planned.push({
      layer,
      qty,
      unitCost,
      totalCost: round4(qty * unitCost),
      currency: normalizeCurrency(layer.currency),
      nextQtyRemaining: round4(available - qty),
    });
    remaining = round4(remaining - qty);
  }

  if (remaining > 0) {
    throw new AppError(409, 'INSUFFICIENT_COST_LAYER', {
      code: 'INSUFFICIENT_COST_LAYER',
      details: {
        moveId: move.id,
        companyId: move.companyId,
        warehouseId: move.warehouseId,
        locationId: move.fromLocationId || null,
        productId: move.productId,
        variantId: move.variantId ?? null,
        requestedQty: round4(toNumber(move.qty)),
        missingQty: remaining,
      },
    });
  }

  return planned;
}

async function consumeFifoLayers(move, transaction = null) {
  return withTx(async (t) => {
    const qty = assertMove(move);
    const costMethod = await assertFifoCosting(move.companyId, t);
    await assertCostingInitialized(move.companyId, t);

    const existingAllocations = await existingAllocationsForMove(move.id, t);
    if (existingAllocations.length) {
      const summary = summarizeAllocations(existingAllocations);
      return {
        move: await reloadMove(move, t),
        allocations: existingAllocations,
        totalQty: summary.totalQty,
        unitCost: summary.unitCost,
        totalCost: summary.totalCost,
        currency: summary.currency,
        created: false,
      };
    }

    const layers = await CostLayer.findAll({
      where: buildFifoLayerWhere(move),
      order: [['receivedAt', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    const planned = planFifoConsumption(move, layers);
    const allocations = [];

    for (const item of planned) {
      await item.layer.update({ qtyRemaining: item.nextQtyRemaining }, { transaction: t });
      const allocation = await StockMoveCostAllocation.create(
        {
          companyId: move.companyId,
          stockMoveId: move.id,
          costLayerId: item.layer.id,
          qty: item.qty,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
          currency: item.currency,
        },
        { transaction: t }
      );
      allocations.push(allocation);
    }

    const totalCost = round4(planned.reduce((sum, row) => sum + row.totalCost, 0));
    const unitCost = qty > 0 ? round4(totalCost / qty) : 0;
    const currency = normalizeCurrency(planned[0]?.currency);
    const costedMove = await updateMoveCost(
      move,
      { unitCost, totalCost, currency, costMethod },
      t
    );

    return {
      move: costedMove,
      allocations,
      totalQty: qty,
      unitCost,
      totalCost,
      currency,
      created: true,
    };
  }, transaction);
}

// MM transfer: one target layer is created per consumed FIFO allocation so the destination
// warehouse preserves the original unit_cost of each source layer. Replaces the previous
// single-aggregated-layer behaviour that violated pure FIFO at the target side.
async function createTransferTargetLayers(inMove, consumption, transaction) {
  // Idempotency: any existing layer for this inMove means the transfer has already been costed.
  const existingLayers = await CostLayer.findAll({
    where: { sourceMoveId: inMove.id },
    order: [['receivedAt', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    transaction,
    lock: transaction.LOCK.UPDATE,
  });
  if (existingLayers.length > 0) {
    return { layers: existingLayers, created: false };
  }

  const qty = assertMove(inMove);
  const allocations = consumption.allocations || [];
  const layers = [];
  const receivedAt = inMove.createdAt || new Date();
  const targetLocationId = inMove.toLocationId || inMove.fromLocationId || null;

  for (const allocation of allocations) {
    const layerQty = round4(toNumber(allocation.qty));
    const unitCost = round4(toNumber(allocation.unitCost));
    const totalCost = round4(toNumber(allocation.totalCost));
    const currency = normalizeCurrency(allocation.currency);

    const layer = await CostLayer.create(
      {
        companyId: inMove.companyId,
        warehouseId: inMove.warehouseId,
        locationId: targetLocationId,
        productId: inMove.productId,
        variantId: inMove.variantId ?? null,
        sourceMoveId: inMove.id,
        sourceAllocationId: allocation.id,
        sourceRefType: inMove.refType || null,
        sourceRefId: inMove.refId || null,
        sourceRefItemId: inMove.refItemId || null,
        qtyIn: layerQty,
        qtyRemaining: layerQty,
        unitCost,
        totalCost,
        currency,
        receivedAt,
      },
      { transaction }
    );
    layers.push(layer);
  }

  // inMove cost snapshot: weighted-avg unit_cost over the move qty, total = sum across target layers.
  const totalCost = round4(consumption.totalCost);
  const unitCost = qty > 0 ? round4(totalCost / qty) : 0;
  const currency = normalizeCurrency(consumption.currency);

  await updateMoveCost(
    inMove,
    {
      unitCost,
      totalCost,
      currency,
      costMethod: COST_METHOD_FIFO,
    },
    transaction
  );

  return { layers, created: true };
}

async function transferFifoLayers(outMove, inMove, transaction = null) {
  return withTx(async (t) => {
    assertMove(outMove);
    assertMove(inMove);
    if (outMove.companyId !== inMove.companyId) {
      throw new AppError(400, 'transfer moves must belong to the same company', {
        code: 'VALIDATION_ERROR',
      });
    }
    await assertFifoCosting(outMove.companyId, t);
    await assertCostingInitialized(outMove.companyId, t);

    const consumption = await consumeFifoLayers(outMove, t);
    const target = await createTransferTargetLayers(inMove, consumption, t);
    const costedInMove = await reloadMove(inMove, t);

    return {
      outMove: consumption.move,
      inMove: costedInMove,
      allocations: consumption.allocations,
      targetLayers: target.layers,
      targetLayersCreated: target.created,
      totalCost: consumption.totalCost,
      currency: consumption.currency,
    };
  }, transaction);
}

// reverseOutgoingConsumption — K1.2: undo FIFO consumption recorded against an outgoing move
// (WZ/RW). Walks the existing StockMoveCostAllocation rows, returns each `qty` back into its
// CostLayer.qtyRemaining and soft-marks the allocation (reversedAt + reversedByStockMoveId).
// The reversingMove gets cost snapshot equal to the sum of reversed allocations.
//
// Idempotency:
//   - Already reversed by *this* reversingMove → no-op replay, returns the existing state.
//   - Already reversed by a DIFFERENT move → throws ALREADY_REVERSED_BY_DIFFERENT_MOVE.
//   - Partial-reverse states from a failed previous run are completed on retry (any allocation
//     with reversedAt IS NULL is processed; the rest are summed for totals).
async function reverseOutgoingConsumption(originalMove, reversingMove, transaction = null) {
  return withTx(async (t) => {
    if (!originalMove || !originalMove.id) {
      throw new AppError(400, 'originalMove is required', { code: 'VALIDATION_ERROR' });
    }
    if (!reversingMove || !reversingMove.id) {
      throw new AppError(400, 'reversingMove is required', { code: 'VALIDATION_ERROR' });
    }
    if (originalMove.id === reversingMove.id) {
      throw new AppError(400, 'originalMove and reversingMove must differ', {
        code: 'VALIDATION_ERROR',
      });
    }
    if (originalMove.companyId !== reversingMove.companyId) {
      throw new AppError(400, 'companyId mismatch between original and reversing move', {
        code: 'VALIDATION_ERROR',
      });
    }

    const allocations = await StockMoveCostAllocation.findAll({
      where: { stockMoveId: originalMove.id },
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (allocations.length === 0) {
      throw new AppError(409, 'NO_ALLOCATIONS_TO_REVERSE', {
        code: 'NO_ALLOCATIONS_TO_REVERSE',
        details: { originalMoveId: originalMove.id },
      });
    }

    // Idempotency: reject if any allocation is already reversed by a different move.
    const conflict = allocations.find(
      (a) => a.reversedAt && a.reversedByStockMoveId && a.reversedByStockMoveId !== reversingMove.id
    );
    if (conflict) {
      throw new AppError(409, 'ALREADY_REVERSED_BY_DIFFERENT_MOVE', {
        code: 'ALREADY_REVERSED_BY_DIFFERENT_MOVE',
        details: {
          originalMoveId: originalMove.id,
          allocationId: conflict.id,
          reversedByStockMoveId: conflict.reversedByStockMoveId,
        },
      });
    }

    const now = new Date();
    let createdReversals = 0;
    for (const allocation of allocations) {
      if (allocation.reversedAt) continue; // already reversed by reversingMove — replay path
      const layer = await CostLayer.findByPk(allocation.costLayerId, {
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!layer) {
        throw new AppError(500, 'COST_LAYER_NOT_FOUND', {
          code: 'COST_LAYER_NOT_FOUND',
          details: { costLayerId: allocation.costLayerId, allocationId: allocation.id },
        });
      }
      const nextRemaining = round4(toNumber(layer.qtyRemaining) + toNumber(allocation.qty));
      await layer.update({ qtyRemaining: nextRemaining }, { transaction: t });
      await allocation.update(
        { reversedAt: now, reversedByStockMoveId: reversingMove.id },
        { transaction: t }
      );
      createdReversals += 1;
    }

    // Sum totals from allocations (constant across replays).
    const totalQty = round4(allocations.reduce((s, a) => s + toNumber(a.qty), 0));
    const totalCost = round4(allocations.reduce((s, a) => s + toNumber(a.totalCost), 0));
    const unitCost = totalQty > 0 ? round4(totalCost / totalQty) : 0;
    const currency = normalizeCurrency(allocations[0]?.currency);

    await StockMove.update(
      {
        unitCost,
        totalCost,
        currency,
        costMethod: COST_METHOD_FIFO,
        reversesMoveId: originalMove.id,
      },
      { where: { id: reversingMove.id }, transaction: t }
    );

    const refreshedAllocations = await StockMoveCostAllocation.findAll({
      where: { stockMoveId: originalMove.id },
      order: [['createdAt', 'ASC'], ['id', 'ASC']],
      transaction: t,
    });

    return {
      originalMove,
      reversingMove: await reloadMove(reversingMove, t),
      allocations: refreshedAllocations,
      totalQty,
      totalCost,
      unitCost,
      currency,
      createdReversals,
      skipped: createdReversals === 0,
    };
  }, transaction);
}

// reverseIncomingLayer — K1.2: undo the CostLayer created by an incoming move (PZ/PW).
// Hard-reject if the layer has been (even partially) consumed (qtyRemaining < qtyIn) — this is
// the MVP §3.4 policy: the user must first reverse downstream WZ/RW (via reverseOutgoingConsumption)
// before the incoming layer can be unwound. Otherwise the layer's qtyRemaining is taken to 0 and
// the reversingMove receives a cost snapshot equal to the layer's full value.
//
// Idempotency: tracked through the reversingMove's reversesMoveId pointer.
//
// Signature compatibility (K1.2 audit-spec): accepts either
//   reverseIncomingLayer(originalMove, reversingMove, transaction)  ← original positional form
//   reverseIncomingLayer({ transaction, originalStockMoveId, reversingStockMoveId })  ← audit-spec form
// The named-args form loads the moves by id. The returned object always includes the legacy
// rich shape AND the audit-spec summary fields { layerId, qtyRemoved, valueRemoved }.
async function reverseIncomingLayer(originalMoveOrOpts, reversingMove, transaction = null) {
  if (
    originalMoveOrOpts
    && typeof originalMoveOrOpts === 'object'
    && !originalMoveOrOpts.id
    && ('originalStockMoveId' in originalMoveOrOpts)
  ) {
    return _reverseIncomingLayerByIds(originalMoveOrOpts);
  }
  return _reverseIncomingLayerByMoves(originalMoveOrOpts, reversingMove, transaction);
}

async function _reverseIncomingLayerByIds({
  transaction,
  originalStockMoveId,
  reversingStockMoveId,
}) {
  if (!originalStockMoveId) {
    throw new AppError(400, 'originalStockMoveId is required', { code: 'VALIDATION_ERROR' });
  }
  if (!reversingStockMoveId) {
    throw new AppError(400, 'reversingStockMoveId is required', { code: 'VALIDATION_ERROR' });
  }
  return withTx(async (t) => {
    const originalMove = await StockMove.findByPk(originalStockMoveId, { transaction: t });
    if (!originalMove) {
      throw new AppError(409, 'ORIGINAL_MOVE_NOT_FOUND', {
        code: 'ORIGINAL_MOVE_NOT_FOUND',
        details: { originalStockMoveId },
      });
    }
    const reversingMove = await StockMove.findByPk(reversingStockMoveId, { transaction: t });
    if (!reversingMove) {
      throw new AppError(409, 'REVERSING_MOVE_NOT_FOUND', {
        code: 'REVERSING_MOVE_NOT_FOUND',
        details: { reversingStockMoveId },
      });
    }
    const result = await _reverseIncomingLayerByMoves(originalMove, reversingMove, t);
    return {
      ...result,
      layerId: result.layer ? result.layer.id : null,
      qtyRemoved: round4(toNumber(result.layer ? result.layer.qtyIn : 0)),
      valueRemoved: round4(toNumber(result.totalCost)),
    };
  }, transaction);
}

async function _reverseIncomingLayerByMoves(originalMove, reversingMove, transaction = null) {
  return withTx(async (t) => {
    if (!originalMove || !originalMove.id) {
      throw new AppError(400, 'originalMove is required', { code: 'VALIDATION_ERROR' });
    }
    if (!reversingMove || !reversingMove.id) {
      throw new AppError(400, 'reversingMove is required', { code: 'VALIDATION_ERROR' });
    }
    if (originalMove.id === reversingMove.id) {
      throw new AppError(400, 'originalMove and reversingMove must differ', {
        code: 'VALIDATION_ERROR',
      });
    }
    if (originalMove.companyId !== reversingMove.companyId) {
      throw new AppError(400, 'companyId mismatch between original and reversing move', {
        code: 'VALIDATION_ERROR',
      });
    }

    const layer = await CostLayer.findOne({
      where: { sourceMoveId: originalMove.id },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!layer) {
      throw new AppError(409, 'COST_LAYER_NOT_FOUND', {
        code: 'COST_LAYER_NOT_FOUND',
        details: { originalMoveId: originalMove.id },
      });
    }

    const qtyIn = round4(toNumber(layer.qtyIn));
    const qtyRemaining = round4(toNumber(layer.qtyRemaining));
    const layerUnitCost = round4(toNumber(layer.unitCost));
    const layerTotalCost = round4(toNumber(layer.totalCost));
    const layerCurrency = normalizeCurrency(layer.currency);

    // Idempotent replay: reversingMove already records this reversal AND layer is exhausted.
    const fresh = await reloadMove(reversingMove, t);
    if (fresh && fresh.reversesMoveId === originalMove.id && qtyRemaining === 0) {
      return {
        originalMove,
        reversingMove: fresh,
        layer,
        totalCost: layerTotalCost,
        unitCost: layerUnitCost,
        currency: layerCurrency,
        skipped: true,
      };
    }

    // Conflict: a different stock_move already claimed this reversal.
    const otherReverser = await StockMove.findOne({
      where: { reversesMoveId: originalMove.id, id: { [Op.ne]: reversingMove.id } },
      transaction: t,
    });
    if (otherReverser) {
      throw new AppError(409, 'ALREADY_REVERSED_BY_DIFFERENT_MOVE', {
        code: 'ALREADY_REVERSED_BY_DIFFERENT_MOVE',
        details: { originalMoveId: originalMove.id, reverserMoveId: otherReverser.id },
      });
    }

    // Hard-reject: any portion already consumed downstream.
    if (qtyRemaining < qtyIn) {
      throw new AppError(409, 'LAYER_PARTIALLY_CONSUMED', {
        code: 'LAYER_PARTIALLY_CONSUMED',
        details: { originalMoveId: originalMove.id, layerId: layer.id, qtyIn, qtyRemaining },
      });
    }

    // Layer is fully intact (qtyRemaining === qtyIn) → safe to unwind in full.
    await layer.update({ qtyRemaining: 0 }, { transaction: t });

    await StockMove.update(
      {
        unitCost: layerUnitCost,
        totalCost: layerTotalCost,
        currency: layerCurrency,
        costMethod: COST_METHOD_FIFO,
        reversesMoveId: originalMove.id,
      },
      { where: { id: reversingMove.id }, transaction: t }
    );

    return {
      originalMove,
      reversingMove: await reloadMove(reversingMove, t),
      layer: await CostLayer.findByPk(layer.id, { transaction: t }),
      totalCost: layerTotalCost,
      unitCost: layerUnitCost,
      currency: layerCurrency,
      skipped: false,
    };
  }, transaction);
}

// reverseConsumption — K1.2 audit-spec named-args public API. Loads moves by id and delegates
// to reverseOutgoingConsumption. Returns the audit-spec summary shape
// { allocationsReversed, qtyRestored, valueRestored } in addition to the legacy rich fields.
async function reverseConsumption({
  transaction,
  originalStockMoveId,
  reversingStockMoveId,
} = {}) {
  if (!originalStockMoveId) {
    throw new AppError(400, 'originalStockMoveId is required', { code: 'VALIDATION_ERROR' });
  }
  if (!reversingStockMoveId) {
    throw new AppError(400, 'reversingStockMoveId is required', { code: 'VALIDATION_ERROR' });
  }
  return withTx(async (t) => {
    const originalMove = await StockMove.findByPk(originalStockMoveId, { transaction: t });
    if (!originalMove) {
      throw new AppError(409, 'ORIGINAL_MOVE_NOT_FOUND', {
        code: 'ORIGINAL_MOVE_NOT_FOUND',
        details: { originalStockMoveId },
      });
    }
    const reversingMove = await StockMove.findByPk(reversingStockMoveId, { transaction: t });
    if (!reversingMove) {
      throw new AppError(409, 'REVERSING_MOVE_NOT_FOUND', {
        code: 'REVERSING_MOVE_NOT_FOUND',
        details: { reversingStockMoveId },
      });
    }
    const result = await reverseOutgoingConsumption(originalMove, reversingMove, t);
    return {
      ...result,
      allocationsReversed: Number(result.createdReversals) || 0,
      qtyRestored: round4(toNumber(result.totalQty)),
      valueRestored: round4(toNumber(result.totalCost)),
    };
  }, transaction);
}

async function applyCostingForMove(move, payload = {}, transaction = null) {
  return withTx(async (t) => {
    assertMove(move);

    const refType = String(move.refType || '').toUpperCase();
    const type = String(move.type || '').toLowerCase();

    if (payload.outMove && payload.inMove) {
      return transferFifoLayers(payload.outMove, payload.inMove, t);
    }

    if (type === 'transfer' && payload.inMove) {
      return transferFifoLayers(move, payload.inMove, t);
    }

    if (type === 'receipt' || refType === 'PZ' || refType === 'PW' || (type === 'adjustment' && move.toLocationId && !move.fromLocationId)) {
      return createIncomingLayer(move, payload.costInput || payload, t);
    }

    if (type === 'ship' || refType === 'WZ' || refType === 'RW' || (type === 'adjustment' && move.fromLocationId && !move.toLocationId)) {
      return consumeFifoLayers(move, t);
    }

    return null;
  }, transaction);
}

module.exports = {
  createIncomingLayer,
  consumeFifoLayers,
  transferFifoLayers,
  applyCostingForMove,
  // K1.2 reverse helpers — not wired to any document service yet.
  reverseOutgoingConsumption,
  reverseConsumption,
  reverseIncomingLayer,
};
