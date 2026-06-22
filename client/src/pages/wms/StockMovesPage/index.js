import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import FilterToolbar from '../../../components/filters/FilterToolbar';
import ListPage from '../../../components/data/ListPage';
import { createWmsStockMovesColumns } from '../../../components/data/ListPage/columnSchemas/wmsStockMovesColumns';
import { SearchField } from '../../../components/ui/fields';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import {
  useListLocationsQuery,
  useListWarehousesQuery,
} from '../../../store/rtk/wmsDocumentsApi';
import s from '../WmsMasterDataPage.module.css';

const STOCK_MOVE_TYPES = ['', 'receipt', 'putaway', 'pick', 'pack', 'ship', 'adjustment', 'transfer'];

function warehouseLabel(row) {
  return [row?.code, row?.name].filter(Boolean).join(' - ') || row?.id || '—';
}

function locationLabel(row) {
  const warehouseCode = row?.warehouse?.code ? `${row.warehouse.code} / ` : '';
  return `${warehouseCode}${row?.code || row?.id || '—'}`;
}

function setFilter(onChange, key, value) {
  onChange((query) => ({
    ...query,
    [key]: value || undefined,
    page: 1,
  }));
}

function TextFilter({ query, onChange, fieldKey, placeholder }) {
  return (
    <SearchField
      value={query?.[fieldKey] || ''}
      placeholder={placeholder}
      onValueChange={(value) => setFilter(onChange, fieldKey, value)}
      inputClassName={s.filterInput}
    />
  );
}

export default function StockMovesPage() {
  const { t, i18n } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canRead = can('wms:inventory:read');
  const { data: warehousesData } = useListWarehousesQuery(
    { limit: 200, sort: 'code', dir: 'ASC' },
    { skip: !canRead }
  );
  const { data: locationsData } = useListLocationsQuery(
    { limit: 200, sort: 'code', dir: 'ASC' },
    { skip: !canRead }
  );

  const warehouses = useMemo(
    () => (Array.isArray(warehousesData?.items) ? warehousesData.items : []),
    [warehousesData]
  );
  const locations = useMemo(
    () => (Array.isArray(locationsData?.items) ? locationsData.items : []),
    [locationsData]
  );

  const warehouseOptions = useMemo(() => ([
    { value: '', label: t('common.all', 'All') },
    ...warehouses.map((row) => ({ value: row.id, label: warehouseLabel(row) })),
  ]), [t, warehouses]);

  const locationOptions = useMemo(() => ([
    { value: '', label: t('common.all', 'All') },
    ...locations.map((row) => ({ value: row.id, label: locationLabel(row) })),
  ]), [t, locations]);

  const typeOptions = useMemo(() => (
    STOCK_MOVE_TYPES.map((value) => ({
      value,
      label: value ? t(`wms.stockMoves.types.${value}`, value) : t('common.all', 'All'),
    }))
  ), [t]);

  const {
    colWidths,
    colOrder,
    colVisibility,
    savedViews,
    activeViewId,
    onColumnResize,
    onColumnOrderChange,
    onColumnVisibilityChange,
    onSavedViewsChange,
    onActiveViewChange,
    resetGridPrefs,
  } = useGridPrefs('wms.stockMoves');

  const columns = useMemo(
    () => createWmsStockMovesColumns({ t, locale: i18n.language }),
    [t, i18n.language]
  );

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.stockMoves.noReadPermission', 'You do not have permission to view stock moves.')}</p>
      </div>
    );
  }

  return (
    <ListPage
      source="wmsStockMoves"
      title={t('wms.stockMoves.title', 'Stock moves')}
      columns={columns}
      defaultQuery={{ limit: 25, sort: 'createdAt', dir: 'DESC' }}
      emptyStateText={t('wms.stockMoves.empty', 'No stock moves found')}
      columnWidths={colWidths}
      onColumnResize={onColumnResize}
      columnOrder={colOrder}
      onColumnOrderChange={onColumnOrderChange}
      columnVisibility={colVisibility}
      onColumnVisibilityChange={onColumnVisibilityChange}
      savedViews={savedViews}
      activeViewId={activeViewId}
      onSavedViewsChange={onSavedViewsChange}
      onActiveViewChange={onActiveViewChange}
      onResetColumns={resetGridPrefs}
      ToolbarComponent={(props) => (
        <FilterToolbar
          {...props}
          controls={[
            {
              type: 'select',
              key: 'warehouseId',
              label: t('wms.fields.warehouse', 'Warehouse'),
              options: warehouseOptions,
            },
            {
              type: 'select',
              key: 'locationId',
              label: t('wms.fields.location', 'Location'),
              options: locationOptions,
            },
            {
              type: 'select',
              key: 'type',
              label: t('wms.stockMoves.filters.type', 'Stock move type'),
              options: typeOptions,
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="productId"
                  placeholder={t('wms.stockMoves.filters.productId', 'Product ID')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="variantId"
                  placeholder={t('wms.stockMoves.filters.variantId', 'Variant ID')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="dateFrom"
                  placeholder={t('wms.stockMoves.filters.dateFrom', 'Date from')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="dateTo"
                  placeholder={t('wms.stockMoves.filters.dateTo', 'Date to')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="refType"
                  placeholder={t('wms.stockMoves.filters.sourceType', 'Source type')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="refId"
                  placeholder={t('wms.stockMoves.filters.sourceId', 'Source ID')}
                />
              ),
            },
          ]}
        />
      )}
    />
  );
}
