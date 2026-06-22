import { WmsStatusChip } from '../../../wms/ui';

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
    render: (row, { typeLabel }) => typeLabel(row?.type),
    labelKey: 'wms.locations.columns.type',
    fallbackLabel: 'Type',
  },
  {
    key: 'isActive',
    width: 150,
    render: (row, { t }) => {
      const status = row?.isActive === false ? 'inactive' : 'active';
      return (
        <WmsStatusChip status={status} size="sm">
          {activeLabel(row?.isActive, t)}
        </WmsStatusChip>
      );
    },
    labelKey: 'wms.locations.columns.isActive',
    fallbackLabel: 'Status',
  },
];

export function createWmsLocationsColumns(options = {}) {
  const {
    t = (key, fallback) => fallback || key,
    warehouseById,
    typeLabel = asDash,
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
    render: (row) => column.render(row, { t, warehouseById, typeLabel }),
  }));
}
