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

function warehouseLabel(row) {
  const code = asText(row?.warehouse?.code || row?.warehouseCode);
  const name = asText(row?.warehouse?.name || row?.warehouseName);
  if (code && name) return `${code} - ${name}`;
  return code || name || asDash(row?.warehouseId);
}

function locationLabel(location, fallbackId) {
  return asText(location?.code || location?.name) || asDash(fallbackId);
}

function productLabel(row) {
  const name = asText(row?.product?.name || row?.productName);
  const sku = asText(row?.product?.sku || row?.productSku);
  if (name && sku) return `${name} (${sku})`;
  return name || sku || asDash(row?.productId);
}

function sourceLabel(row) {
  const type = asText(row?.refType);
  const id = asText(row?.refId);
  if (type && id) return `${type}: ${id}`;
  return type || id || '—';
}

const STOCK_MOVE_COLUMNS = [
  {
    key: 'createdAt',
    width: 190,
    render: (row, { locale }) => formatDateTime(row?.createdAt, locale),
    labelKey: 'wms.stockMoves.columns.createdAt',
    fallbackLabel: 'Date',
  },
  {
    key: 'type',
    width: 150,
    render: (row) => asDash(row?.type),
    labelKey: 'wms.stockMoves.columns.type',
    fallbackLabel: 'Type',
  },
  {
    key: 'warehouse',
    width: 230,
    render: (row) => warehouseLabel(row),
    labelKey: 'wms.stockMoves.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'fromLocation',
    width: 180,
    render: (row) => locationLabel(row?.fromLocation, row?.fromLocationId),
    labelKey: 'wms.stockMoves.columns.fromLocation',
    fallbackLabel: 'From location',
  },
  {
    key: 'toLocation',
    width: 180,
    render: (row) => locationLabel(row?.toLocation, row?.toLocationId),
    labelKey: 'wms.stockMoves.columns.toLocation',
    fallbackLabel: 'To location',
  },
  {
    key: 'product',
    width: 260,
    render: (row) => productLabel(row),
    labelKey: 'wms.stockMoves.columns.product',
    fallbackLabel: 'Product',
  },
  {
    key: 'variantId',
    width: 160,
    render: (row) => asDash(row?.variant?.name || row?.variantName || row?.variantId),
    labelKey: 'wms.stockMoves.columns.variant',
    fallbackLabel: 'Variant',
  },
  {
    key: 'qty',
    width: 140,
    align: 'right',
    render: (row, { locale }) => formatQty(row?.qty, locale),
    labelKey: 'wms.stockMoves.columns.qty',
    fallbackLabel: 'Qty',
  },
  {
    key: 'source',
    width: 260,
    render: (row) => sourceLabel(row),
    labelKey: 'wms.stockMoves.columns.source',
    fallbackLabel: 'Source',
  },
];

export function createWmsStockMovesColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
  } = options;

  return STOCK_MOVE_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key === 'createdAt' || column.key === 'type' || column.key === 'qty',
    width: Number(column.width || 170),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale }),
  }));
}
