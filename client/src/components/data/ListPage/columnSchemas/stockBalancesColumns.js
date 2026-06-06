import LinkCell from '../../../cells/LinkCell';

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function asNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatQty(value, locale = 'en') {
  const n = asNumber(value);
  if (n === null) return '—';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(n);
}

function warehouseLabel(row) {
  const code = asText(row?.warehouseCode);
  const name = asText(row?.warehouseName);
  if (code && name) return `${code} — ${name}`;
  return code || name || '—';
}

const STOCK_BALANCE_COLUMNS = [
  {
    key: 'warehouse',
    width: 240,
    align: 'left',
    render: (row, { t }) => warehouseLabel(row) || t('common.none', '—'),
    labelKey: 'wms.stockBalances.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'product',
    width: 260,
    align: 'left',
    render: (row, { onOpenProduct, t }) => (
      <LinkCell
        primary={asDash(row?.productName)}
        secondary={asDash(row?.productSku)}
        onClick={row?.productId ? () => onOpenProduct?.(row.productId) : undefined}
        ariaLabel={t('wms.stockBalances.openProduct', 'Open product')}
      />
    ),
    labelKey: 'wms.stockBalances.columns.product',
    fallbackLabel: 'Product',
  },
  {
    key: 'sku',
    width: 150,
    align: 'left',
    render: (row) => asDash(row?.productSku),
    labelKey: 'wms.stockBalances.columns.sku',
    fallbackLabel: 'SKU',
  },
  {
    key: 'variant',
    width: 180,
    align: 'left',
    render: (row) => asDash(row?.variantName),
    labelKey: 'wms.stockBalances.columns.variant',
    fallbackLabel: 'Variant',
  },
  {
    key: 'onHand',
    width: 140,
    align: 'right',
    render: (row, { locale }) => formatQty(row?.onHand, locale),
    labelKey: 'wms.stockBalances.columns.onHand',
    fallbackLabel: 'On hand',
  },
  {
    key: 'reserved',
    width: 140,
    align: 'right',
    render: (row, { locale }) => formatQty(row?.reserved, locale),
    labelKey: 'wms.stockBalances.columns.reserved',
    fallbackLabel: 'Reserved',
  },
  {
    key: 'available',
    width: 140,
    align: 'right',
    render: (row, { locale }) => formatQty(row?.available, locale),
    labelKey: 'wms.stockBalances.columns.available',
    fallbackLabel: 'Available',
  },
];

export function createStockBalancesColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    locale = 'en',
    onOpenProduct,
  } = options;

  return STOCK_BALANCE_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: false,
    width: Number(column.width || 160),
    canHide: true,
    align: column.align || 'left',
    resizable: true,
    render: (row) => column.render(row, { t, locale, onOpenProduct }),
  }));
}
