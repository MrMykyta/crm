function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function formatDateTime(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`, normalized);
}

function warehouseByTask(row, waveById = {}) {
  const wave = waveById?.[row?.waveId];
  return asDash(wave?.warehouseId || row?.warehouseId || row?.warehouse || row?.waveId);
}

function shipmentReference(row) {
  return asDash(row?.orderId || row?.reference || row?.shipmentId || row?.pickToLocationId);
}

const PICK_TASK_COLUMNS = [
  {
    key: 'id',
    width: 290,
    render: (row) => asDash(row?.id),
    labelKey: 'wms.pickTasks.columns.id',
    fallbackLabel: 'ID',
  },
  {
    key: 'status',
    width: 130,
    render: (row, { t }) => statusLabel(row?.status, t),
    labelKey: 'wms.pickTasks.columns.status',
    fallbackLabel: 'Status',
  },
  {
    key: 'warehouse',
    width: 220,
    render: (row, { waveById }) => warehouseByTask(row, waveById),
    labelKey: 'wms.pickTasks.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'createdAt',
    width: 170,
    render: (row, { locale }) => formatDateTime(row?.createdAt, locale),
    labelKey: 'wms.pickTasks.columns.createdAt',
    fallbackLabel: 'Created',
  },
  {
    key: 'assignedUser',
    width: 170,
    render: (row) => asDash(row?.assignedUser || row?.assignedUserId || row?.userId),
    labelKey: 'wms.pickTasks.columns.assignedUser',
    fallbackLabel: 'Assigned user',
  },
  {
    key: 'shipmentReference',
    width: 220,
    render: (row) => shipmentReference(row),
    labelKey: 'wms.pickTasks.columns.shipmentReference',
    fallbackLabel: 'Shipment / order',
  },
];

export function createWmsPickTasksColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
    waveById,
  } = options;

  return PICK_TASK_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key === 'createdAt' || column.key === 'status',
    width: Number(column.width || 180),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale, waveById }),
  }));
}
