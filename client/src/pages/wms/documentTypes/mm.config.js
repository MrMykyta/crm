const mmConfig = {
  type: 'MM',
  kindKey: 'transfer',
  i18nKey: 'wms.transfers',
  badge: 'MM',
  color: 'transfer',
  routeBase: '/main/wms/transfers',

  header: {
    fields: [
      { key: 'fromWarehouseId', labelKey: 'wms.fields.fromWarehouse', type: 'warehouseSelect', requiredFor: ['create', 'draft'] },
      { key: 'toWarehouseId', labelKey: 'wms.fields.toWarehouse', type: 'warehouseSelect', requiredFor: ['create', 'draft'] },
      { key: 'sourceLocationId', labelKey: 'wms.locationOptional.fromLabel', type: 'locationSelect', requiredFor: [], optionalHintKey: 'wms.locationOptional.warehouseLevelStock' },
      { key: 'targetLocationId', labelKey: 'wms.locationOptional.toLabel', type: 'locationSelect', requiredFor: [], optionalHintKey: 'wms.locationOptional.warehouseLevelStock' },
      { key: 'issueDate', labelKey: 'wms.fields.date', type: 'date', requiredFor: [] },
    ],
  },

  columns: [
    {
      key: 'product',
      labelKey: 'wms.columns.product',
      label: 'Product',
      type: 'product',
      required: true,
      editable: true,
      inputField: 'productName',
      clearFields: ['productId', 'variantId', 'sku'],
      displayNameFields: ['productName', 'pickerProductName'],
      displayCodeFields: ['sku'],
      errorField: 'productId',
      resultIdField: 'productId',
      resultVariantField: 'variantId',
      resultTitleField: 'productName',
      resultCodeField: 'sku',
      resultCodeLabel: 'SKU',
    },
    { key: 'sku', labelKey: 'wms.columns.sku', label: 'SKU', type: 'readonly', editable: false },
    { key: 'qty', labelKey: 'wms.columns.qty', label: 'Qty', type: 'quantity', required: true, editable: true },
    { key: 'status', labelKey: 'wms.columns.status', label: 'State', type: 'status', editable: false },
  ],

  qtyField: 'qty',
  qtySign: 'positive',

  rowController: {
    stockAware: true,
    cost: false,
    lots: 'select',
    serials: 'move-placeholder',
    locations: 'source-target-optional',
    scanMode: 'newLine',
    autoRow: { enabled: false, mode: 'manualAddLine' },
    keyboardPreset: 'wms-default',
    detailSections: [
      { key: 'source', labelKey: 'wms.locationOptional.fromLabel', fields: ['sourceLocationId'] },
      { key: 'target', labelKey: 'wms.locationOptional.toLabel', fields: ['targetLocationId'] },
      { key: 'stock', labelKey: 'wms.columns.available', fields: ['available'], todo: 'Available stock remains derived outside config.' },
      { key: 'lot', labelKey: 'wms.receipts.draftEdit.details.lot', fields: ['lotId'], visibleWhen: 'product.isLotTracked' },
      { key: 'serials', labelKey: 'wms.receipts.draftEdit.details.serials', fields: ['serialId'], visibleWhen: 'product.isSerialized', todo: 'Serial move workflow waits for serial backend lifecycle.' },
    ],
  },

  validation: [
    { key: 'fromWarehouseRequired', scope: 'header', field: 'fromWarehouseId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.fromWarehouseRequired' },
    { key: 'toWarehouseRequired', scope: 'header', field: 'toWarehouseId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.toWarehouseRequired' },
    { key: 'productRequired', scope: 'row', field: 'productId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.productRequired' },
    { key: 'qtyPositive', scope: 'row', field: 'qty', level: 'blocking', rule: 'numberGreaterThan', value: 0, messageKey: 'wms.validation.qtyPositive' },
    { key: 'availableNotExceeded', scope: 'row', field: 'qty', level: 'warning', rule: 'lteAvailableStock', todo: 'Current enforcement is inventoryService/applyMove driven; SHELL-5A does not block create client-side.' },
  ],

  lifecycle: {
    statuses: ['draft', 'in_transit', 'received'],
    transitions: [
      { key: 'create', from: [], to: 'draft', action: 'create' },
      { key: 'execute', from: ['draft', 'in_transit'], to: 'received', action: 'execute' },
      { key: 'print', from: ['draft', 'in_transit', 'received'], action: 'print' },
    ],
    todo: 'Partial execution can leave status in_transit; line execution remains in WarehouseDocumentDetailPage.',
  },

  actions: {
    create: 'transfer.create',
    execute: 'transfer.executeLine',
    print: 'transfer.print',
    todo: 'Adapters intentionally not wired in SHELL-0.3.',
  },

  summary: [
    { key: 'lines', labelKey: 'wms.summary.items', source: 'items.length' },
    { key: 'totalQty', labelKey: 'wms.summary.qtyTotal', source: 'sum(qty)' },
    { key: 'warningCount', labelKey: 'wms.summary.warningCount', source: 'rowWarnings.length' },
    { key: 'blockingCount', labelKey: 'wms.summary.blockingCount', source: 'rowErrors.length' },
  ],

  permissions: {
    view: 'wms:read',
    create: 'wms:document:create',
    update: 'wms:document:update',
    post: 'wms:document:post',
    correct: null,
  },

  pickerContext: 'available',
};

export default mmConfig;
