const assert = require('node:assert/strict');

async function main() {
  const { createReceiptShellAdapter } = await import('./createReceiptShellAdapter.js');
  const {
    createShipmentShellAdapter,
    mergeShipmentRowsWithShippedQty,
    shippedQtyByShipmentItem,
  } = await import('./createShipmentShellAdapter.js');
  const {
    createTransferShellAdapter,
    mergeTransferRowsWithMovedQty,
  } = await import('./createTransferShellAdapter.js');
  const { createAdjustmentShellAdapter } = await import('./createAdjustmentShellAdapter.js');
  const { createCycleCountShellAdapter } = await import('./createCycleCountShellAdapter.js');
  const { default: pzConfig } = await import('../documentTypes/pz.config.js');
  const { default: wzConfig } = await import('../documentTypes/wz.config.js');
  const { default: mmConfig } = await import('../documentTypes/mm.config.js');
  const { default: rwConfig } = await import('../documentTypes/rw.config.js');
  const { default: pwConfig } = await import('../documentTypes/pw.config.js');
  const { default: ccConfig } = await import('../documentTypes/cc.config.js');
  const { computeSummary } = await import('./summaryEngine.js');
  const { runValidationRules } = await import('./validationEngine.js');
  const { getKeyboardPreset } = await import('./keyboardPresets.js');
  const {
    getPickerContext,
    getScanMode,
    getScanResultKey,
    getScanResultMeta,
    getScanResultTitle,
  } = await import('./useScannerModule.js');
  const {
    areDraftItemSnapshotsEqual,
    createEmptyRow,
    getPersistableRows,
    getRowSnapshot,
    isAutoRowEnabled,
    isExactProductPickerScanMatch,
    mapProductPickerRowToPzRowPatch,
    mapReceiptToShellDraft,
    mapReceiptToShellPosted,
    normalizeProductPickerRows,
    normalizeRows,
  } = await import('./rowControllerModel.js');
  const {
    mapAdjustmentToShellPosted,
    mapCycleCountToShellPosted,
    mapShipmentToShellPosted,
    mapTransferToShellPosted,
  } = await import('./postedViewMappers.js');
  const qtyField = pzConfig.qtyField;
  const keyboard = getKeyboardPreset(pzConfig.rowController.keyboardPreset);
  const productColumn = pzConfig.columns.find((column) => column.type === 'product');
  const qtyColumn = pzConfig.columns.find((column) => column.type === 'qty');

  const makeEvent = (key) => ({
    key,
    defaultPrevented: false,
    preventDefault() {
      this.defaultPrevented = true;
    },
  });

  const focusCalls = [];
  const keyboardRow = {
    ...createEmptyRow(pzConfig),
    localId: 'keyboard-row',
    productId: 'keyboard-product',
    [qtyField]: '2',
  };
  const productEnter = makeEvent('Enter');
  keyboard.handleKeyDown(productEnter, {
    column: productColumn,
    config: pzConfig,
    row: keyboardRow,
    focusQty: (localId) => focusCalls.push(['qty', localId]),
  });
  assert.equal(productEnter.defaultPrevented, true);
  assert.deepEqual(focusCalls, [['qty', 'keyboard-row']]);

  const escapeEvent = makeEvent('Escape');
  keyboard.handleKeyDown(escapeEvent, {
    column: productColumn,
    config: pzConfig,
    row: keyboardRow,
    closePicker: () => focusCalls.push(['closePicker']),
  });
  assert.equal(escapeEvent.defaultPrevented, true);
  assert.deepEqual(focusCalls[focusCalls.length - 1], ['closePicker']);

  const qtyEnter = makeEvent('Enter');
  keyboard.handleKeyDown(qtyEnter, {
    column: qtyColumn,
    config: pzConfig,
    row: keyboardRow,
    onQtyCommit: (row) => focusCalls.push(['commit', row.localId]),
  });
  assert.equal(qtyEnter.defaultPrevented, true);
  assert.deepEqual(focusCalls[focusCalls.length - 1], ['commit', 'keyboard-row']);
  assert.deepEqual(
    keyboard.getEditableColumns(pzConfig).map((column) => column.key),
    ['product', 'qtyExpected', 'lotNumber', 'unitCost', 'currency']
  );
  assert.equal(getScanMode(pzConfig), 'newLine');
  assert.equal(getPickerContext(pzConfig), 'purchase');
  const postedReceiptModel = mapReceiptToShellPosted({
    id: 'receipt-posted-1',
    number: 'PZ-POSTED-1',
    status: 'received',
    warehouseId: 'warehouse-pz',
    inboundLocationId: null,
    supplierName: 'Supplier A',
    sourceRef: 'PO-1',
    issueDate: '2026-06-20T10:00:00.000Z',
    items: [{
      id: 'receipt-line-1',
      productId: 'prod-pz',
      productName: 'Posted product',
      sku: 'PZ-SKU',
      qtyExpected: '5',
      qtyReceived: '5',
      lotNumber: 'LOT-1',
      unitCost: '10',
      currency: 'PLN',
    }],
  }, pzConfig);
  assert.equal(postedReceiptModel.header.documentNumber, 'PZ-POSTED-1');
  assert.equal(postedReceiptModel.header.status, 'received');
  assert.equal(postedReceiptModel.header.inboundLocationId, '');
  assert.equal(postedReceiptModel.header.counterpartyId, 'Supplier A');
  assert.equal(postedReceiptModel.rows.length, 1);
  assert.equal(postedReceiptModel.rows[0].qtyExpected, '5');
  assert.equal(postedReceiptModel.rows[0].qtyReceived, '5');

  const postedShipmentModel = mapShipmentToShellPosted({
    id: 'shipment-posted-1',
    number: 'WZ-POSTED-1',
    status: 'shipped',
    warehouseId: 'warehouse-wz',
    fromLocationId: null,
    items: [{ id: 'wz-line-posted-1', productId: 'prod-wz', productName: 'Shipped product', qty: 7, qtyShipped: 7 }],
  });
  assert.equal(postedShipmentModel.header.documentNumber, 'WZ-POSTED-1');
  assert.equal(postedShipmentModel.header.status, 'shipped');
  assert.equal(postedShipmentModel.rows[0].qty, '7');
  assert.equal(postedShipmentModel.rows[0].qtyShipped, '7');

  const postedTransferModel = mapTransferToShellPosted({
    id: 'transfer-posted-1',
    number: 'MM-POSTED-1',
    status: 'completed',
    fromWarehouseId: 'warehouse-from',
    toWarehouseId: 'warehouse-to',
    items: [{ id: 'mm-line-posted-1', productId: 'prod-mm', productName: 'Moved product', qty: 4, movedQty: 4 }],
  });
  assert.equal(postedTransferModel.header.documentNumber, 'MM-POSTED-1');
  assert.equal(postedTransferModel.header.status, 'completed');
  assert.equal(postedTransferModel.rows[0].qty, '4');
  assert.equal(postedTransferModel.rows[0].movedQty, '4');

  const postedAdjustmentModel = mapAdjustmentToShellPosted({
    id: 'adjustment-posted-1',
    number: 'RW-POSTED-1',
    documentType: 'RW',
    status: 'posted',
    warehouseId: 'warehouse-rw',
    reason: 'Stock correction',
    items: [{ id: 'rw-line-posted-1', productId: 'prod-rw', productName: 'Adjusted product', qtyDelta: -2 }],
  }, rwConfig);
  assert.equal(postedAdjustmentModel.header.documentNumber, 'RW-POSTED-1');
  assert.equal(postedAdjustmentModel.header.documentType, 'RW');
  assert.equal(postedAdjustmentModel.rows[0].qtyDelta, '-2');

  const postedCycleCountModel = mapCycleCountToShellPosted({
    id: 'cc-posted-1',
    number: 'CC-POSTED-1',
    status: 'reconciled',
    warehouseId: 'warehouse-cc',
    items: [{ id: 'cc-line-posted-1', productId: 'prod-cc', productName: 'Counted product', systemQty: 3, qtyCounted: 4 }],
  });
  assert.equal(postedCycleCountModel.header.documentNumber, 'CC-POSTED-1');
  assert.equal(postedCycleCountModel.header.status, 'reconciled');
  assert.equal(postedCycleCountModel.rows[0].systemQty, '3');
  assert.equal(postedCycleCountModel.rows[0].qtyCounted, '4');
  assert.equal(postedCycleCountModel.rows[0].difference, '1');

  const wzQtyField = wzConfig.qtyField;
  const wzEmptyRow = createEmptyRow(wzConfig);
  assert.equal(wzQtyField, 'qty');
  assert.equal(isAutoRowEnabled(wzConfig), false);
  assert.equal(Object.prototype.hasOwnProperty.call(wzEmptyRow, 'qty'), true);
  assert.equal(normalizeRows([{ ...wzEmptyRow, productId: 'prod-wz', [wzQtyField]: '2' }], wzConfig).length, 1);
  assert.deepEqual(
    getKeyboardPreset(wzConfig.rowController.keyboardPreset).getEditableColumns(wzConfig).map((column) => column.key),
    ['product', 'qty']
  );

  const wzDraftValidation = runValidationRules(wzConfig, {
    header: { warehouseId: '' },
    rows: [{ ...wzEmptyRow, localId: 'wz-row-1', productName: 'Typed product', [wzQtyField]: '' }],
    persistableRows: [],
    mode: 'create',
    qtyField: wzQtyField,
  });
  assert.equal(wzDraftValidation.blocking.length, 3);
  assert.equal(wzDraftValidation.byField.warehouseId, 'Warehouse is required');
  assert.equal(wzDraftValidation.byRow['wz-row-1'].blocking.productId, 'Product is required');
  assert.equal(wzDraftValidation.byRow['wz-row-1'].blocking.qty, 'Qty must be greater than 0');

  let capturedShipmentPayload = null;
  let capturedShipmentCorrectionPayload = null;
  let shipCalls = 0;
  const shipmentAdapter = createShipmentShellAdapter({
    triggers: {
      createShipment: (payload) => {
        capturedShipmentPayload = payload;
        return { unwrap: async () => ({ id: 'shipment-shell-1', status: 'packing' }) };
      },
      shipShipmentItem: () => {
        shipCalls += 1;
        return { unwrap: async () => ({ id: 'should-not-ship' }) };
      },
      createShipmentCorrection: (arg) => {
        capturedShipmentCorrectionPayload = arg;
        return { unwrap: async () => ({ id: 'shipment-correction-shell-1', status: 'shipped' }) };
      },
    },
    permissions: { can: () => true },
  });
  assert.equal(shipmentAdapter.supports('save'), true);
  assert.equal(shipmentAdapter.supports('ship'), false);
  assert.equal(shipmentAdapter.supports('shipExisting'), true);
  assert.equal(shipmentAdapter.supports('correct'), true);
  const shipmentResult = await shipmentAdapter.run('save', {
    header: {
      warehouseId: 'warehouse-wz-shell',
      orderId: 'order-wz-shell',
      fromLocationId: 'ignored-location',
      issueDate: '2026-06-16',
      notes: 'ignored notes',
    },
    rows: [{
      localId: 'wz-ready-row',
      productId: 'prod-wz-shell',
      variantId: '',
      productName: 'WZ Shell product',
      sku: 'WZ-SHELL',
      [wzQtyField]: '8,50001',
    }],
  });
  assert.deepEqual(capturedShipmentPayload, {
    warehouseId: 'warehouse-wz-shell',
    orderId: 'order-wz-shell',
    items: [{ productId: 'prod-wz-shell', variantId: undefined, qty: 8.5 }],
  });
  assert.equal(shipmentResult.ok, true);
  assert.equal(shipmentResult.documentId, 'shipment-shell-1');
  assert.equal(shipmentResult.status, 'packing');
  assert.equal(shipCalls, 0);

  const shipmentCorrectionResult = await shipmentAdapter.run('correct', {
    id: 'shipment-posted-shell',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'wz-line-1', qty: 5 }],
    },
  });
  assert.equal(shipmentCorrectionResult.ok, true);
  assert.equal(shipmentCorrectionResult.documentId, 'shipment-correction-shell-1');
  assert.deepEqual(capturedShipmentCorrectionPayload, {
    id: 'shipment-posted-shell',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'wz-line-1', qty: 5 }],
    },
  });

  assert.deepEqual(shippedQtyByShipmentItem([
    { refItemId: 'wz-line-1', type: 'ship', qty: '1.25' },
    { refItemId: 'wz-line-1', type: 'ship', qty: '0.75' },
    { refItemId: 'wz-line-2', type: 'receive', qty: '99' },
  ]), { 'wz-line-1': 2 });
  assert.deepEqual(mergeShipmentRowsWithShippedQty([
    { id: 'wz-line-1', qty: 5 },
    { id: 'wz-line-2', qty: 1, qtyShipped: 1 },
  ], [
    { refItemId: 'wz-line-1', type: 'ship', qty: 2 },
  ]).map((row) => ({ id: row.id, qtyShipped: row.qtyShipped })), [
    { id: 'wz-line-1', qtyShipped: 2 },
    { id: 'wz-line-2', qtyShipped: 1 },
  ]);

  const shipExistingCalls = [];
  const shipExistingAdapter = createShipmentShellAdapter({
    triggers: {
      fetchShipmentById: () => ({ id: 'shipment-existing-1', status: 'packing', items: [
        { id: 'wz-line-1', productId: 'prod-1', qty: 5 },
        { id: 'wz-line-2', productId: 'prod-2', qty: 2 },
        { id: 'wz-line-3', productId: 'prod-3', qty: 1 },
      ] }),
      fetchShipmentStockMoves: () => ({ items: [
        { refItemId: 'wz-line-1', type: 'ship', qty: 2 },
        { refItemId: 'wz-line-2', type: 'ship', qty: 2 },
      ] }),
      shipShipmentItem: (payload) => {
        shipExistingCalls.push(payload);
        return { unwrap: async () => ({ id: payload.itemId, status: 'packing' }) };
      },
    },
    permissions: { can: () => true },
  });
  const shipExistingResult = await shipExistingAdapter.run('shipExisting', {
    id: 'shipment-existing-1',
    header: { fromLocationId: '' },
    rows: [
      { id: 'wz-line-1', productId: 'prod-1', qty: 5 },
      { id: 'wz-line-2', productId: 'prod-2', qty: 2 },
      { id: 'wz-line-3', productId: 'prod-3', qty: 1, qtyShipped: 1 },
      { localId: 'ui-only', productId: 'prod-ui', qty: 8 },
    ],
  });
  assert.equal(shipExistingResult.ok, true);
  assert.equal(shipExistingResult.documentId, 'shipment-existing-1');
  assert.deepEqual(shipExistingCalls, [{
    itemId: 'wz-line-1',
    shipmentId: 'shipment-existing-1',
    payload: { qty: 3, fromLocationId: null },
  }]);

  const mmQtyField = mmConfig.qtyField;
  const mmEmptyRow = createEmptyRow(mmConfig);
  assert.equal(mmQtyField, 'qty');
  assert.equal(isAutoRowEnabled(mmConfig), false);
  assert.equal(Object.prototype.hasOwnProperty.call(mmEmptyRow, 'qty'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(mmEmptyRow, 'qtyExpected'), false);
  assert.equal(normalizeRows([{ ...mmEmptyRow, productId: 'prod-mm', [mmQtyField]: '3' }], mmConfig).length, 1);
  assert.deepEqual(
    getKeyboardPreset(mmConfig.rowController.keyboardPreset).getEditableColumns(mmConfig).map((column) => column.key),
    ['product', 'qty']
  );

  const mmDraftValidation = runValidationRules(mmConfig, {
    header: { fromWarehouseId: '', toWarehouseId: '' },
    rows: [{ ...mmEmptyRow, localId: 'mm-row-1', productName: 'Typed product', [mmQtyField]: '' }],
    persistableRows: [],
    mode: 'create',
    qtyField: mmQtyField,
  });
  assert.equal(mmDraftValidation.blocking.length, 4);
  assert.equal(mmDraftValidation.byField.fromWarehouseId, 'From warehouse is required');
  assert.equal(mmDraftValidation.byField.toWarehouseId, 'To warehouse is required');
  assert.equal(mmDraftValidation.byRow['mm-row-1'].blocking.productId, 'Product is required');
  assert.equal(mmDraftValidation.byRow['mm-row-1'].blocking.qty, 'Qty must be greater than 0');

  let capturedTransferPayload = null;
  let executeCalls = 0;
  const transferAdapter = createTransferShellAdapter({
    triggers: {
      createTransfer: (payload) => {
        capturedTransferPayload = payload;
        return { unwrap: async () => ({ id: 'transfer-shell-1', status: 'draft' }) };
      },
      executeTransferLine: () => {
        executeCalls += 1;
        return { unwrap: async () => ({ id: 'should-not-execute' }) };
      },
    },
    permissions: { can: () => true },
  });
  assert.equal(transferAdapter.supports('save'), true);
  assert.equal(transferAdapter.supports('execute'), false);
  assert.equal(transferAdapter.supports('executeExisting'), true);
  const transferResult = await transferAdapter.run('save', {
    header: {
      fromWarehouseId: 'warehouse-mm-from',
      toWarehouseId: 'warehouse-mm-to',
      sourceLocationId: '',
      targetLocationId: '',
      issueDate: '',
    },
    rows: [{
      localId: 'mm-ready-row',
      productId: 'prod-mm-shell',
      variantId: '',
      productName: 'MM Shell product',
      sku: 'MM-SHELL',
      [mmQtyField]: '5,25001',
    }],
  });
  assert.deepEqual(capturedTransferPayload, {
    fromWarehouseId: 'warehouse-mm-from',
    toWarehouseId: 'warehouse-mm-to',
    sourceLocationId: null,
    targetLocationId: null,
    issueDate: null,
    items: [{ productId: 'prod-mm-shell', variantId: null, qty: 5.25 }],
  });
  assert.equal(transferResult.ok, true);
  assert.equal(transferResult.documentId, 'transfer-shell-1');
  assert.equal(transferResult.status, 'draft');
  assert.equal(executeCalls, 0);

  assert.deepEqual(mergeTransferRowsWithMovedQty([
    { id: 'mm-line-1', qty: 5 },
    { id: 'mm-line-2', qty: 1, movedQty: 1 },
  ], [
    { refItemId: 'mm-line-1', type: 'transfer', qty: 2 },
    { refItemId: 'mm-line-1', type: 'transfer', qty: 2 },
  ]).map((row) => ({ id: row.id, movedQty: row.movedQty })), [
    { id: 'mm-line-1', movedQty: 2 },
    { id: 'mm-line-2', movedQty: 1 },
  ]);

  const executeExistingCalls = [];
  const executeExistingAdapter = createTransferShellAdapter({
    triggers: {
      fetchTransferById: () => ({ id: 'transfer-existing-1', status: 'draft', items: [
        { id: 'mm-line-1', productId: 'prod-1', qty: 5 },
        { id: 'mm-line-2', productId: 'prod-2', qty: 2 },
        { id: 'mm-line-3', productId: 'prod-3', qty: 1 },
      ] }),
      fetchTransferStockMoves: () => ({ items: [
        { refItemId: 'mm-line-1', type: 'transfer', qty: 2 },
        { refItemId: 'mm-line-1', type: 'transfer', qty: 2 },
        { refItemId: 'mm-line-2', type: 'transfer', qty: 2 },
        { refItemId: 'mm-line-2', type: 'transfer', qty: 2 },
      ] }),
      executeTransferLine: (payload) => {
        executeExistingCalls.push(payload);
        return { unwrap: async () => ({ id: payload.itemId, status: 'draft' }) };
      },
    },
    permissions: { can: () => true },
  });
  const executeExistingResult = await executeExistingAdapter.run('executeExisting', {
    id: 'transfer-existing-1',
    header: { sourceLocationId: '', targetLocationId: '' },
    rows: [
      { id: 'mm-line-1', productId: 'prod-1', qty: 5 },
      { id: 'mm-line-2', productId: 'prod-2', qty: 2 },
      { id: 'mm-line-3', productId: 'prod-3', qty: 1, movedQty: 1 },
      { localId: 'ui-only', productId: 'prod-ui', qty: 8 },
    ],
  });
  assert.equal(executeExistingResult.ok, true);
  assert.equal(executeExistingResult.documentId, 'transfer-existing-1');
  assert.deepEqual(executeExistingCalls, [{
    itemId: 'mm-line-1',
    payload: { fromLocationId: null, toLocationId: null, qty: 3 },
  }]);

  const rwQtyField = rwConfig.qtyField;
  const pwQtyField = pwConfig.qtyField;
  const rwEmptyRow = createEmptyRow(rwConfig);
  const pwEmptyRow = createEmptyRow(pwConfig);
  assert.equal(rwQtyField, 'qtyDelta');
  assert.equal(pwQtyField, 'qtyDelta');
  assert.equal(isAutoRowEnabled(rwConfig), false);
  assert.equal(isAutoRowEnabled(pwConfig), false);
  assert.equal(Object.prototype.hasOwnProperty.call(rwEmptyRow, 'qtyDelta'), true);
  assert.equal(Object.prototype.hasOwnProperty.call(pwEmptyRow, 'qtyDelta'), true);
  assert.deepEqual(
    getKeyboardPreset(rwConfig.rowController.keyboardPreset).getEditableColumns(rwConfig).map((column) => column.key),
    ['product', 'qtyDelta']
  );
  assert.deepEqual(
    getKeyboardPreset(pwConfig.rowController.keyboardPreset).getEditableColumns(pwConfig).map((column) => column.key),
    ['product', 'qtyDelta']
  );

  const rwValidation = runValidationRules(rwConfig, {
    header: { documentType: 'RW', warehouseId: '', reason: '' },
    rows: [{ ...rwEmptyRow, localId: 'rw-row-1', productName: 'Typed product', [rwQtyField]: '' }],
    persistableRows: [],
    mode: 'create',
    qtyField: rwQtyField,
  });
  assert.equal(rwValidation.blocking.length, 4);
  assert.equal(rwValidation.byField.warehouseId, 'Warehouse is required');
  assert.equal(rwValidation.byField.reason, 'Reason is required');
  assert.equal(rwValidation.byRow['rw-row-1'].blocking.productId, 'Product is required');
  assert.equal(rwValidation.byRow['rw-row-1'].blocking.qtyDelta, 'Qty must be greater than 0');

  const pwValidation = runValidationRules(pwConfig, {
    header: { documentType: 'PW', warehouseId: '', reason: '' },
    rows: [{ ...pwEmptyRow, localId: 'pw-row-1', productName: 'Typed product', [pwQtyField]: '' }],
    persistableRows: [],
    mode: 'create',
    qtyField: pwQtyField,
  });
  assert.equal(pwValidation.blocking.length, 4);
  assert.equal(pwValidation.byField.warehouseId, 'Warehouse is required');
  assert.equal(pwValidation.byField.reason, 'Reason is required');
  assert.equal(pwValidation.byRow['pw-row-1'].blocking.productId, 'Product is required');
  assert.equal(pwValidation.byRow['pw-row-1'].blocking.qtyDelta, 'Qty must be greater than 0');

  let capturedAdjustmentPayload = null;
  let createAdjustmentCalls = 0;
  let postAdjustmentCalls = 0;
  let fetchAdjustmentCalls = 0;
  const postExistingCalls = [];
  const adjustmentAdapter = createAdjustmentShellAdapter({
    triggers: {
      createAdjustment: (payload) => {
        createAdjustmentCalls += 1;
        capturedAdjustmentPayload = payload;
        return { unwrap: async () => ({ id: 'adjustment-shell-1', status: 'draft' }) };
      },
      fetchAdjustmentById: () => {
        fetchAdjustmentCalls += 1;
        return {
          id: 'adjustment-existing-1',
          status: fetchAdjustmentCalls > 1 ? 'posted' : 'draft',
          documentType: 'RW',
        };
      },
      postAdjustment: (payload) => {
        postAdjustmentCalls += 1;
        postExistingCalls.push(payload);
        return { unwrap: async () => ({ id: payload.id, status: 'posted' }) };
      },
    },
    permissions: { can: () => true },
  });
  assert.equal(adjustmentAdapter.supports('save'), true);
  assert.equal(adjustmentAdapter.supports('post'), false);
  assert.equal(adjustmentAdapter.supports('postExisting'), true);
  const rwAdjustmentResult = await adjustmentAdapter.run('save', {
    header: {
      documentType: 'RW',
      warehouseId: 'warehouse-rw-shell',
      locationId: '',
      reason: 'Runtime correction',
      issueDate: '',
    },
    rows: [{
      localId: 'rw-ready-row',
      productId: 'prod-rw-shell',
      variantId: '',
      productName: 'RW Shell product',
      sku: 'RW-SHELL',
      [rwQtyField]: '4,25001',
    }],
  });
  assert.deepEqual(capturedAdjustmentPayload, {
    documentType: 'RW',
    warehouseId: 'warehouse-rw-shell',
    reason: 'Runtime correction',
    issueDate: null,
    items: [{ productId: 'prod-rw-shell', variantId: null, locationId: null, qtyDelta: -4.25 }],
  });
  assert.equal(rwAdjustmentResult.ok, true);
  assert.equal(rwAdjustmentResult.documentId, 'adjustment-shell-1');
  assert.equal(rwAdjustmentResult.status, 'draft');
  assert.equal(createAdjustmentCalls, 1);
  assert.equal(postAdjustmentCalls, 0);

  const pwAdjustmentResult = await adjustmentAdapter.run('save', {
    header: {
      documentType: 'PW',
      warehouseId: 'warehouse-pw-shell',
      locationId: '',
      reason: 'Found stock',
      issueDate: '',
    },
    rows: [{
      localId: 'pw-ready-row',
      productId: 'prod-pw-shell',
      variantId: '',
      productName: 'PW Shell product',
      sku: 'PW-SHELL',
      [pwQtyField]: '6,50001',
    }],
  });
  assert.deepEqual(capturedAdjustmentPayload, {
    documentType: 'PW',
    warehouseId: 'warehouse-pw-shell',
    reason: 'Found stock',
    issueDate: null,
    items: [{ productId: 'prod-pw-shell', variantId: null, locationId: null, qtyDelta: 6.5 }],
  });
  assert.equal(pwAdjustmentResult.ok, true);
  assert.equal(pwAdjustmentResult.documentId, 'adjustment-shell-1');
  assert.equal(pwAdjustmentResult.status, 'draft');
  assert.equal(createAdjustmentCalls, 2);
  assert.equal(postAdjustmentCalls, 0);

  const postExistingResult = await adjustmentAdapter.run('postExisting', {
    id: 'adjustment-existing-1',
  });
  assert.equal(postExistingResult.ok, true);
  assert.equal(postExistingResult.documentId, 'adjustment-existing-1');
  assert.equal(postExistingResult.status, 'posted');
  assert.equal(createAdjustmentCalls, 2);
  assert.equal(postAdjustmentCalls, 1);
  assert.deepEqual(postExistingCalls, [{ id: 'adjustment-existing-1' }]);

  const ccQtyField = ccConfig.qtyField;
  assert.equal(ccQtyField, 'qtyCounted');
  assert.equal(ccConfig.rowController.enabled, false);
  assert.deepEqual(ccConfig.header.shellFields, ['warehouseId', 'locationId']);

  const ccValidation = runValidationRules(ccConfig, {
    header: { warehouseId: '' },
    rows: [],
    persistableRows: [],
    mode: 'create',
    qtyField: ccQtyField,
  });
  assert.equal(ccValidation.blocking.length, 1);
  assert.equal(ccValidation.byField.warehouseId, 'Warehouse is required');

  let capturedCycleCountPayload = null;
  let fetchCycleCountCalls = 0;
  let addCycleCountItemsCalls = 0;
  let reconcileCycleCountCalls = 0;
  const cycleCountAdapter = createCycleCountShellAdapter({
    triggers: {
      createCycleCount: (payload) => {
        capturedCycleCountPayload = payload;
        return { unwrap: async () => ({ id: 'cycle-count-shell-1', status: 'planned' }) };
      },
      fetchCycleCountById: () => {
        fetchCycleCountCalls += 1;
        return {
          id: 'cycle-count-existing-1',
          status: fetchCycleCountCalls > 1 ? 'reconciled' : 'counting',
          items: [{ id: 'cc-item-1', productId: 'prod-cc', qtyCounted: 2 }],
        };
      },
      addCycleCountItems: () => {
        addCycleCountItemsCalls += 1;
        return { unwrap: async () => ({ id: 'should-not-add-items' }) };
      },
      reconcileCycleCount: (payload) => {
        reconcileCycleCountCalls += 1;
        return { unwrap: async () => ({ id: payload.id, status: 'reconciled', adjustments: [] }) };
      },
    },
    permissions: { can: () => true },
  });
  assert.equal(cycleCountAdapter.supports('save'), true);
  assert.equal(cycleCountAdapter.supports('reconcile'), false);
  assert.equal(cycleCountAdapter.supports('reconcileExisting'), true);
  const cycleCountResult = await cycleCountAdapter.run('save', {
    header: {
      warehouseId: 'warehouse-cc-shell',
      locationId: '',
      createdAt: 'ignored',
    },
    rows: [],
  });
  assert.deepEqual(capturedCycleCountPayload, {
    warehouseId: 'warehouse-cc-shell',
  });
  assert.equal(cycleCountResult.ok, true);
  assert.equal(cycleCountResult.documentId, 'cycle-count-shell-1');
  assert.equal(cycleCountResult.status, 'planned');
  assert.equal(reconcileCycleCountCalls, 0);

  const reconcileExistingResult = await cycleCountAdapter.run('reconcileExisting', {
    id: 'cycle-count-existing-1',
    rows: [{ id: 'cc-item-1', productId: 'prod-cc', qtyCounted: 2 }],
  });
  assert.equal(reconcileExistingResult.ok, true);
  assert.equal(reconcileExistingResult.documentId, 'cycle-count-existing-1');
  assert.equal(reconcileExistingResult.status, 'reconciled');
  assert.equal(fetchCycleCountCalls, 2);
  assert.equal(addCycleCountItemsCalls, 0);
  assert.equal(reconcileCycleCountCalls, 1);

  let capturedPayload = null;
  let capturedCorrectionPayload = null;
  const draftCalls = [];
  const receiveCalls = [];
  const adapter = createReceiptShellAdapter({
    triggers: {
      createReceipt: (payload) => {
        capturedPayload = payload;
        return { unwrap: async () => ({ id: 'receipt-shell-1', status: 'draft' }) };
      },
      fetchReceiptById: (id) => ({
        unwrap: async () => ({
          id,
          status: receiveCalls.length ? 'received' : 'draft',
          items: [
            { id: 'line-receive-1', productId: 'prod-shell', [qtyField]: 5, qtyReceived: 2 },
            { id: 'line-receive-done', productId: 'prod-shell', [qtyField]: 1, qtyReceived: 1 },
          ],
        }),
      }),
      updateReceiptDraft: (arg) => {
        draftCalls.push(['header', arg]);
        return { unwrap: async () => ({ id: arg.id, status: 'draft' }) };
      },
      addReceiptDraftItem: (arg) => {
        draftCalls.push(['add', arg]);
        return { unwrap: async () => ({ id: arg.id, status: 'draft', items: [{ id: 'new-line-1', ...arg.payload }] }) };
      },
      updateReceiptDraftItem: (arg) => {
        draftCalls.push(['update', arg]);
        return { unwrap: async () => ({ id: arg.id, status: 'draft' }) };
      },
      removeReceiptDraftItem: (arg) => {
        draftCalls.push(['remove', arg]);
        return { unwrap: async () => ({ id: arg.id, status: 'draft' }) };
      },
      receiveReceiptLine: (arg) => {
        receiveCalls.push(arg);
        return { unwrap: async () => ({ id: arg.itemId, status: 'received' }) };
      },
      createReceiptCorrection: (arg) => {
        capturedCorrectionPayload = arg;
        return { unwrap: async () => ({ id: 'receipt-correction-shell-1', status: 'received' }) };
      },
    },
    permissions: { can: () => true },
  });

  const rows = [
    {
      localId: 'ready-row',
      productId: 'prod-shell',
      variantId: '',
      productName: 'Shell product',
      sku: 'SHELL-SKU',
      [qtyField]: '4,25001',
      lotNumber: '',
      unitCost: '',
    },
    createEmptyRow(pzConfig),
  ];
  const persistableRows = getPersistableRows(rows, pzConfig);

  assert.equal(persistableRows.length, 1);
  assert.equal(persistableRows[0].localId, 'ready-row');

  const emptyValidation = runValidationRules(pzConfig, {
    header: { warehouseId: '' },
    rows: [createEmptyRow(pzConfig)],
    persistableRows: [],
    mode: 'create',
    qtyField,
  });
  assert.equal(emptyValidation.blocking.length, 2);
  assert.equal(emptyValidation.byField.warehouseId, 'Warehouse is required');
  assert.equal(emptyValidation.byDocument.blocking[0].message, 'Add at least one product row before saving.');

  const filledValidation = runValidationRules(pzConfig, {
    header: { warehouseId: 'warehouse-shell' },
    rows,
    persistableRows,
    mode: 'create',
    qtyField,
  });
  assert.equal(filledValidation.blocking.length, 0);
  assert.equal(filledValidation.warnings.length, 1);
  assert.equal(filledValidation.byRow['ready-row'].warnings.unitCost, 'Unit cost missing');

  assert.deepEqual(computeSummary(pzConfig, {
    rows,
    persistableRows,
    qtyField,
    warningCount: filledValidation.warnings.length,
    blockingCount: filledValidation.blocking.length,
  }), {
    lines: 1,
    totalQty: 4.25,
    totalValue: 0,
    warningCount: 1,
    blockingCount: 0,
  });

  const result = await adapter.run('save', {
    header: {
      warehouseId: 'warehouse-shell',
      inboundLocationId: '',
      issueDate: '',
    },
    rows: persistableRows,
  });

  assert.deepEqual(capturedPayload, {
    warehouseId: 'warehouse-shell',
    inboundLocationId: null,
    issueDate: null,
    items: [{
      productId: 'prod-shell',
      variantId: null,
      lotNumber: null,
      [qtyField]: 4.25,
    }],
  });
  assert.equal(result.ok, true);
  assert.equal(result.documentId, 'receipt-shell-1');
  assert.equal(result.status, 'draft');

  const draft = mapReceiptToShellDraft({
    id: 'receipt-draft-shell',
    status: 'draft',
    warehouseId: 'warehouse-shell',
    inboundLocationId: null,
    items: [{
      id: 'line-1',
      productId: 'prod-shell',
      variantId: '',
      lotNumber: 'LOT-A',
      [qtyField]: 2,
      unitCost: 5,
      currency: 'PLN',
      product: { name: 'Shell product', sku: 'SHELL-SKU' },
    }],
  }, pzConfig);

  assert.equal(draft.rows.length, 2);
  assert.equal(draft.rows[0].id, 'line-1');
  assert.equal(draft.rows[1].isNew, true);
  assert.deepEqual(getRowSnapshot({ ...draft.rows[0], [qtyField]: '2,00001' }, pzConfig), {
    productId: 'prod-shell',
    variantId: null,
    lotNumber: 'LOT-A',
    [qtyField]: 2,
    unitCost: 5,
    currency: 'PLN',
  });
  assert.equal(areDraftItemSnapshotsEqual(draft.rows[0], { ...draft.rows[0], [qtyField]: '2' }, pzConfig), true);
  assert.equal(areDraftItemSnapshotsEqual(draft.rows[0], { ...draft.rows[0], [qtyField]: '3' }, pzConfig), false);

  await adapter.run('updateDraftHeader', {
    id: 'receipt-draft-shell',
    header: { warehouseId: 'warehouse-shell', inboundLocationId: '' },
  });
  await adapter.run('addItem', {
    id: 'receipt-draft-shell',
    row: { productId: 'prod-shell', variantId: '', lotNumber: '', [qtyField]: '1', unitCost: '', currency: '' },
  });
  await adapter.run('updateItem', {
    id: 'receipt-draft-shell',
    itemId: 'line-1',
    row: { productId: 'prod-shell', variantId: '', lotNumber: 'LOT-B', [qtyField]: '3', unitCost: '5', currency: 'PLN' },
  });
  await adapter.run('removeItem', { id: 'receipt-draft-shell', itemId: 'line-1' });

  assert.deepEqual(draftCalls.map(([kind]) => kind), ['header', 'add', 'update', 'remove']);
  assert.equal(draftCalls[1][1].payload[qtyField], 1);

  const pickerResult = {
    items: [{
      id: 'ui-product-id',
      productId: 'prod-scan',
      variantId: 'variant-scan',
      productName: 'Scanner product',
      variantLabel: 'Retail',
      variantSku: 'SCAN-001',
      barcode: '5901234123457',
      purchasePrice: { value: 12.5, currency: 'EUR' },
      isLotTracked: true,
      uiOnlyExpanded: true,
    }],
  };
  const [scanPickerRow] = normalizeProductPickerRows(pickerResult);
  assert.equal(isExactProductPickerScanMatch(scanPickerRow, 'SCAN-001'), true);
  assert.equal(isExactProductPickerScanMatch(scanPickerRow, '5901234123457'), true);
  assert.equal(isExactProductPickerScanMatch(scanPickerRow, 'missing-code'), false);
  assert.equal(getScanResultKey(scanPickerRow), 'prod-scan:variant-scan:SCAN-001');
  assert.equal(getScanResultTitle(scanPickerRow), 'SCAN-001 - Scanner product');
  assert.equal(getScanResultMeta(scanPickerRow), 'Retail');

  const scanPatch = mapProductPickerRowToPzRowPatch(scanPickerRow);
  assert.deepEqual(scanPatch, {
    productId: 'prod-scan',
    variantId: 'variant-scan',
    productName: 'Scanner product',
    sku: 'SCAN-001',
    variantLabel: 'Retail',
    unitCost: 12.5,
    currency: 'EUR',
    isLotTracked: true,
    isSerialized: false,
  });

  const scannerRows = getPersistableRows([
    { ...createEmptyRow(pzConfig), ...scanPatch, [qtyField]: '2' },
    createEmptyRow(pzConfig),
  ], pzConfig);
  assert.equal(scannerRows.length, 1);
  await adapter.run('addItem', {
    id: 'receipt-draft-shell',
    row: scannerRows[0],
  });
  assert.equal(draftCalls[draftCalls.length - 1][0], 'add');
  assert.deepEqual(draftCalls[draftCalls.length - 1][1].payload, {
    productId: 'prod-scan',
    variantId: 'variant-scan',
    lotNumber: null,
    [qtyField]: 2,
    unitCost: 12.5,
    currency: 'EUR',
  });

  const receiveResult = await adapter.run('receiveExisting', {
    id: 'receipt-draft-shell',
    header: { inboundLocationId: '' },
    rows: [
      { id: 'line-receive-1', productId: 'prod-shell', [qtyField]: 5, qtyReceived: 2 },
      { id: 'line-receive-done', productId: 'prod-shell', [qtyField]: 1, qtyReceived: 1 },
      { localId: 'unsaved-row', productId: 'prod-shell', [qtyField]: 3, qtyReceived: 0 },
    ],
  });

  assert.equal(receiveResult.ok, true);
  assert.equal(receiveResult.documentId, 'receipt-draft-shell');
  assert.equal(receiveResult.status, 'received');
  assert.equal(receiveCalls.length, 1);
  assert.deepEqual(receiveCalls[0], {
    id: 'receipt-draft-shell',
    itemId: 'line-receive-1',
    receiptId: 'receipt-draft-shell',
    payload: {
      qty: 3,
      toLocationId: null,
      lotId: null,
    },
  });

  const correctionResult = await adapter.run('correct', {
    id: 'receipt-posted-shell',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'line-receive-1', qty: 5 }],
    },
  });
  assert.equal(adapter.supports('correct'), true);
  assert.equal(correctionResult.ok, true);
  assert.equal(correctionResult.documentId, 'receipt-correction-shell-1');
  assert.deepEqual(capturedCorrectionPayload, {
    id: 'receipt-posted-shell',
    payload: {
      reason: 'Runtime correction',
      items: [{ originalItemId: 'line-receive-1', qty: 5 }],
    },
  });

  console.log('SHELL-1 WmsDocumentShell smoke passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
