function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function formatQty(value, locale = 'en') {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(num);
}

function formatDateTime(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function statusLabel(row, t) {
  const status = asText(row?.status);
  if (!status) return '—';
  return t(`wms.reservations.status.${status}`, status);
}

const RESERVATION_COLUMNS = [
  {
    key: 'status',
    width: 140,
    render: (row, { t }) => statusLabel(row, t),
    labelKey: 'wms.reservations.columns.status',
    fallbackLabel: 'Status',
  },
  {
    key: 'qty',
    width: 120,
    align: 'right',
    render: (row, { locale }) => formatQty(row?.qty, locale),
    labelKey: 'wms.reservations.columns.qty',
    fallbackLabel: 'Qty',
  },
  {
    key: 'warehouseId',
    width: 240,
    render: (row) => asDash(row?.warehouse?.code || row?.warehouseId),
    labelKey: 'wms.reservations.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'productId',
    width: 240,
    render: (row) => asDash(row?.product?.name || row?.productId),
    labelKey: 'wms.reservations.columns.product',
    fallbackLabel: 'Product',
  },
  {
    key: 'variantId',
    width: 200,
    render: (row) => asDash(row?.variant?.name || row?.variantId),
    labelKey: 'wms.reservations.columns.variant',
    fallbackLabel: 'Variant',
  },
  {
    key: 'orderId',
    width: 240,
    render: (row) => asDash(row?.orderId),
    labelKey: 'wms.reservations.columns.order',
    fallbackLabel: 'Source order',
  },
  {
    key: 'createdAt',
    width: 190,
    render: (row, { locale }) => formatDateTime(row?.createdAt, locale),
    labelKey: 'wms.reservations.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsReservationsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
  } = options;

  return RESERVATION_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key === 'createdAt' || column.key === 'status' || column.key === 'qty',
    width: Number(column.width || 180),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale }),
  }));
}
