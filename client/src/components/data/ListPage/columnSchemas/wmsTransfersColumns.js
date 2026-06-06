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

const TRANSFER_COLUMNS = [
  {
    key: 'number',
    width: 210,
    align: 'left',
    render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={`${asDash(row?.fromWarehouseId)} → ${asDash(row?.toWarehouseId)}`}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Open transfer"
      />
    ),
    labelKey: 'wms.transfers.columns.number',
    fallbackLabel: 'Number',
  },
  {
    key: 'status',
    width: 130,
    align: 'left',
    render: (row, { t }) => statusLabel(row?.status, t),
    labelKey: 'wms.transfers.columns.status',
    fallbackLabel: 'Status',
  },
  {
    key: 'fromWarehouse',
    width: 200,
    align: 'left',
    render: (row) => asDash(row?.fromWarehouseId),
    labelKey: 'wms.transfers.columns.fromWarehouse',
    fallbackLabel: 'From',
  },
  {
    key: 'toWarehouse',
    width: 200,
    align: 'left',
    render: (row) => asDash(row?.toWarehouseId),
    labelKey: 'wms.transfers.columns.toWarehouse',
    fallbackLabel: 'To',
  },
  {
    key: 'createdAt',
    width: 150,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.createdAt, locale),
    labelKey: 'wms.transfers.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsTransfersColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
    onOpenDetail,
  } = options;

  return TRANSFER_COLUMNS.map((column) => ({
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
