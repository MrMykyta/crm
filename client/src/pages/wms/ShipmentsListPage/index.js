import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import useGridPrefs from '../../../hooks/useGridPrefs';
import { createWmsShipmentsColumns } from '../../../components/data/ListPage/columnSchemas/wmsShipmentsColumns';

const STATUS_OPTIONS = ['', 'packing', 'shipped', 'cancelled'];

export default function ShipmentsListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

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
  } = useGridPrefs('wms.shipments');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/wms/shipments/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createWmsShipmentsColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
    [openDetail, t, i18n.language]
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`, value) : t('common.none', '—'),
    })),
    [t]
  );

  return (
    <ListPage
      source="wmsShipments"
      title={t('wms.shipments.title', 'WZ shipments')}
      columns={columns}
      defaultQuery={{ sort: 'createdAt', dir: 'DESC', limit: 25 }}
      emptyStateText={t('wms.shipments.empty', 'No shipment documents')}
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
              type: 'search',
              key: 'search',
              placeholder: t('wms.shipments.search', 'Search by number...'),
              debounce: 350,
            },
            {
              type: 'select',
              key: 'status',
              label: t('common.status', 'Status'),
              options: statusOptions,
            },
          ]}
        />
      )}
    />
  );
}
