const wzConfig = {
  type: 'WZ',
  kindKey: 'shipment',
  i18nKey: 'wms.shipments',
  badge: 'WZ',
  color: 'shipment',
  routeBase: '/main/wms/shipments',

  header: {
    fields: [
      { key: 'warehouseId', labelKey: 'wms.print.warehouse', type: 'warehouseSelect', requiredFor: ['create', 'packing'], source: 'companyWarehouses' },
      { key: 'fromLocationId', labelKey: 'wms.locationOptional.fromLabel', type: 'locationSelect', requiredFor: [], source: 'warehouseLocations', optionalHintKey: 'wms.locationOptional.warehouseLevelStock' },
      { key: 'counterpartyId', labelKey: 'wms.shipments.new.counterparty', type: 'counterpartySelect', requiredFor: [] },
      { key: 'orderId', labelKey: 'wms.shipments.new.order', type: 'orderSelect', requiredFor: [] },
      { key: 'notes', labelKey: 'wms.shipments.new.notes', type: 'textarea', requiredFor: [], todo: 'Notes are visible in create UI but not persisted in the current shipment payload.' },
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
    serials: 'consume-placeholder',
    locations: 'source-optional',
    scanMode: 'newLine',
    autoRow: { enabled: false, mode: 'manualAddLine' },
    keyboardPreset: 'wms-default',
    detailSections: [
      { key: 'source', labelKey: 'wms.locationOptional.fromLabel', fields: ['fromLocationId'] },
      { key: 'stock', labelKey: 'wms.columns.available', fields: ['available'], todo: 'Stock availability is still service/UI specific.' },
      { key: 'lot', labelKey: 'wms.receipts.draftEdit.details.lot', fields: ['lotId'], visibleWhen: 'product.isLotTracked' },
      { key: 'serials', labelKey: 'wms.receipts.draftEdit.details.serials', fields: ['serialId'], visibleWhen: 'product.isSerialized', todo: 'Serial consume workflow waits for serial backend lifecycle.' },
    ],
  },

  validation: [
    { key: 'warehouseRequired', scope: 'header', field: 'warehouseId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.warehouseRequired' },
    { key: 'productRequired', scope: 'row', field: 'productId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.productRequired' },
    { key: 'qtyPositive', scope: 'row', field: 'qty', level: 'blocking', rule: 'numberGreaterThan', value: 0, messageKey: 'wms.validation.qtyPositive' },
    { key: 'availableNotExceeded', scope: 'row', field: 'qty', level: 'warning', rule: 'lteAvailableStock', todo: 'Current enforcement is backend/costing/inventory-service driven; SHELL-4A does not block create client-side.' },
  ],

  lifecycle: {
    statuses: ['packing', 'shipped', 'cancelled', 'corrected'],
    transitions: [
      { key: 'create', from: [], to: 'packing', action: 'create' },
      { key: 'ship', from: ['packing'], to: 'shipped', action: 'ship' },
      { key: 'correct', from: ['shipped'], to: 'corrected', action: 'correct' },
      { key: 'print', from: ['packing', 'shipped', 'cancelled', 'corrected'], action: 'print' },
    ],
    todo: 'Shipment ship/correct execution remains in WarehouseDocumentDetailPage.',
  },

  actions: {
    create: 'shipment.create',
    ship: 'shipment.shipItem',
    correct: 'shipment.correct',
    print: 'shipment.print',
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
    correct: 'wms:document:correct',
  },

  pickerContext: 'available',
};

export default wzConfig;
