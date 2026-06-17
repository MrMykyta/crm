const ccConfig = {
  type: 'CC',
  kindKey: 'cycleCount',
  i18nKey: 'wms.cycleCounts',
  badge: 'CC',
  color: 'cycle-count',
  routeBase: '/main/wms/cycle-counts',

  header: {
    shellFields: ['warehouseId', 'locationId'],
    fields: [
      { key: 'warehouseId', labelKey: 'wms.cycleCounts.fields.warehouse', type: 'warehouseSelect', requiredFor: ['create', 'planned', 'counting'] },
      { key: 'locationId', labelKey: 'wms.locationOptional.label', type: 'locationSelect', requiredFor: [], optionalHintKey: 'wms.locationOptional.warehouseLevelStock' },
      { key: 'status', labelKey: 'wms.columns.status', type: 'status', requiredFor: [] },
      { key: 'createdAt', labelKey: 'wms.fields.date', type: 'date', requiredFor: [] },
    ],
  },

  columns: [
    { key: 'product', labelKey: 'wms.cycleCounts.columns.product', type: 'product', required: true, editable: true },
    { key: 'sku', labelKey: 'wms.columns.sku', type: 'readonly', editable: false },
    { key: 'systemQty', labelKey: 'wms.cycleCounts.columns.system', type: 'quantity', editable: false },
    { key: 'qtyCounted', labelKey: 'wms.cycleCounts.columns.counted', type: 'quantity', required: true, editable: true },
    { key: 'difference', labelKey: 'wms.cycleCounts.columns.diff', type: 'variance', editable: false },
    { key: 'status', labelKey: 'wms.columns.status', type: 'status', editable: false },
  ],

  qtyField: 'qtyCounted',
  qtySign: 'free',

  rowController: {
    enabled: false,
    stockAware: true,
    cost: false,
    lots: 'verify',
    serials: 'verify-placeholder',
    locations: 'single-optional',
    scanMode: 'newLine',
    autoRow: { enabled: false, mode: 'manualAddLine' },
    keyboardPreset: 'wms-default',
    detailSections: [
      { key: 'location', labelKey: 'wms.locationOptional.label', fields: ['locationId'] },
      { key: 'variance', labelKey: 'wms.cycleCounts.columns.diff', fields: ['systemQty', 'qtyCounted', 'difference'] },
      { key: 'lot', labelKey: 'wms.cycleCounts.columns.lot', fields: ['lotId'] },
      { key: 'serials', labelKey: 'wms.cycleCounts.columns.serial', fields: ['serialId'], todo: 'Serial verification waits for serial backend lifecycle.' },
    ],
  },

  validation: [
    { key: 'warehouseRequired', scope: 'header', field: 'warehouseId', level: 'blocking', rule: 'required', messageKey: 'wms.cycleCounts.validation.warehouseRequired' },
    { key: 'productRequired', scope: 'row', field: 'productId', level: 'blocking', rule: 'required', messageKey: 'wms.cycleCounts.validation.productRequired' },
    { key: 'qtyCountedNonNegative', scope: 'row', field: 'qtyCounted', level: 'blocking', rule: 'numberGreaterOrEqual', value: 0, messageKey: 'wms.cycleCounts.validation.qtyNonNegative' },
    { key: 'varianceWarning', scope: 'row', field: 'difference', level: 'warning', rule: 'nonZeroVariance', todo: 'Current UI displays variance but does not block reconcile.' },
  ],

  lifecycle: {
    statuses: ['planned', 'counting', 'reconciled'],
    transitions: [
      { key: 'create', from: [], to: 'planned', action: 'create' },
      { key: 'addItems', from: ['planned', 'counting'], to: 'counting', action: 'addItems' },
      { key: 'reconcile', from: ['planned', 'counting'], to: 'reconciled', action: 'reconcile' },
      { key: 'print', from: ['planned', 'counting', 'reconciled'], action: 'print' },
    ],
    todo: 'Cycle Count execution remains in CycleCountDetailPage; no generic lifecycle engine exists yet.',
  },

  actions: {
    create: 'cycleCount.create',
    addItems: 'cycleCount.addItems',
    reconcile: 'cycleCount.reconcile',
    print: 'cycleCount.print',
    todo: 'Adapters intentionally not wired in SHELL-0.3.',
  },

  summary: [
    { key: 'lines', labelKey: 'wms.summary.items', source: 'items.length' },
    { key: 'variance', labelKey: 'wms.cycleCounts.columns.diff', source: 'sum(qtyCounted - systemQty)' },
    { key: 'pwTotal', labelKey: 'wms.cycleCounts.summary.pw', source: 'sum(positiveVariance)' },
    { key: 'rwTotal', labelKey: 'wms.cycleCounts.summary.rw', source: 'sum(abs(negativeVariance))' },
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

  pickerContext: 'system',
};

export default ccConfig;
