import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../../components/data/ListPage';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import { createOffersColumns } from '../../../../components/data/ListPage/columnSchemas/offersColumns';

const STATUS_OPTIONS = ['', 'draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired', 'cancelled'];

export default function OffersListPage() {
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
  } = useGridPrefs('oms.offers');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/oms/offers/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createOffersColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
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
      source="offers"
      title={t('oms.offers.title', t('menu.offers'))}
      columns={columns}
      defaultQuery={{ sort: 'updatedAt', dir: 'DESC', limit: 25 }}
      actions={(
        <AddButton onClick={() => navigate('/main/oms/offers/new')}>
          {t('oms.offers.add', 'Add offer')}
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
              placeholder: t('oms.offers.search', 'Search by number or counterparty...'),
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
