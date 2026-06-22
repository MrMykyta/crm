import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useListProductsQuery } from '../../../store/rtk/productsApi';
import { useListWarehousesQuery } from '../../../store/rtk/wmsDocumentsApi';
import { useGetStockAsOfReportQuery } from '../../../store/rtk/wmsReportsApi';
import { DateTimeField, SearchField, SelectField, TextField } from '../../../components/ui/fields';
import s from '../StockValuationReportPage/StockValuationReportPage.module.css';

const GROUP_BY_OPTIONS = [
  { value: 'product', labelKey: 'wms.stockAsOf.groupBy.product', fallback: 'Product' },
  { value: 'warehouse', labelKey: 'wms.stockAsOf.groupBy.warehouse', fallback: 'Warehouse' },
  { value: 'productWarehouse', labelKey: 'wms.stockAsOf.groupBy.productWarehouse', fallback: 'Product + warehouse' },
];

function currentLocalDateTime() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function formatQty(value, locale = 'en') {
  const qty = Number(value);
  if (!Number.isFinite(qty)) return '—';
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(qty);
}

function formatMoney(value, currency, locale = 'en') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  const suffix = asText(currency);
  return `${new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)}${suffix ? ` ${suffix}` : ''}`;
}

function warehouseLabel(row) {
  return [row?.warehouseCode, row?.warehouseName].filter(Boolean).join(' · ') || row?.warehouseId || '—';
}

function productLabel(row) {
  return [row?.productName, row?.productSku].filter(Boolean).join(' · ') || row?.productId || '—';
}

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function buildVisibleColumns(groupBy) {
  const columns = [];

  if (groupBy === 'warehouse' || groupBy === 'productWarehouse') {
    columns.push('warehouse');
  }
  if (groupBy === 'product' || groupBy === 'productWarehouse') {
    columns.push('product', 'sku', 'variant');
  }

  return columns;
}

function rowKey(row, groupBy) {
  return [
    groupBy,
    row.warehouseId || 'all-wh',
    row.productId || 'all-product',
    row.variantId || 'no-variant',
    row.currency || 'currency',
  ].join('-');
}

export default function StockAsOfReportPage({ embedded = false }) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState({
    asOf: currentLocalDateTime(),
    warehouseId: '',
    productId: '',
    currency: '',
    groupBy: 'product',
  });
  const [productSearch, setProductSearch] = useState('');

  const asOfValidationError = !filters.asOf
    ? t('wms.stockAsOf.validation.asOfRequired', 'As-of date is required.')
    : '';

  const queryArgs = useMemo(
    () => ({
      asOf: filters.asOf || undefined,
      warehouseId: filters.warehouseId || undefined,
      productId: filters.productId || undefined,
      currency: filters.currency || undefined,
      groupBy: filters.groupBy || 'product',
    }),
    [filters]
  );

  const shouldSkipReport = Boolean(asOfValidationError);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetStockAsOfReportQuery(queryArgs, {
    skip: shouldSkipReport,
    refetchOnMountOrArgChange: true,
  });
  const { data: warehousesData } = useListWarehousesQuery({
    limit: 200,
    sort: 'code',
    dir: 'ASC',
  });
  const { data: productsData, isFetching: isFetchingProducts } = useListProductsQuery({
    search: productSearch || undefined,
    limit: 30,
    sort: 'name',
    dir: 'ASC',
  });

  const warehouses = useMemo(
    () => (Array.isArray(warehousesData?.items) ? warehousesData.items : []),
    [warehousesData]
  );
  const products = useMemo(
    () => (Array.isArray(productsData?.items) ? productsData.items : []),
    [productsData]
  );
  const rows = Array.isArray(data?.items) ? data.items : [];
  const totals = data?.totals || {};
  const busy = isLoading || isFetching;
  const visibleColumns = buildVisibleColumns(filters.groupBy);

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({
      asOf: currentLocalDateTime(),
      warehouseId: '',
      productId: '',
      currency: '',
      groupBy: 'product',
    });
    setProductSearch('');
  };

  return (
    <div className={`${s.page} ${embedded ? s.embedded : ''}`}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>{t('wms.stockAsOf.title', 'Stan magazynu na dzień')}</h1>
          <p className={s.subtle}>
            {t('wms.stockAsOf.subtitle', 'Historical stock quantity and FIFO value reconstructed from stock moves.')}
          </p>
        </div>
        <button type="button" className={s.button} onClick={() => refetch()} disabled={busy || shouldSkipReport}>
          {busy ? t('common.loading', 'Loading...') : t('common.refresh', 'Refresh')}
        </button>
      </header>

      <section className={s.panel}>
        <div className={s.filtersGrid}>
          <label className={s.field}>
            <span>{t('wms.stockAsOf.filters.asOf', 'As of')}</span>
            <DateTimeField
              value={filters.asOf}
              onValueChange={(value) => updateFilter('asOf', value)}
              required
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockAsOf.filters.warehouse', 'Warehouse')}</span>
            <SelectField
              value={filters.warehouseId}
              onValueChange={(value) => updateFilter('warehouseId', value)}
              options={[
                { value: '', label: t('common.all', 'All') },
                ...warehouses.map((warehouse) => ({
                  value: warehouse.id,
                  label: [warehouse.code, warehouse.name].filter(Boolean).join(' · ') || warehouse.id,
                })),
              ]}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockAsOf.filters.productSearch', 'Product search')}</span>
            <SearchField
              value={productSearch}
              onValueChange={setProductSearch}
              placeholder={t('wms.stockAsOf.filters.productSearchPlaceholder', 'Search product name or SKU...')}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockAsOf.filters.product', 'Product')}</span>
            <SelectField
              value={filters.productId}
              onValueChange={(value) => updateFilter('productId', value)}
              options={[
                { value: '', label: isFetchingProducts ? t('common.loading', 'Loading...') : t('common.all', 'All') },
                ...products.map((product) => ({
                  value: product.id,
                  label: [product.name, product.sku].filter(Boolean).join(' · ') || product.id,
                })),
              ]}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockAsOf.filters.currency', 'Currency')}</span>
            <TextField
              value={filters.currency}
              onValueChange={(value) => updateFilter('currency', value.toUpperCase().slice(0, 3))}
              placeholder="PLN"
              maxLength={3}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockAsOf.filters.groupBy', 'Group by')}</span>
            <SelectField
              value={filters.groupBy}
              onValueChange={(value) => updateFilter('groupBy', value)}
              options={GROUP_BY_OPTIONS.map((option) => ({
                value: option.value,
                label: t(option.labelKey, option.fallback),
              }))}
            />
          </label>
        </div>

        <div className={s.actions}>
          <button type="button" className={s.button} onClick={clearFilters}>
            {t('common.clear', 'Clear')}
          </button>
        </div>
      </section>

      <section className={s.totalsGrid}>
        <div className={s.totalCard}>
          <span>{t('wms.stockAsOf.totals.qty', 'Qty')}</span>
          <strong>{formatQty(totals.qty, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockAsOf.totals.stockValue', 'Stock value')}</span>
          <strong>{formatMoney(totals.stockValue, totals.currency, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockAsOf.totals.currency', 'Currency')}</span>
          <strong>{totals.currency || '—'}</strong>
        </div>
      </section>

      <section className={s.panel}>
        {asOfValidationError ? <div className={s.error}>{asOfValidationError}</div> : null}
        {isError ? (
          <div className={s.error}>
            {getErrorText(error, t('wms.stockAsOf.error', 'Failed to load stock as-of report.'))}
          </div>
        ) : null}

        {busy ? <div className={s.state}>{t('common.loading', 'Loading...')}</div> : null}

        {!busy && !isError && !asOfValidationError && rows.length === 0 ? (
          <div className={s.state}>{t('wms.stockAsOf.empty', 'No stock rows for selected date.')}</div>
        ) : null}

        {!busy && !isError && !asOfValidationError && rows.length > 0 ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  {visibleColumns.includes('warehouse') ? <th>{t('wms.stockAsOf.columns.warehouse', 'Warehouse')}</th> : null}
                  {visibleColumns.includes('product') ? <th>{t('wms.stockAsOf.columns.product', 'Product')}</th> : null}
                  {visibleColumns.includes('sku') ? <th>{t('wms.stockAsOf.columns.sku', 'SKU')}</th> : null}
                  {visibleColumns.includes('variant') ? <th>{t('wms.stockAsOf.columns.variant', 'Variant')}</th> : null}
                  <th className={s.textRight}>{t('wms.stockAsOf.columns.qty', 'Qty')}</th>
                  <th className={s.textRight}>{t('wms.stockAsOf.columns.stockValue', 'Stock value')}</th>
                  <th>{t('wms.stockAsOf.columns.currency', 'Currency')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={rowKey(row, filters.groupBy)}>
                    {visibleColumns.includes('warehouse') ? <td>{warehouseLabel(row)}</td> : null}
                    {visibleColumns.includes('product') ? (
                      <td>
                        {row.productId ? (
                          <Link className={s.link} to={`/main/products/${row.productId}`}>
                            {productLabel(row)}
                          </Link>
                        ) : (
                          productLabel(row)
                        )}
                      </td>
                    ) : null}
                    {visibleColumns.includes('sku') ? <td>{row.productSku || '—'}</td> : null}
                    {visibleColumns.includes('variant') ? <td>{row.variantName || row.variantSku || row.variantId || '—'}</td> : null}
                    <td className={s.textRight}>{formatQty(row.qty, i18n.language)}</td>
                    <td className={s.textRight}>{formatMoney(row.stockValue, row.currency, i18n.language)}</td>
                    <td>{row.currency || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
