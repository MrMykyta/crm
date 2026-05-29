import LinkCell from '../../../cells/LinkCell';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function asNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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

function formatMoney(value, currency = 'PLN', locale = 'en') {
  const n = asNumber(value);
  if (n === null) return '—';
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)} ${asText(currency) || 'PLN'}`;
}

function counterpartyName(row) {
  return (
    row?.counterparty?.name
    || row?.counterparty?.shortName
    || row?.counterparty?.fullName
    || row?.customer?.name
    || '—'
  );
}

function statusLabel(row, t) {
  const status = asText(row?.status).toLowerCase();
  if (!status) return '—';
  return t(`statuses.${status}`, status);
}

const ORDER_COLUMNS = [
  {
    key: 'number',
    label: 'Number',
    group: 'main',
    defaultVisible: true,
    sortable: true,
    align: 'left',
    width: 200,
    render: (row, { onOpenDetail }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={counterpartyName(row)}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel="Open order"
      />
    ),
  },
  {
    key: 'status',
    label: 'Status',
    group: 'main',
    defaultVisible: true,
    sortable: true,
    align: 'left',
    width: 130,
    render: (row, { t }) => statusLabel(row, t),
  },
  {
    key: 'counterparty',
    label: 'Counterparty',
    group: 'main',
    defaultVisible: true,
    sortable: false,
    align: 'left',
    width: 220,
    render: (row) => counterpartyName(row),
  },
  {
    key: 'totalGross',
    label: 'Total gross',
    group: 'main',
    defaultVisible: true,
    sortable: true,
    align: 'right',
    width: 150,
    render: (row, { locale }) => formatMoney(row?.totalGross, row?.currencyCode || row?.currency || 'PLN', locale),
  },
  {
    key: 'placedAt',
    label: 'Placed at',
    group: 'main',
    defaultVisible: true,
    sortable: true,
    align: 'left',
    width: 140,
    render: (row, { locale }) => formatDate(row?.placedAt || row?.createdAt, locale),
  },
];

export function createOrdersColumns(options = {}) {
  const { onOpenDetail, t = (k, fallback) => fallback || k, locale = 'en' } = options;
  return ORDER_COLUMNS.map((column) => ({
    key: column.key,
    title: column.label,
    managerLabel: column.label,
    managerGroup: column.group,
    defaultVisible: column.defaultVisible !== false,
    sortable: column.sortable === true,
    width: Number(column.width || 170),
    canHide: column.canHide !== false,
    align: column.align || 'left',
    resizable: column.resizable !== false,
    render: (row) => column.render(row, { onOpenDetail, t, locale }),
  }));
}
