import LinkCell from '../../../cells/LinkCell';

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
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

const CYCLE_COUNT_COLUMNS = [
  {
    key: 'id',
    width: 230,
    align: 'left',
    render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asText(row?.id).slice(0, 8) || '—'}
        secondary={asDash(row?.warehouseId)}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Open cycle count"
      />
    ),
    labelKey: 'wms.cycleCounts.columns.sheet',
    fallbackLabel: 'Sheet',
  },
  {
    key: 'status',
    width: 140,
    align: 'left',
    render: (row, { t }) => statusLabel(row?.status, t),
    labelKey: 'wms.cycleCounts.columns.status',
    fallbackLabel: 'Status',
  },
  {
    key: 'warehouse',
    width: 220,
    align: 'left',
    render: (row) => asDash(row?.warehouseId),
    labelKey: 'wms.cycleCounts.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'itemsCount',
    width: 140,
    align: 'right',
    render: (row) => String(Array.isArray(row?.items) ? row.items.length : 0),
    labelKey: 'wms.cycleCounts.columns.itemsCount',
    fallbackLabel: 'Counted lines',
  },
  {
    key: 'createdAt',
    width: 150,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.createdAt, locale),
    labelKey: 'wms.cycleCounts.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsCycleCountsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
    onOpenDetail,
  } = options;

  return CYCLE_COUNT_COLUMNS.map((column) => ({
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

