import { useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import ListPage from '../../../components/data/ListPage';
import FilterToolbar from '../../../components/filters/FilterToolbar';
import { CheckboxField } from '../../../components/ui/fields';
import useGridPrefs from '../../../hooks/useGridPrefs';
import { createStockBalancesColumns } from '../../../components/data/ListPage/columnSchemas/stockBalancesColumns';

export default function StockBalancesPage() {
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
  } = useGridPrefs('wms.stockBalances');

  const openProduct = useCallback(
    (id) => {
      if (!id) return;
      navigate(`/main/products/${id}`);
    },
    [navigate]
  );

  const columns = useMemo(
    () => createStockBalancesColumns({ t, locale: i18n.language, onOpenProduct: openProduct }),
    [t, i18n.language, openProduct]
  );

  return (
    <ListPage
      source="stockBalances"
      title={t('wms.stockBalances.title', 'Stany magazynowe')}
      columns={columns}
      defaultQuery={{ onlyPositive: true, limit: 200 }}
      emptyStateText={t('wms.stockBalances.empty', 'Brak stanów magazynowych')}
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
              placeholder: t('wms.stockBalances.search', 'Szukaj po nazwie lub SKU...'),
              debounce: 350,
            },
            {
              type: 'custom',
              render: ({ query, onChange }) => {
                const checked = query?.onlyPositive === true || query?.onlyPositive === 'true';
                return (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      color: 'var(--ui-text-1)',
                      fontSize: 13,
                    }}
                  >
                    <CheckboxField
                      checked={checked}
                      label={t('wms.stockBalances.onlyPositive', 'Tylko dodatnie')}
                      fullWidth={false}
                      onValueChange={(next) => {
                        onChange((q) => ({
                          ...q,
                          onlyPositive: next ? true : undefined,
                          page: 1,
                        }));
                      }}
                    />
                  </div>
                );
              },
            },
          ]}
        />
      )}
    />
  );
}
