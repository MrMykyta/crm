import LinkCell from '../../cells/LinkCell';
import StatusBadge from '../../shared/StatusBadge';
import { asText, formatDate, formatMoney } from '../../../lib/format';

const DATE_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function counterpartyName(row) {
  return (
    row?.counterparty?.name
    || row?.counterparty?.shortName
    || row?.counterparty?.fullName
    || row?.order?.counterparty?.name
    || row?.order?.counterparty?.shortName
    || row?.order?.counterparty?.fullName
    || '—'
  );
}

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`);
}

const INVOICE_COLUMNS = [
  {
    key: 'number',
    labelKey: 'oms.invoices.columns.number',
    width: 200,
    align: 'left',
    render: (row, { onOpenDetail, t }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={counterpartyName(row)}
        onClick={row?.id ? () => onOpenDetail?.(row.id) : undefined}
        ariaLabel={t('oms.invoices.open')}
      />
    ),
  },
  {
    key: 'counterparty',
    labelKey: 'oms.invoices.columns.counterparty',
    width: 220,
    align: 'left',
    render: (row) => counterpartyName(row),
  },
  {
    key: 'status',
    labelKey: 'oms.invoices.columns.status',
    width: 130,
    align: 'left',
    render: (row, { t }) => (
      <StatusBadge status={row?.status} size="sm">
        {statusLabel(row?.status, t)}
      </StatusBadge>
    ),
  },
  {
    key: 'issueDate',
    labelKey: 'oms.invoices.columns.issueDate',
    width: 140,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.issueDate, locale, DATE_OPTIONS),
  },
  {
    key: 'dueDate',
    labelKey: 'oms.invoices.columns.dueDate',
    width: 140,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.dueDate, locale, DATE_OPTIONS),
  },
  {
    key: 'totalNet',
    labelKey: 'oms.invoices.columns.totalNet',
    width: 150,
    align: 'right',
    render: (row, { locale }) => formatMoney(row?.totalNet, row?.currencyCode || 'PLN', locale),
  },
  {
    key: 'totalGross',
    labelKey: 'oms.invoices.columns.totalGross',
    width: 150,
    align: 'right',
    render: (row, { locale }) => formatMoney(row?.totalGross, row?.currencyCode || 'PLN', locale),
  },
];

export function createInvoicesColumns(options = {}) {
  const { onOpenDetail, t = (key) => key, locale = 'en' } = options;
  return INVOICE_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey),
    managerLabel: t(column.labelKey),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: ['number', 'status', 'issueDate', 'dueDate', 'totalNet', 'totalGross'].includes(column.key),
    width: Number(column.width || 160),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale, onOpenDetail }),
  }));
}
