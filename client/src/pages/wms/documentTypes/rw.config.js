const rwConfig = {
  type: 'RW',
  kindKey: 'adjustment',
  i18nKey: 'wms.adjustments',
  badge: 'RW',
  color: 'adjustment-negative',
  routeBase: '/main/wms/adjustments',

  header: {
    fields: [
      { key: 'documentType', labelKey: 'wms.fields.documentType', type: 'documentTypeSelect', requiredFor: ['create'], fixedValue: 'RW' },
      { key: 'warehouseId', labelKey: 'wms.print.warehouse', type: 'warehouseSelect', requiredFor: ['create', 'draft'] },
      { key: 'locationId', labelKey: 'wms.locationOptional.label', type: 'locationSelect', requiredFor: [], optionalHintKey: 'wms.locationOptional.warehouseLevelStock' },
      { key: 'reason', labelKey: 'wms.fields.reason', type: 'text', requiredFor: ['create'] },
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
    { key: 'qtyDelta', labelKey: 'wms.create.qtyDelta', label: 'Qty delta', type: 'quantity', required: true, editable: true },
    { key: 'status', labelKey: 'wms.columns.status', label: 'State', type: 'status', editable: false },
  ],

  qtyField: 'qtyDelta',
  qtySign: 'negative',

  rowController: {
    stockAware: true,
    cost: false,
    lots: 'select',
    serials: 'consume-placeholder',
    locations: 'single-optional',
    scanMode: 'newLine',
    autoRow: { enabled: false, mode: 'manualAddLine' },
    keyboardPreset: 'wms-default',
    detailSections: [
      { key: 'location', labelKey: 'wms.locationOptional.label', fields: ['locationId'] },
      { key: 'stock', labelKey: 'wms.columns.available', fields: ['available'], todo: 'Negative adjustment stock guard is enforced by backend applyMove.' },
      { key: 'reason', labelKey: 'wms.fields.reason', fields: ['reason'] },
      { key: 'lot', labelKey: 'wms.receipts.draftEdit.details.lot', fields: ['lotId'], visibleWhen: 'product.isLotTracked' },
      { key: 'serials', labelKey: 'wms.receipts.draftEdit.details.serials', fields: ['serialId'], visibleWhen: 'product.isSerialized', todo: 'Serial consume workflow waits for serial backend lifecycle.' },
    ],
  },

  validation: [
    { key: 'warehouseRequired', scope: 'header', field: 'warehouseId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.warehouseRequired' },
    { key: 'documentTypeRequired', scope: 'header', field: 'documentType', level: 'blocking', rule: 'required', messageKey: 'wms.validation.typeRequired' },
    { key: 'reasonRequired', scope: 'header', field: 'reason', level: 'blocking', rule: 'required', messageKey: 'wms.validation.reasonRequired' },
    { key: 'productRequired', scope: 'row', field: 'productId', level: 'blocking', rule: 'required', messageKey: 'wms.validation.productRequired' },
    { key: 'qtyDeltaPositiveInput', scope: 'row', field: 'qtyDelta', level: 'blocking', rule: 'numberGreaterThan', value: 0, messageKey: 'wms.validation.qtyDeltaPositive' },
  ],

  lifecycle: {
    statuses: ['draft', 'posted'],
    transitions: [
      { key: 'save', from: [], to: 'draft', action: 'save' },
      { key: 'post', from: ['draft'], to: 'posted', action: 'post' },
      { key: 'print', from: ['draft', 'posted'], action: 'print' },
    ],
  },

  actions: {
    save: 'adjustment.create',
    post: 'adjustment.post',
    print: 'adjustment.print',
    todo: 'Adapters intentionally not wired in SHELL-0.3.',
  },

  summary: [
    { key: 'lines', labelKey: 'wms.summary.items', source: 'items.length' },
    { key: 'netDelta', labelKey: 'wms.summary.qtyTotal', source: '-sum(abs(qtyDelta))' },
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

export default rwConfig;
