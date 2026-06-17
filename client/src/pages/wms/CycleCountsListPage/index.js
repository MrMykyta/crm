import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import AddButton from '../../../components/buttons/AddButton/AddButton';
import useGridPrefs from '../../../hooks/useGridPrefs';
import { createWmsCycleCountsColumns } from '../../../components/data/ListPage/columnSchemas/wmsCycleCountsColumns';
import { isWmsUiNavEnabled } from '../../../config/featureFlags';
import WmsSectionTabs from '../navigation/WmsSectionTabs';
import {
  WMS_DOCUMENT_TYPE_VIEWS,
  WMS_DOCUMENT_WORKFLOW_VIEWS,
} from '../navigation/wmsUiNavigation';

const STATUS_OPTIONS = ['', 'planned', 'counting', 'reconciled'];

export default function CycleCountsListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const wmsNavEnabled = isWmsUiNavEnabled();

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
  } = useGridPrefs('wms.cycleCounts');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/wms/cycle-counts/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createWmsCycleCountsColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
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
    <>
      {wmsNavEnabled ? (
        <WmsSectionTabs
          title="Documents"
          groups={[
            { key: 'views', label: 'Views', items: WMS_DOCUMENT_WORKFLOW_VIEWS },
            {
              key: 'types',
              label: 'Types',
              items: WMS_DOCUMENT_TYPE_VIEWS.map((item) => ({
                ...item,
                active: item.type === 'CC',
              })),
            },
          ]}
        />
      ) : null}
      <ListPage
        source="wmsCycleCounts"
        title={t('wms.cycleCounts.title', 'Inventory counts')}
        columns={columns}
        defaultQuery={{ sort: 'createdAt', dir: 'DESC', limit: 25 }}
        emptyStateText={t('wms.cycleCounts.empty', 'No inventory count sheets')}
        actions={(
          <AddButton onClick={() => navigate('/main/wms/cycle-counts/new')}>
            {wmsNavEnabled ? 'Create CC' : t('wms.cycleCounts.actions.new', 'New count sheet')}
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
              type: 'select',
              key: 'status',
              label: t('common.status', 'Status'),
              options: statusOptions,
            },
          ]}
        />
      )}
      />
    </>
  );
}
