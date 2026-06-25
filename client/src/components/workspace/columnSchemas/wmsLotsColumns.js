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

const LOT_COLUMNS = [
  {
    key: 'lotNumber',
    width: 220,
    render: (row) => asDash(row?.lotNumber),
    labelKey: 'wms.lots.columns.lotNumber',
    fallbackLabel: 'Lot number',
  },
  {
    key: 'productId',
    width: 260,
    render: (row) => asDash(row?.product?.name || row?.productId),
    labelKey: 'wms.lots.columns.product',
    fallbackLabel: 'Product',
  },
  {
    key: 'mfgDate',
    width: 160,
    render: (row, { locale }) => formatDate(row?.mfgDate, locale),
    labelKey: 'wms.lots.columns.mfgDate',
    fallbackLabel: 'Manufactured',
  },
  {
    key: 'expDate',
    width: 160,
    render: (row, { locale }) => formatDate(row?.expDate, locale),
    labelKey: 'wms.lots.columns.expDate',
    fallbackLabel: 'Expiry date',
  },
  {
    key: 'createdAt',
    width: 190,
    render: (row, { locale }) => formatDate(row?.createdAt, locale),
    labelKey: 'wms.lots.columns.createdAt',
    fallbackLabel: 'Created',
  },
];

export function createWmsLotsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
  } = options;

  return LOT_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key === 'createdAt' || column.key === 'lotNumber' || column.key === 'expDate',
    width: Number(column.width || 180),
    canHide: true,
    align: 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale }),
  }));
}
