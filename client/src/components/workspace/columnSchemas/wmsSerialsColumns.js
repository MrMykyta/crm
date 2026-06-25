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

const SERIAL_COLUMNS = [
  {
    key: 'serialNumber',
    width: 260,
    render: (row) => asDash(row?.serialNumber),
    labelKey: 'wms.serials.columns.serialNumber',
    fallbackLabel: 'Serial number',
  },
  {
    key: 'productId',
    width: 280,
    render: (row) => asDash(row?.product?.name || row?.productId),
    labelKey: 'wms.serials.columns.product',
    fallbackLabel: 'Product',
  },
  {
    key: 'createdAt',
    width: 190,
    render: (row, { locale }) => formatDateTime(row?.createdAt, locale),
    labelKey: 'wms.serials.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsSerialsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
  } = options;

  return SERIAL_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key === 'createdAt' || column.key === 'serialNumber',
    width: Number(column.width || 200),
    canHide: true,
    align: 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale }),
  }));
}
