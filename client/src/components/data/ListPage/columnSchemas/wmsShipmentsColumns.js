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

const SHIPMENT_COLUMNS = [
  {
    key: 'number',
    width: 220,
    align: 'left',
    render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={asDash(row?.warehouseId)}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Open shipment"
      />
    ),
    labelKey: 'wms.shipments.columns.number',
    fallbackLabel: 'Number',
  },
  {
    key: 'status',
    width: 140,
    align: 'left',
    render: (row, { t }) => statusLabel(row?.status, t),
    labelKey: 'wms.shipments.columns.status',
    fallbackLabel: 'Status',
  },
  {
    key: 'warehouse',
    width: 220,
    align: 'left',
    render: (row) => asDash(row?.warehouseId),
    labelKey: 'wms.shipments.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'order',
    width: 210,
    align: 'left',
    render: (row) => asDash(row?.orderId),
    labelKey: 'wms.shipments.columns.order',
    fallbackLabel: 'Order',
  },
  {
    key: 'createdAt',
    width: 150,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.createdAt, locale),
    labelKey: 'wms.shipments.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsShipmentsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
    onOpenDetail,
  } = options;

  return SHIPMENT_COLUMNS.map((column) => ({
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
