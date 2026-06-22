import { WmsStatusChip } from '../../../wms/ui';

function asText(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function asDash(value) {
  const text = asText(value);
  return text || '—';
}

function activeLabel(value, t) {
  return value === false
    ? t('wms.common.inactive', 'Inactive')
    : t('wms.common.active', 'Active');
}

const WAREHOUSE_COLUMNS = [
  {
    key: 'code',
    width: 160,
    render: (row) => asDash(row?.code),
    labelKey: 'wms.warehouses.columns.code',
    fallbackLabel: 'Code',
  },
  {
    key: 'name',
    width: 280,
    render: (row) => asDash(row?.name),
    labelKey: 'wms.warehouses.columns.name',
    fallbackLabel: 'Name',
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
    labelKey: 'wms.warehouses.columns.isActive',
    fallbackLabel: 'Status',
  },
];

export function createWmsWarehousesColumns(options = {}) {
  const { t = (key, fallback) => fallback || key } = options;

  return WAREHOUSE_COLUMNS.map((column) => ({
    key: column.key,
    title: t(column.labelKey, column.fallbackLabel),
    managerLabel: t(column.labelKey, column.fallbackLabel),
    managerGroup: 'main',
    defaultVisible: true,
    sortable: column.key !== 'isActive',
    width: Number(column.width || 170),
    canHide: true,
    align: 'left',
    resizable: true,
    render: (row) => column.render(row, { t }),
  }));
}
