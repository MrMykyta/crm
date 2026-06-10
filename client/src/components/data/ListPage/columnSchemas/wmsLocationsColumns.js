function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function warehouseLabel(row, warehouseById) {
  const warehouse = row?.warehouse || warehouseById?.get?.(row?.warehouseId);
  const code = asText(warehouse?.code);
  const name = asText(warehouse?.name);
  if (code && name) return `${code} - ${name}`;
  return code || name || asDash(row?.warehouseId);
}

function activeLabel(value, t) {
  if (value === undefined || value === null) return '—';
  return value === false
    ? t('wms.common.inactive', 'Inactive')
    : t('wms.common.active', 'Active');
}

const LOCATION_COLUMNS = [
  {
    key: 'warehouseId',
    width: 260,
    render: (row, { warehouseById }) => warehouseLabel(row, warehouseById),
    labelKey: 'wms.locations.columns.warehouse',
    fallbackLabel: 'Warehouse',
  },
  {
    key: 'code',
    width: 160,
    render: (row) => asDash(row?.code),
    labelKey: 'wms.locations.columns.code',
    fallbackLabel: 'Code',
  },
  {
    key: 'type',
    width: 150,
    render: (row) => asDash(row?.type),
    labelKey: 'wms.locations.columns.type',
    fallbackLabel: 'Type',
  },
  {
    key: 'isActive',
    width: 150,
    defaultVisible: false,
    render: (row, { t }) => activeLabel(row?.isActive, t),
    labelKey: 'wms.locations.columns.isActive',
    fallbackLabel: 'Status',
  },
];

export function createWmsLocationsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    warehouseById,
  } = options;

  return LOCATION_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: column.defaultVisible !== false,
    sortable: column.key !== 'warehouseId' && column.key !== 'isActive',
    width: Number(column.width || 170),
    canHide: true,
    align: 'left',
    resizable: true,
    render: (row) => column.render(row, { t, warehouseById }),
  }));
}
