import LinkCell from '../../../cells/LinkCell';

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`, normalized);
}

function typeLabel(documentType, t) {
  const normalized = asText(documentType).toUpperCase();
  if (!normalized) return '—';
  return t(`wms.adjustments.types.${normalized}`, normalized);
}

function itemsCount(row) {
  if (Number.isFinite(asNumber(row?.itemsCount, NaN))) return asNumber(row.itemsCount, 0);
  if (Array.isArray(row?.items)) return row.items.length;
  return null;
}

const ADJUSTMENT_COLUMNS = [
  {
    key: 'number',
    width: 220,
    align: 'left',
    render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={asDash(row?.warehouseId)}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Open adjustment"
      />
    ),
    labelKey: 'wms.adjustments.columns.number',
    fallbackLabel: 'Number',
  },
  {
    key: 'documentType',
    width: 120,
    align: 'left',
    render: (row, { t }) => typeLabel(row?.documentType, t),
    labelKey: 'wms.adjustments.columns.documentType',
    fallbackLabel: 'Type',
  },
  {
    key: 'status',
    width: 130,
    align: 'left',
    render: (row, { t }) => statusLabel(row?.status, t),
    labelKey: 'wms.adjustments.columns.status',
    fallbackLabel: 'Status',
  },
  {
    key: 'warehouse',
    width: 220,
    align: 'left',
    render: (row) => asDash(row?.warehouseId),
    labelKey: 'wms.adjustments.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'date',
    width: 140,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.createdAt, locale),
    labelKey: 'wms.adjustments.columns.date',
    fallbackLabel: 'Date',
  },
  {
    key: 'itemsCount',
    width: 120,
    align: 'right',
    render: (row) => {
      const count = itemsCount(row);
      return count === null ? '—' : String(count);
    },
    labelKey: 'wms.adjustments.columns.itemsCount',
    fallbackLabel: 'Items',
  },
  {
    key: 'createdAt',
    width: 140,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.createdAt, locale),
    labelKey: 'wms.adjustments.columns.createdAt',
    fallbackLabel: 'Created',
  },
  {
    key: 'postedAt',
    width: 140,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.postedAt, locale),
    labelKey: 'wms.adjustments.columns.postedAt',
    fallbackLabel: 'Posted',
  },
];

export function createWmsAdjustmentsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
    onOpenDetail,
  } = options;

  return ADJUSTMENT_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: false,
    width: Number(column.width || 170),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale, onOpenDetail }),
  }));
}
