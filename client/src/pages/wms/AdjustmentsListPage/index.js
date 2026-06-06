import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import useGridPrefs from '../../../hooks/useGridPrefs';
import { createWmsAdjustmentsColumns } from '../../../components/data/ListPage/columnSchemas/wmsAdjustmentsColumns';

const STATUS_OPTIONS = ['', 'draft', 'posted'];
const TYPE_OPTIONS = ['', 'PW', 'RW'];

export default function AdjustmentsListPage() {
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
  } = useGridPrefs('wms.adjustments');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/wms/adjustments/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createWmsAdjustmentsColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
    [openDetail, t, i18n.language]
  );

  const statusOptions = useMemo(
    () => STATUS_OPTIONS.map((value) => ({
      value,
      label: value ? t(`statuses.${value}`, value) : t('common.none', '—'),
    })),
    [t]
  );

  const typeOptions = useMemo(
    () => TYPE_OPTIONS.map((value) => ({
      value,
      label: value ? t(`wms.adjustments.types.${value}`, value) : t('common.none', '—'),
    })),
    [t]
  );

  return (
    <ListPage
      source="wmsAdjustments"
      title={t('wms.adjustments.title', 'RW/PW adjustments')}
      columns={columns}
      defaultQuery={{ sort: 'createdAt', dir: 'DESC', limit: 25 }}
      emptyStateText={t('wms.adjustments.empty', 'No adjustment documents')}
      actions={(
        <AddButton onClick={() => navigate('/main/wms/adjustments/new')}>
          {t('wms.adjustments.actions.new', 'New adjustment')}
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
              placeholder: t('wms.adjustments.search', 'Search by number...'),
              debounce: 350,
            },
            {
              type: 'select',
              key: 'documentType',
              label: t('wms.adjustments.filters.documentType', 'Type'),
              options: typeOptions,
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
