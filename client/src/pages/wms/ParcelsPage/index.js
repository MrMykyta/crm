import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import FilterToolbar from '../../../components/filters/FilterToolbar';
import ListPage from '../../../components/data/ListPage';
import { createWmsParcelsColumns } from '../../../components/data/ListPage/columnSchemas/wmsParcelsColumns';
import useAclPermissions from '../../../hooks/useAclPermissions';
import useGridPrefs from '../../../hooks/useGridPrefs';
import s from '../WmsMasterDataPage.module.css';

function setFilter(onChange, key, value) {
  onChange((query) => ({
    ...query,
    [key]: value || undefined,
    page: 1,
  }));
}

function TextFilter({ query, onChange, fieldKey, placeholder }) {
  return (
    <input
      className={s.filterInput}
      value={query?.[fieldKey] || ''}
      placeholder={placeholder}
      onChange={(event) => setFilter(onChange, fieldKey, event.target.value)}
    />
  );
}

export default function ParcelsPage() {
  const { t, i18n } = useTranslation();
  const { can, isLoading, hasResolvedPermissions } = useAclPermissions();
  const canRead = can('wms:read');

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
  } = useGridPrefs('wms.parcels');

  const columns = useMemo(
    () => createWmsParcelsColumns({ t, locale: i18n.language }),
    [t, i18n.language]
  );

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.parcels.noReadPermission', 'You do not have permission to view parcels.')}</p>
      </div>
    );
  }

  return (
    <ListPage
      source="wmsParcels"
      title={t('wms.parcels.title', 'Parcels')}
      columns={columns}
      defaultQuery={{ limit: 25, sort: 'createdAt', dir: 'DESC' }}
      emptyStateText={t('wms.parcels.empty', 'No parcels found')}
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
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="search"
                  placeholder={t('wms.parcels.filters.search', 'Search by tracking number or carrier...')}
                />
              ),
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="shipmentId"
                  placeholder={t('wms.parcels.filters.shipmentId', 'Shipment ID')}
                />
              ),
            },
          ]}
        />
      )}
    />
  );
}
