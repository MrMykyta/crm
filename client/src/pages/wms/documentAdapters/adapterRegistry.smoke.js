const assert = require('node:assert/strict');

const {
  ACTIONS,
  buildAdjustmentPayload,
  buildCountedItems,
  buildCycleCountItemsPayload,
  buildCycleCountPayload,
  buildReceiptDraftHeaderPatch,
  buildReceiptDraftItemBody,
  buildReceiptDraftItemPatch,
  buildReceiptPayload,
  buildShipmentPayload,
  buildTransferPayload,
  createDocumentAdapterRegistry,
  mapAdapterError,
  mapAdapterResult,
} = require('./index');

function makeUnwrap(value) {
  return { unwrap: async () => value };
}

async function main() {
  const header = {
    warehouseId: 'wh-1',
    inboundLocationId: '',
    issueDate: '',
    documentType: 'PW',
    locationId: '',
    fromWarehouseId: 'wh-a',
    toWarehouseId: 'wh-b',
    fromLocationId: '',
    toLocationId: 'loc-b',
    orderId: '',
    reason: 'Stock correction',
  };
  const rows = [
    {
      id: 'line-1',
      productId: 'prod-1',
      variantId: '',
      lotNumber: '',
      qtyExpected: '2.50001',
      qty: '3.00001',
      qtyDelta: '4.00001',
      qtyCounted: '5.00001',
      receiveNow: true,
    },
  ];

  assert.deepEqual(buildReceiptPayload({ header, rows }), {
    warehouseId: 'wh-1',
    inboundLocationId: null,
    issueDate: null,
    items: [{ productId: 'prod-1', variantId: null, lotNumber: null, qtyExpected: 2.5 }],
  });

  assert.deepEqual(buildReceiptPayload({
    header: { warehouseId: 'wh-2', inboundLocationId: 'loc-in', issueDate: '2026-06-12' },
    items: [{
      localId: 'ui-row-1',
      productId: 'prod-runtime',
      productName: 'Runtime product',
      sku: 'SKU-RUNTIME',
      variantId: '',
      lotNumber: '',
      qtyExpected: '7,25001',
      receiveNow: false,
    }],
  }), {
    warehouseId: 'wh-2',
    inboundLocationId: 'loc-in',
    issueDate: '2026-06-12',
    items: [{ productId: 'prod-runtime', variantId: null, lotNumber: null, qtyExpected: 7.25 }],
  });

  assert.deepEqual(buildReceiptDraftHeaderPatch({
    header: {
      warehouseId: 'wh-draft',
      inboundLocationId: '',
      issueDate: 'ignored-by-current-draft-patch',
      supplierId: 'ignored-ui-only',
    },
  }), {
    warehouseId: 'wh-draft',
    inboundLocationId: null,
  });

  assert.deepEqual(buildReceiptDraftItemBody({
    row: {
      localId: 'ui-draft-row',
      id: 'persisted-line',
      productId: 'prod-draft',
      productName: 'Ignored UI product name',
      sku: 'IGNORED-SKU',
      variantId: '',
      lotNumber: 'LOT-2A',
      qtyExpected: '3,50001',
      unitCost: '10,25001',
      currency: 'pln',
      uiOnly: 'ignored',
    },
  }), {
    productId: 'prod-draft',
    variantId: null,
    lotNumber: 'LOT-2A',
    qtyExpected: 3.5,
    unitCost: 10.25001,
    currency: 'pln',
  });

  assert.deepEqual(buildReceiptDraftItemPatch({
    productId: 'prod-draft',
    variantId: 'variant-draft',
    lotNumber: '',
    qtyExpected: '2',
    unitCost: '',
    currency: '',
  }), {
    productId: 'prod-draft',
    variantId: 'variant-draft',
    lotNumber: null,
    qtyExpected: 2,
    unitCost: null,
    currency: null,
  });

  assert.deepEqual(buildShipmentPayload({ header, rows }), {
    warehouseId: 'wh-1',
    items: [{ productId: 'prod-1', variantId: undefined, qty: 3 }],
  });

  assert.deepEqual(buildShipmentPayload({
    form: {
      warehouseId: 'wh-wz-runtime',
      counterpartyId: 'counterparty-ignored',
      orderId: 'order-wz-runtime',
      sourceLocationId: 'source-location-ignored',
      issueDate: '2026-06-12',
      notes: 'UI-only notes are ignored by current WZ create payload',
    },
    items: [
      {
        localId: 'ui-wz-row-1',
        productId: 'prod-wz-runtime',
        productName: 'Runtime WZ product',
        productSku: 'WZ-RUNTIME',
        variantId: '',
        variantName: 'UI variant label',
        qty: '9,12501',
      },
      {
        localId: 'ui-empty-row',
        productId: '',
        productName: 'Ignored empty row',
        qty: '5',
      },
    ],
  }), {
    warehouseId: 'wh-wz-runtime',
    orderId: 'order-wz-runtime',
    items: [{ productId: 'prod-wz-runtime', variantId: undefined, qty: 9.125 }],
  });

  assert.deepEqual(buildTransferPayload({ header, rows }), {
    fromWarehouseId: 'wh-a',
    toWarehouseId: 'wh-b',
    sourceLocationId: null,
    targetLocationId: 'loc-b',
    issueDate: null,
    items: [{ productId: 'prod-1', variantId: null, qty: 3 }],
  });

  assert.deepEqual(buildTransferPayload({
    header: {
      fromWarehouseId: 'wh-runtime-a',
      toWarehouseId: 'wh-runtime-b',
      fromLocationId: '',
      toLocationId: '',
      issueDate: '',
    },
    items: [{
      localId: 'ui-mm-row-1',
      productId: 'prod-mm-runtime',
      productName: 'Runtime MM product',
      sku: 'MM-RUNTIME',
      variantId: '',
      variantSku: '',
      variantName: '',
      qty: '6,75001',
    }],
  }), {
    fromWarehouseId: 'wh-runtime-a',
    toWarehouseId: 'wh-runtime-b',
    sourceLocationId: null,
    targetLocationId: null,
    issueDate: null,
    items: [{ productId: 'prod-mm-runtime', variantId: null, qty: 6.75 }],
  });

  assert.deepEqual(buildAdjustmentPayload({ header, rows }), {
    documentType: 'PW',
    warehouseId: 'wh-1',
    reason: 'Stock correction',
    issueDate: null,
    items: [{ productId: 'prod-1', variantId: null, locationId: null, qtyDelta: 4 }],
  });

  assert.equal(buildAdjustmentPayload({ header: { ...header, documentType: 'RW' }, rows }).items[0].qtyDelta, -4);

  assert.deepEqual(buildAdjustmentPayload({
    header: {
      warehouseId: 'wh-pw-runtime',
      documentType: 'PW',
      locationId: '',
      reason: '',
      issueDate: '',
    },
    items: [{
      localId: 'ui-pw-row-1',
      productId: 'prod-pw-runtime',
      productName: 'Runtime PW product',
      sku: 'PW-RUNTIME',
      variantId: '',
      variantSku: '',
      variantName: '',
      qtyDelta: '8,12501',
    }],
  }), {
    documentType: 'PW',
    warehouseId: 'wh-pw-runtime',
    reason: null,
    issueDate: null,
    items: [{ productId: 'prod-pw-runtime', variantId: null, locationId: null, qtyDelta: 8.125 }],
  });

  assert.deepEqual(buildAdjustmentPayload({
    header: {
      warehouseId: 'wh-rw-runtime',
      documentType: 'RW',
      locationId: '',
      reason: 'Runtime write-off',
      issueDate: '2026-06-12',
    },
    items: [{
      localId: 'ui-rw-row-1',
      productId: 'prod-rw-runtime',
      productName: 'Runtime RW product',
      sku: 'RW-RUNTIME',
      variantId: '',
      variantSku: '',
      variantName: '',
      qtyDelta: '2,50001',
    }],
  }), {
    documentType: 'RW',
    warehouseId: 'wh-rw-runtime',
    reason: 'Runtime write-off',
    issueDate: '2026-06-12',
    items: [{ productId: 'prod-rw-runtime', variantId: null, locationId: null, qtyDelta: -2.5 }],
  });

  assert.deepEqual(buildCycleCountPayload({ header }), { warehouseId: 'wh-1' });

  assert.deepEqual(buildCycleCountPayload({
    header: {
      warehouseId: 'wh-cc-runtime',
      locationId: 'location-ignored',
      issueDate: '2026-06-12',
      notes: 'UI-only create field ignored',
    },
  }), { warehouseId: 'wh-cc-runtime' });

  assert.deepEqual(buildCountedItems({ rows }), [{
    locationId: null,
    productId: 'prod-1',
    variantId: null,
    lotId: null,
    serialId: null,
    qtyCounted: 5,
  }]);
  assert.deepEqual(buildCycleCountItemsPayload({ rows }), {
    items: [{
      locationId: null,
      productId: 'prod-1',
      variantId: null,
      lotId: null,
      serialId: null,
      qtyCounted: 5,
    }],
  });
  assert.deepEqual(buildCycleCountItemsPayload({
    rows: [
      {
        localId: 'ui-cc-row-1',
        locationId: '',
        productId: 'prod-cc-runtime',
        productName: 'Runtime CC product',
        sku: 'CC-RUNTIME',
        variantId: '',
        variantName: 'UI variant label',
        lotId: '',
        serialId: '',
        qtyCounted: '3,50001',
      },
      {
        localId: 'ui-cc-row-duplicate-key',
        locationId: '',
        productId: 'prod-cc-runtime',
        productName: 'Runtime CC product duplicate',
        sku: 'CC-RUNTIME',
        variantId: '',
        variantName: 'UI variant label',
        lotId: '',
        serialId: '',
        qtyCounted: '1,25001',
      },
    ],
  }), {
    items: [
      {
        locationId: null,
        productId: 'prod-cc-runtime',
        variantId: null,
        lotId: null,
        serialId: null,
        qtyCounted: 3.5,
      },
      {
        locationId: null,
        productId: 'prod-cc-runtime',
        variantId: null,
        lotId: null,
        serialId: null,
        qtyCounted: 1.25,
      },
    ],
  });

  const transferExecuteExistingCalls = [];
  const adjustmentPostExistingCalls = [];
  const cycleCountReconcileExistingCalls = [];
  const cycleCountAddItemsCalls = [];
  const receiptCorrectionCalls = [];
  const shipmentCorrectionCalls = [];
  const registry = createDocumentAdapterRegistry({
    permissions: ['wms:document:create', 'wms:document:update', 'wms:document:post', 'wms:document:correct', 'wms:read'],
    triggers: {
      receipt: {
        createReceipt: (payload) => makeUnwrap({ id: 'receipt-1', status: 'draft', payload }),
        fetchReceiptById: () => makeUnwrap({ items: [{ id: 'ri-1', qtyExpected: 2, qtyReceived: 0 }] }),
        updateReceiptDraft: (payload) => makeUnwrap({ id: payload.id, status: 'draft', headerPatch: payload.payload }),
        addReceiptDraftItem: (payload) => makeUnwrap({ id: payload.id, status: 'draft', items: [{ id: 'ri-new', ...payload.payload }] }),
        updateReceiptDraftItem: (payload) => makeUnwrap({ id: payload.id, status: 'draft', itemPatch: payload.payload }),
        removeReceiptDraftItem: (payload) => makeUnwrap({ id: payload.id, status: 'draft', removed: payload.itemId }),
        receiveReceiptLine: (payload) => makeUnwrap({ id: payload.itemId }),
        createReceiptCorrection: (payload) => {
          receiptCorrectionCalls.push(payload);
          return makeUnwrap({ id: 'receipt-correction-1', status: 'received' });
        },
        printDocument: (payload) => makeUnwrap({ url: `/print/${payload.id}` }),
      },
      shipment: {
        createShipment: (payload) => makeUnwrap({ id: 'shipment-1', status: 'packing', items: [{ id: 'si-1', qty: 1 }], payload }),
        fetchShipmentById: () => makeUnwrap({ id: 'shipment-1', status: 'shipped', items: [{ id: 'si-1', qty: 5 }, { id: 'si-2', qty: 2 }] }),
        fetchShipmentStockMoves: () => makeUnwrap({ items: [{ refItemId: 'si-1', type: 'ship', qty: 2 }, { refItemId: 'si-2', type: 'ship', qty: 2 }] }),
        shipShipmentItem: (payload) => makeUnwrap({ id: payload.itemId }),
        createShipmentCorrection: (payload) => {
          shipmentCorrectionCalls.push(payload);
          return makeUnwrap({ id: 'shipment-correction-1', status: 'shipped' });
        },
        printDocument: (payload) => makeUnwrap({ url: `/print/${payload.id}` }),
      },
      transfer: {
        createTransfer: (payload) => makeUnwrap({ id: 'transfer-1', status: 'draft', items: [{ id: 'ti-1', qty: 1, movedQty: 0 }], payload }),
        fetchTransferById: () => makeUnwrap({ id: 'transfer-1', status: 'completed', items: [{ id: 'ti-1', qty: 4 }, { id: 'ti-2', qty: 2 }] }),
        fetchTransferStockMoves: () => makeUnwrap({ items: [
          { refItemId: 'ti-1', type: 'transfer', qty: 1 },
          { refItemId: 'ti-1', type: 'transfer', qty: 1 },
          { refItemId: 'ti-2', type: 'transfer', qty: 2 },
          { refItemId: 'ti-2', type: 'transfer', qty: 2 },
        ] }),
        executeTransferLine: (payload) => {
          transferExecuteExistingCalls.push(payload);
          return makeUnwrap({ id: payload.itemId });
        },
        printDocument: (payload) => makeUnwrap({ url: `/print/${payload.id}` }),
      },
      adjustment: {
        createAdjustment: (payload) => makeUnwrap({ id: 'adjustment-1', status: 'draft', payload }),
        fetchAdjustmentById: () => makeUnwrap({ id: 'adjustment-1', status: 'draft', documentType: 'RW' }),
        postAdjustment: (payload) => {
          adjustmentPostExistingCalls.push(payload);
          return makeUnwrap({ id: payload.id, status: 'posted' });
        },
        printDocument: (payload) => makeUnwrap({ url: `/print/${payload.id}` }),
      },
      cycleCount: {
        createCycleCount: (payload) => makeUnwrap({ id: 'count-1', status: 'planned', payload }),
        fetchCycleCountById: () => makeUnwrap({ id: 'count-1', status: 'reconciled', items: [{ id: 'cci-1' }] }),
        addCycleCountItems: (payload) => {
          cycleCountAddItemsCalls.push(payload);
          return makeUnwrap({ id: payload.id, items: payload.items });
        },
        reconcileCycleCount: (payload) => {
          cycleCountReconcileExistingCalls.push(payload);
          return makeUnwrap({ id: payload.id, status: 'reconciled', adjustments: [] });
        },
        printDocument: (payload) => makeUnwrap({ url: `/print/${payload.id}` }),
      },
    },
  });

  assert.deepEqual(registry.keys(), ['receipt', 'shipment', 'transfer', 'adjustment', 'cycleCount']);
  assert.equal(registry.get('receipt').supports(ACTIONS.SAVE), true);
  assert.equal(registry.get('receipt').supports(ACTIONS.LOAD_DRAFT), true);
  assert.equal(registry.get('receipt').supports(ACTIONS.ADD_ITEM), true);
  assert.equal(registry.get('receipt').supports(ACTIONS.RECEIVE_EXISTING), true);
  assert.equal(registry.get('receipt').supports(ACTIONS.CORRECT), true);
  assert.equal(registry.get('shipment').supports(ACTIONS.SHIP), true);
  assert.equal(registry.get('shipment').supports(ACTIONS.SHIP_EXISTING), true);
  assert.equal(registry.get('shipment').supports(ACTIONS.CORRECT), true);
  assert.equal(registry.get('transfer').permissionFor(ACTIONS.EXECUTE), 'wms:document:post');
  assert.equal(registry.get('transfer').supports(ACTIONS.EXECUTE_EXISTING), true);
  assert.equal(registry.get('adjustment').supports(ACTIONS.RECEIVE), false);
  assert.equal(registry.get('adjustment').supports(ACTIONS.POST_EXISTING), true);
  assert.equal(registry.get('cycleCount').supports(ACTIONS.RECONCILE), true);
  assert.equal(registry.get('cycleCount').supports(ACTIONS.RECONCILE_EXISTING), true);

  const receiveExistingResult = await registry.get('receipt').run(ACTIONS.RECEIVE_EXISTING, {
    id: 'receipt-1',
    header: { inboundLocationId: '' },
    rows: [
      { id: 'ri-1', qtyExpected: 2, qtyReceived: 0 },
      { id: 'ri-done', qtyExpected: 1, qtyReceived: 1 },
      { localId: 'ui-only', qtyExpected: 4, qtyReceived: 0 },
    ],
  });
  assert.equal(receiveExistingResult.ok, true);
  assert.equal(receiveExistingResult.documentId, 'receipt-1');

  const receiptCorrectionResult = await registry.get('receipt').run(ACTIONS.CORRECT, {
    id: 'receipt-1',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'ri-1', qty: 2 }],
    },
  });
  assert.equal(receiptCorrectionResult.ok, true);
  assert.equal(receiptCorrectionResult.documentId, 'receipt-correction-1');
  assert.deepEqual(receiptCorrectionCalls, [{
    id: 'receipt-1',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'ri-1', qty: 2 }],
    },
  }]);

  const shipExistingResult = await registry.get('shipment').run(ACTIONS.SHIP_EXISTING, {
    id: 'shipment-1',
    header: { fromLocationId: '' },
    rows: [
      { id: 'si-1', qty: 5 },
      { id: 'si-2', qty: 2 },
      { localId: 'ui-only', qty: 5 },
    ],
  });
  assert.equal(shipExistingResult.ok, true);
  assert.equal(shipExistingResult.documentId, 'shipment-1');
  assert.equal(shipExistingResult.status, 'shipped');

  const shipmentCorrectionResult = await registry.get('shipment').run(ACTIONS.CORRECT, {
    id: 'shipment-1',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'si-1', qty: 5 }],
    },
  });
  assert.equal(shipmentCorrectionResult.ok, true);
  assert.equal(shipmentCorrectionResult.documentId, 'shipment-correction-1');
  assert.deepEqual(shipmentCorrectionCalls, [{
    id: 'shipment-1',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'si-1', qty: 5 }],
    },
  }]);

  transferExecuteExistingCalls.length = 0;
  const executeExistingResult = await registry.get('transfer').run(ACTIONS.EXECUTE_EXISTING, {
    id: 'transfer-1',
    header: { sourceLocationId: '', targetLocationId: '' },
    rows: [
      { id: 'ti-1', qty: 4 },
      { id: 'ti-2', qty: 2 },
      { localId: 'ui-only', qty: 3 },
    ],
  });
  assert.equal(executeExistingResult.ok, true);
  assert.equal(executeExistingResult.documentId, 'transfer-1');
  assert.equal(executeExistingResult.status, 'completed');
  assert.deepEqual(transferExecuteExistingCalls, [{
    itemId: 'ti-1',
    payload: { fromLocationId: null, toLocationId: null, qty: 3 },
  }]);

  adjustmentPostExistingCalls.length = 0;
  const adjustmentPostExistingResult = await registry.get('adjustment').run(ACTIONS.POST_EXISTING, {
    id: 'adjustment-1',
  });
  assert.equal(adjustmentPostExistingResult.ok, true);
  assert.equal(adjustmentPostExistingResult.documentId, 'adjustment-1');
  assert.equal(adjustmentPostExistingResult.status, 'posted');
  assert.deepEqual(adjustmentPostExistingCalls, [{ id: 'adjustment-1' }]);

  cycleCountReconcileExistingCalls.length = 0;
  cycleCountAddItemsCalls.length = 0;
  const cycleCountReconcileExistingResult = await registry.get('cycleCount').run(ACTIONS.RECONCILE_EXISTING, {
    id: 'count-1',
    rows,
  });
  assert.equal(cycleCountReconcileExistingResult.ok, true);
  assert.equal(cycleCountReconcileExistingResult.documentId, 'count-1');
  assert.equal(cycleCountReconcileExistingResult.status, 'reconciled');
  assert.deepEqual(cycleCountReconcileExistingCalls, [{ id: 'count-1' }]);
  assert.deepEqual(cycleCountAddItemsCalls, []);

  assert.deepEqual(mapAdapterResult({ id: 'doc-1', status: 'draft' }), {
    ok: true,
    documentId: 'doc-1',
    status: 'draft',
    warnings: [],
    errors: [],
    raw: { id: 'doc-1', status: 'draft' },
  });

  assert.equal(mapAdapterError({ status: 400, data: { code: 'VALIDATION_ERROR', message: 'Bad payload' } }).errors[0].klass, 'validation');
  assert.equal(mapAdapterError({ status: 403, data: { code: 'FORBIDDEN', message: 'Forbidden' } }).errors[0].klass, 'permission');
  assert.equal(mapAdapterError({ status: 409, data: { code: 'INSUFFICIENT_STOCK', message: 'No stock' } }).errors[0].klass, 'business');
  assert.equal(mapAdapterError({ error: 'Network down' }).errors[0].klass, 'transport');

  assert.equal((await registry.get('receipt').run(ACTIONS.SAVE, { header, rows })).documentId, 'receipt-1');
  assert.equal((await registry.get('receipt').run(ACTIONS.ADD_ITEM, { id: 'receipt-draft-1', row: rows[0] })).itemId, 'ri-new');
  assert.equal((await registry.get('receipt').run(ACTIONS.UPDATE_ITEM, { id: 'receipt-draft-1', itemId: 'ri-1', row: rows[0] })).status, 'draft');
  assert.equal((await registry.get('receipt').run(ACTIONS.REMOVE_ITEM, { id: 'receipt-draft-1', itemId: 'ri-1' })).status, 'draft');
  assert.equal((await registry.get('shipment').run(ACTIONS.SAVE, { header, rows })).documentId, 'shipment-1');
  assert.equal((await registry.get('transfer').run(ACTIONS.SAVE, { header, rows })).documentId, 'transfer-1');
  assert.equal((await registry.get('adjustment').run(ACTIONS.SAVE, { header, rows })).documentId, 'adjustment-1');
  assert.equal((await registry.get('adjustment').run(ACTIONS.POST, { header, rows })).status, 'posted');
  assert.equal((await registry.get('cycleCount').run(ACTIONS.SAVE, { header, rows: [] })).documentId, 'count-1');
  cycleCountAddItemsCalls.length = 0;
  assert.equal((await registry.get('cycleCount').run(ACTIONS.RECONCILE, { id: 'count-1', rows })).status, 'reconciled');
  assert.equal(cycleCountAddItemsCalls.length > 0, true);

  console.log('SHELL-0.5 adapter registry smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
