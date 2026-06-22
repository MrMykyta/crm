import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useListProductsQuery } from '../../../store/rtk/productsApi';
import { useListWarehousesQuery } from '../../../store/rtk/wmsDocumentsApi';
import { useGetStockValuationReportQuery } from '../../../store/rtk/wmsReportsApi';
import s from './StockValuationReportPage.module.css';

const GROUP_BY_OPTIONS = [
  { value: 'product', labelKey: 'wms.stockValuation.groupBy.product', fallback: 'Product' },
  { value: 'warehouse', labelKey: 'wms.stockValuation.groupBy.warehouse', fallback: 'Warehouse' },
  { value: 'productWarehouse', labelKey: 'wms.stockValuation.groupBy.productWarehouse', fallback: 'Product + warehouse' },
];

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

export default function StockValuationReportPage({ embedded = false }) {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState({
    warehouseId: '',
    productId: '',
    currency: '',
    groupBy: 'product',
  });
  const [productSearch, setProductSearch] = useState('');

  const queryArgs = useMemo(
    () => ({
      warehouseId: filters.warehouseId || undefined,
      productId: filters.productId || undefined,
      currency: filters.currency || undefined,
      groupBy: filters.groupBy || 'product',
    }),
    [filters]
  );

  const { data, isLoading, isFetching, isError, error, refetch } = useGetStockValuationReportQuery(queryArgs, {
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

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const clearFilters = () => {
    setFilters({ warehouseId: '', productId: '', currency: '', groupBy: 'product' });
    setProductSearch('');
  };

  return (
    <div className={`${s.page} ${embedded ? s.embedded : ''}`}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>{t('wms.stockValuation.title', 'Wartość magazynu')}</h1>
          <p className={s.subtle}>
            {t('wms.stockValuation.subtitle', 'FIFO valuation from remaining cost layers.')}
          </p>
        </div>
        <button type="button" className={s.button} onClick={() => refetch()} disabled={busy}>
          {busy ? t('common.loading', 'Loading...') : t('common.refresh', 'Refresh')}
        </button>
      </header>

      <section className={s.panel}>
        <div className={s.filtersGrid}>
          <label className={s.field}>
            <span>{t('wms.stockValuation.filters.warehouse', 'Warehouse')}</span>
            <select value={filters.warehouseId} onChange={(event) => updateFilter('warehouseId', event.target.value)}>
              <option value="">{t('common.all', 'All')}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {[warehouse.code, warehouse.name].filter(Boolean).join(' · ') || warehouse.id}
                </option>
              ))}
            </select>
          </label>

          <label className={s.field}>
            <span>{t('wms.stockValuation.filters.productSearch', 'Product search')}</span>
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder={t('wms.stockValuation.filters.productSearchPlaceholder', 'Search product name or SKU...')}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockValuation.filters.product', 'Product')}</span>
            <select value={filters.productId} onChange={(event) => updateFilter('productId', event.target.value)}>
              <option value="">{isFetchingProducts ? t('common.loading', 'Loading...') : t('common.all', 'All')}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {[product.name, product.sku].filter(Boolean).join(' · ') || product.id}
                </option>
              ))}
            </select>
          </label>

          <label className={s.field}>
            <span>{t('wms.stockValuation.filters.currency', 'Currency')}</span>
            <input
              value={filters.currency}
              onChange={(event) => updateFilter('currency', event.target.value.toUpperCase().slice(0, 3))}
              placeholder="PLN"
              maxLength={3}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockValuation.filters.groupBy', 'Group by')}</span>
            <select value={filters.groupBy} onChange={(event) => updateFilter('groupBy', event.target.value)}>
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey, option.fallback)}
                </option>
              ))}
            </select>
          </label>

          <label className={`${s.field} ${s.disabledField}`}>
            <span>{t('wms.stockValuation.filters.asOf', 'As of date')}</span>
            <input value={t('wms.stockValuation.asOfComingSoon', 'Coming soon')} disabled readOnly />
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
          <span>{t('wms.stockValuation.totals.qtyRemaining', 'Qty remaining')}</span>
          <strong>{formatQty(totals.qtyRemaining, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockValuation.totals.stockValue', 'Stock value')}</span>
          <strong>{formatMoney(totals.stockValue, totals.currency, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockValuation.totals.currency', 'Currency')}</span>
          <strong>{totals.currency || '—'}</strong>
        </div>
      </section>

      <section className={s.panel}>
        {isError ? (
          <div className={s.error}>
            {getErrorText(error, t('wms.stockValuation.error', 'Failed to load stock valuation report.'))}
          </div>
        ) : null}

        {busy ? (
          <div className={s.state}>{t('common.loading', 'Loading...')}</div>
        ) : null}

        {!busy && !isError && rows.length === 0 ? (
          <div className={s.state}>{t('wms.stockValuation.empty', 'No valuation rows.')}</div>
        ) : null}

        {!busy && !isError && rows.length > 0 ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('wms.stockValuation.columns.warehouse', 'Warehouse')}</th>
                  <th>{t('wms.stockValuation.columns.product', 'Product')}</th>
                  <th>{t('wms.stockValuation.columns.sku', 'SKU')}</th>
                  <th>{t('wms.stockValuation.columns.variant', 'Variant')}</th>
                  <th className={s.textRight}>{t('wms.stockValuation.columns.qtyRemaining', 'Qty remaining')}</th>
                  <th className={s.textRight}>{t('wms.stockValuation.columns.stockValue', 'Stock value')}</th>
                  <th>{t('wms.stockValuation.columns.currency', 'Currency')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.warehouseId || 'all-wh'}-${row.productId || 'all-product'}-${row.variantId || 'no-variant'}-${row.currency || 'currency'}`}>
                    <td>{warehouseLabel(row)}</td>
                    <td>
                      {row.productId ? (
                        <Link className={s.link} to={`/main/products/${row.productId}`}>
                          {productLabel(row)}
                        </Link>
                      ) : (
                        productLabel(row)
                      )}
                    </td>
                    <td>{row.productSku || '—'}</td>
                    <td>{row.variantName || row.variantSku || row.variantId || '—'}</td>
                    <td className={s.textRight}>{formatQty(row.qtyRemaining, i18n.language)}</td>
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
