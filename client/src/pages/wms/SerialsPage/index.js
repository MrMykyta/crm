import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Workspace } from '../../../components/workspace';
import { createWmsSerialsColumns } from '../../../components/workspace/columnSchemas/wmsSerialsColumns';
import { SearchField } from '../../../components/ui/fields';
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
    <SearchField
      value={query?.[fieldKey] || ''}
      placeholder={placeholder}
      onValueChange={(value) => setFilter(onChange, fieldKey, value)}
      inputClassName={s.filterInput}
    />
  );
}

export default function SerialsPage() {
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
  } = useGridPrefs('wms.serials');

  const columns = useMemo(
    () => createWmsSerialsColumns({ t, locale: i18n.language }),
    [t, i18n.language]
  );

  if (isLoading && !hasResolvedPermissions) {
    return <div className={s.forbidden}>{t('common.loading', 'Loading...')}</div>;
  }

  if (!canRead) {
    return (
      <div className={s.forbidden}>
        <h2>{t('common.noPermission', 'No permission')}</h2>
        <p>{t('wms.serials.noReadPermission', 'You do not have permission to view serial numbers.')}</p>
      </div>
    );
  }

  return (
    <Workspace
      source="wmsSerials"
      title={t('wms.serials.title', 'Serial numbers')}
      columns={columns}
      defaultQuery={{ limit: 25, sort: 'createdAt', dir: 'DESC' }}
      emptyStateText={t('wms.serials.empty', 'No serials found')}
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
              type: 'custom',
              render: ({ query, onChange }) => (
                <TextFilter
                  query={query}
                  onChange={onChange}
                  fieldKey="search"
                  placeholder={t('wms.serials.filters.search', 'Search by serial number...')}
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
                  placeholder={t('wms.serials.filters.productId', 'Product ID')}
                />
              ),
            },
          ]}
    />
  );
}
