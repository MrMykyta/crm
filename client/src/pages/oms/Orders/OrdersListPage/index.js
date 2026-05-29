import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../../components/data/ListPage';
import FilterToolbar from '../../../../components/filters/FilterToolbar';
import AddButton from '../../../../components/buttons/AddButton/AddButton';
import useGridPrefs from '../../../../hooks/useGridPrefs';
import { createOrdersColumns } from '../../../../components/data/ListPage/columnSchemas/ordersColumns';

const STATUS_OPTIONS = [
  '',
  'draft',
  'new',
  'confirmed',
  'paid',
  'shipped',
  'completed',
  'cancelled',
  'returned',
];

export default function OrdersListPage() {
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
  } = useGridPrefs('oms.orders');

  const openDetail = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/oms/orders/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createOrdersColumns({ onOpenDetail: openDetail, t, locale: i18n.language }),
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
      source="orders"
      title={t('oms.orders.title', t('menu.orders'))}
      columns={columns}
      defaultQuery={{ sort: 'updatedAt', dir: 'DESC', limit: 25 }}
      actions={(
        <AddButton onClick={() => navigate('/main/oms/orders/new')}>
          {t('oms.orders.add', 'Add order')}
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
              placeholder: t('oms.orders.search', 'Search by number or counterparty...'),
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
