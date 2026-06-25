import LinkCell from '../../cells/LinkCell';
import StatusBadge from '../../shared/StatusBadge';
import { asText, formatDate, formatQty } from '../../../lib/format';

const DATE_OPTIONS = {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
};

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function typeLabel(type, t) {
  const normalized = asText(type).toUpperCase();
  if (!normalized) return '—';
  return t(`wms.documents.types.${normalized}`, normalized);
}

function statusLabel(status, t) {
  const normalized = asText(status).toLowerCase();
  if (!normalized) return '—';
  return t(`statuses.${normalized}`, normalized);
}

function warehouseLabel(row) {
  if (asText(row?.type).toUpperCase() === 'MM') {
    const source = row?.sourceWarehouseCode || row?.sourceWarehouseId || '—';
    const target = row?.targetWarehouseCode || row?.targetWarehouseId || '—';
    return `${source} → ${target}`;
  }
  return asDash(row?.warehouseCode || row?.warehouseId);
}

function quantityLabel(value, locale) {
  if (value === null || value === undefined || value === '') return '—';
  return formatQty(value, locale);
}

const WMS_DOCUMENT_COLUMNS = [
  {
    key: 'type',
    labelKey: 'wms.documents.columns.type',
    width: 120,
    align: 'left',
    render: (row, { t }) => typeLabel(row?.type, t),
  },
  {
    key: 'number',
    labelKey: 'wms.documents.columns.number',
    width: 230,
    align: 'left',
    render: (row, { onOpenDetail, t }) => (
      <LinkCell
        primary={asDash(row?.number)}
        secondary={warehouseLabel(row)}
        onClick={row?.id ? () => onOpenDetail?.(row) : undefined}
        ariaLabel={t('wms.documents.open')}
      />
    ),
  },
  {
    key: 'date',
    labelKey: 'wms.documents.columns.date',
    width: 150,
    align: 'left',
    render: (row, { locale }) => formatDate(row?.date || row?.createdAt, locale, DATE_OPTIONS),
  },
  {
    key: 'status',
    labelKey: 'wms.documents.columns.status',
    width: 150,
    align: 'left',
    render: (row, { t }) => (
      <StatusBadge status={row?.status} size="sm">
        {statusLabel(row?.status, t)}
      </StatusBadge>
    ),
  },
  {
    key: 'warehouse',
    labelKey: 'wms.documents.columns.warehouse',
    width: 220,
    align: 'left',
    render: (row) => warehouseLabel(row),
  },
  {
    key: 'itemsCount',
    labelKey: 'wms.documents.columns.itemsCount',
    width: 120,
    align: 'right',
    render: (row) => String(row?.itemsCount ?? 0),
  },
  {
    key: 'totalQty',
    labelKey: 'wms.documents.columns.totalQty',
    width: 130,
    align: 'right',
    render: (row, { locale }) => quantityLabel(row?.totalQty, locale),
  },
];

export function createWmsDocumentsColumns(options = {}) {
  const { onOpenDetail, t = (key, fallback) => fallback || key, locale = 'en' } = options;
  return WMS_DOCUMENT_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey),
    managerLabel: t(column.labelKey),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: false,
    width: Number(column.width || 160),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale, onOpenDetail }),
  }));
}
