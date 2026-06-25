function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function formatNumber(value, locale = 'en') {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return String(value);
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
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

const PARCEL_COLUMNS = [
  {
    key: 'trackingNumber',
    width: 220,
    render: (row) => asDash(row?.trackingNumber),
    labelKey: 'wms.parcels.columns.trackingNumber',
    fallbackLabel: 'Tracking number',
  },
  {
    key: 'carrier',
    width: 180,
    render: (row) => asDash(row?.carrier),
    labelKey: 'wms.parcels.columns.carrier',
    fallbackLabel: 'Carrier',
  },
  {
    key: 'shipmentId',
    width: 260,
    render: (row) => asDash(row?.shipment?.number || row?.shipmentId),
    labelKey: 'wms.parcels.columns.shipment',
    fallbackLabel: 'Shipment',
  },
  {
    key: 'weight',
    width: 130,
    align: 'right',
    render: (row, { locale }) => formatNumber(row?.weight, locale),
    labelKey: 'wms.parcels.columns.weight',
    fallbackLabel: 'Weight',
  },
  {
    key: 'createdAt',
    width: 190,
    render: (row, { locale }) => formatDateTime(row?.createdAt, locale),
    labelKey: 'wms.parcels.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsParcelsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
  } = options;

  return PARCEL_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key === 'createdAt' || column.key === 'trackingNumber' || column.key === 'carrier',
    width: Number(column.width || 180),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale }),
  }));
}
