import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../../components/data/ListPage';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import useAclPermissions from '../../../../hooks/useAclPermissions';
import { createInvoicesColumns } from '../../../../components/data/ListPage/columnSchemas/invoicesColumns';

const STATUS_OPTIONS = ['', 'draft', 'issued', 'paid'];

export default function InvoicesListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { can } = useAclPermissions();
  const canReadInvoices = can('order:read');

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
  } = useGridPrefs('oms.invoices');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/oms/invoices/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createInvoicesColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
    [openDetail, t, i18n.language]
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`) : t('common.none'),
    })),
    [t]
  );

  if (!canReadInvoices) {
    return (
      <div style={{ padding: 16, color: 'var(--ui-text-2)' }}>
        {t('common.noPermission')}
      </div>
    );
  }

  return (
    <ListPage
      source="invoices"
      title={t('oms.invoices.title')}
      columns={columns}
      defaultQuery={{ sort: 'createdAt', dir: 'DESC', limit: 25 }}
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
              placeholder: t('oms.invoices.search'),
              debounce: 350,
            },
            {
              type: 'select',
              key: 'status',
              label: t('oms.invoices.columns.status'),
              options: statusOptions,
            },
          ]}
        />
      )}
    />
  );
}
