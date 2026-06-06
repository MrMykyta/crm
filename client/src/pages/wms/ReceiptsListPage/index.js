import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import useGridPrefs from '../../../hooks/useGridPrefs';
import { createWmsReceiptsColumns } from '../../../components/data/ListPage/columnSchemas/wmsReceiptsColumns';

const STATUS_OPTIONS = ['', 'draft', 'received', 'putaway'];

export default function ReceiptsListPage() {
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
  } = useGridPrefs('wms.receipts');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/wms/receipts/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createWmsReceiptsColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
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
      source="wmsReceipts"
      title={t('wms.receipts.title', 'PZ receipts')}
      columns={columns}
      defaultQuery={{ sort: 'createdAt', dir: 'DESC', limit: 25 }}
      emptyStateText={t('wms.receipts.empty', 'No receipts')}
      actions={(
        <AddButton onClick={() => navigate('/main/wms/receipts/new')}>
          {t('wms.receipts.actions.new', 'New receipt')}
        </AddButton>
      )}
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
              placeholder: t('wms.receipts.search', 'Search by number...'),
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
