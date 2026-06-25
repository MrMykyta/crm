import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Workspace } from '../../../components/workspace';
import { createWmsReservationsColumns } from '../../../components/workspace/columnSchemas/wmsReservationsColumns';
import { SearchField } from '../../../components/ui/fields';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import s from '../WmsMasterDataPage.module.css';

const RESERVATION_STATUSES = ['', 'active', 'fulfilled', 'cancelled'];

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

export default function ReservationsPage() {
  const { t, i18n } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  // The reservation router is fully guarded by wms:reservation:manage (incl. list).
  const canRead = can('wms:reservation:manage');

  const statusOptions = useMemo(() => (
    RESERVATION_STATUSES.map((value) => ({
      value,
      label: value ? t(`wms.reservations.status.${value}`, value) : t('common.all', 'All'),
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
  } = useGridPrefs('wms.reservations');

  const columns = useMemo(
    () => createWmsReservationsColumns({ t, locale: i18n.language }),
    [t, i18n.language]
  );

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.reservations.noReadPermission', 'You do not have permission to view reservations.')}</p>
      </div>
    );
  }

  return (
    <Workspace
      source="wmsReservations"
      title={t('wms.reservations.title', 'Reservations')}
      columns={columns}
      defaultQuery={{ limit: 25, sort: 'createdAt', dir: 'DESC' }}
      emptyStateText={t('wms.reservations.empty', 'No reservations found')}
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
      filterControls={[
            {
              type: 'select',
              key: 'status',
              label: t('wms.reservations.filters.status', 'Status'),
              options: statusOptions,
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="warehouseId"
                  placeholder={t('wms.reservations.filters.warehouseId', 'Warehouse ID')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="productId"
                  placeholder={t('wms.reservations.filters.productId', 'Product ID')}
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
                  placeholder={t('wms.reservations.filters.variantId', 'Variant ID')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="orderId"
                  placeholder={t('wms.reservations.filters.orderId', 'Source order ID')}
                />
              ),
            },
          ]}
    />
  );
}
