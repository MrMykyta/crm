import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useListProductsQuery } from '../../../store/rtk/productsApi';
import { useListWarehousesQuery } from '../../../store/rtk/wmsDocumentsApi';
import { useGetStockTurnoverReportQuery } from '../../../store/rtk/wmsReportsApi';
import s from '../StockValuationReportPage/StockValuationReportPage.module.css';

const GROUP_BY_OPTIONS = [
  { value: 'product', labelKey: 'wms.stockTurnover.groupBy.product', fallback: 'Product' },
  { value: 'warehouse', labelKey: 'wms.stockTurnover.groupBy.warehouse', fallback: 'Warehouse' },
  { value: 'productWarehouse', labelKey: 'wms.stockTurnover.groupBy.productWarehouse', fallback: 'Product + warehouse' },
  { value: 'documentType', labelKey: 'wms.stockTurnover.groupBy.documentType', fallback: 'Document type' },
];

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function monthStartIsoDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().slice(0, 10);
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
  if (groupBy === 'documentType') {
    columns.push('documentType');
  }

  return columns;
}

function rowKey(row, groupBy) {
  return [
    groupBy,
    row.warehouseId || 'all-wh',
    row.productId || 'all-product',
    row.variantId || 'no-variant',
    row.documentType || 'all-docs',
    row.currency || 'currency',
  ].join('-');
}

export default function StockTurnoverReportPage() {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState({
    dateFrom: monthStartIsoDate(),
    dateTo: todayIsoDate(),
    warehouseId: '',
    productId: '',
    currency: '',
    groupBy: 'product',
  });
  const [productSearch, setProductSearch] = useState('');

  const dateValidationError = !filters.dateFrom || !filters.dateTo
    ? t('wms.stockTurnover.validation.dateRangeRequired', 'Date from and date to are required.')
    : '';

  const queryArgs = useMemo(
    () => ({
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      warehouseId: filters.warehouseId || undefined,
      productId: filters.productId || undefined,
      currency: filters.currency || undefined,
      groupBy: filters.groupBy || 'product',
    }),
    [filters]
  );

  const shouldSkipReport = Boolean(dateValidationError);
  const { data, isLoading, isFetching, isError, error, refetch } = useGetStockTurnoverReportQuery(queryArgs, {
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
      dateFrom: monthStartIsoDate(),
      dateTo: todayIsoDate(),
      warehouseId: '',
      productId: '',
      currency: '',
      groupBy: 'product',
    });
    setProductSearch('');
  };

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>{t('wms.stockTurnover.title', 'Obroty magazynowe')}</h1>
          <p className={s.subtle}>
            {t('wms.stockTurnover.subtitle', 'Stock movement turnover from FIFO-costed stock moves.')}
          </p>
        </div>
        <button type="button" className={s.button} onClick={() => refetch()} disabled={busy || shouldSkipReport}>
          {busy ? t('common.loading', 'Loading...') : t('common.refresh', 'Refresh')}
        </button>
      </header>

      <section className={s.panel}>
        <div className={s.filtersGrid}>
          <label className={s.field}>
            <span>{t('wms.stockTurnover.filters.dateFrom', 'Date from')}</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              required
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockTurnover.filters.dateTo', 'Date to')}</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              required
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockTurnover.filters.warehouse', 'Warehouse')}</span>
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
            <span>{t('wms.stockTurnover.filters.productSearch', 'Product search')}</span>
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder={t('wms.stockTurnover.filters.productSearchPlaceholder', 'Search product name or SKU...')}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockTurnover.filters.product', 'Product')}</span>
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
            <span>{t('wms.stockTurnover.filters.currency', 'Currency')}</span>
            <input
              value={filters.currency}
              onChange={(event) => updateFilter('currency', event.target.value.toUpperCase().slice(0, 3))}
              placeholder="PLN"
              maxLength={3}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.stockTurnover.filters.groupBy', 'Group by')}</span>
            <select value={filters.groupBy} onChange={(event) => updateFilter('groupBy', event.target.value)}>
              {GROUP_BY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey, option.fallback)}
                </option>
              ))}
            </select>
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
          <span>{t('wms.stockTurnover.totals.qtyIn', 'Qty in')}</span>
          <strong>{formatQty(totals.qtyIn, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockTurnover.totals.qtyOut', 'Qty out')}</span>
          <strong>{formatQty(totals.qtyOut, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockTurnover.totals.valueIn', 'Value in')}</span>
          <strong>{formatMoney(totals.valueIn, totals.currency, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockTurnover.totals.valueOut', 'Value out')}</span>
          <strong>{formatMoney(totals.valueOut, totals.currency, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockTurnover.totals.netQty', 'Net qty')}</span>
          <strong>{formatQty(totals.netQty, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.stockTurnover.totals.netValue', 'Net value')}</span>
          <strong>{formatMoney(totals.netValue, totals.currency, i18n.language)}</strong>
        </div>
      </section>

      <section className={s.panel}>
        {dateValidationError ? <div className={s.error}>{dateValidationError}</div> : null}
        {isError ? (
          <div className={s.error}>
            {getErrorText(error, t('wms.stockTurnover.error', 'Failed to load stock turnover report.'))}
          </div>
        ) : null}

        {busy ? <div className={s.state}>{t('common.loading', 'Loading...')}</div> : null}

        {!busy && !isError && !dateValidationError && rows.length === 0 ? (
          <div className={s.state}>{t('wms.stockTurnover.empty', 'No turnover rows for this period.')}</div>
        ) : null}

        {!busy && !isError && !dateValidationError && rows.length > 0 ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  {visibleColumns.includes('warehouse') ? <th>{t('wms.stockTurnover.columns.warehouse', 'Warehouse')}</th> : null}
                  {visibleColumns.includes('product') ? <th>{t('wms.stockTurnover.columns.product', 'Product')}</th> : null}
                  {visibleColumns.includes('sku') ? <th>{t('wms.stockTurnover.columns.sku', 'SKU')}</th> : null}
                  {visibleColumns.includes('variant') ? <th>{t('wms.stockTurnover.columns.variant', 'Variant')}</th> : null}
                  {visibleColumns.includes('documentType') ? <th>{t('wms.stockTurnover.columns.documentType', 'Document type')}</th> : null}
                  <th className={s.textRight}>{t('wms.stockTurnover.columns.qtyIn', 'Qty in')}</th>
                  <th className={s.textRight}>{t('wms.stockTurnover.columns.qtyOut', 'Qty out')}</th>
                  <th className={s.textRight}>{t('wms.stockTurnover.columns.valueIn', 'Value in')}</th>
                  <th className={s.textRight}>{t('wms.stockTurnover.columns.valueOut', 'Value out')}</th>
                  <th className={s.textRight}>{t('wms.stockTurnover.columns.netQty', 'Net qty')}</th>
                  <th className={s.textRight}>{t('wms.stockTurnover.columns.netValue', 'Net value')}</th>
                  <th>{t('wms.stockTurnover.columns.currency', 'Currency')}</th>
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
                    {visibleColumns.includes('documentType') ? <td>{row.documentType || '—'}</td> : null}
                    <td className={s.textRight}>{formatQty(row.qtyIn, i18n.language)}</td>
                    <td className={s.textRight}>{formatQty(row.qtyOut, i18n.language)}</td>
                    <td className={s.textRight}>{formatMoney(row.valueIn, row.currency, i18n.language)}</td>
                    <td className={s.textRight}>{formatMoney(row.valueOut, row.currency, i18n.language)}</td>
                    <td className={s.textRight}>{formatQty(row.netQty, i18n.language)}</td>
                    <td className={s.textRight}>{formatMoney(row.netValue, row.currency, i18n.language)}</td>
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
