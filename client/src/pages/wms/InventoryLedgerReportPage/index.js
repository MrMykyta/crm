import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useGetProductQuery, useListProductsQuery } from '../../../store/rtk/productsApi';
import { useListWarehousesQuery } from '../../../store/rtk/wmsDocumentsApi';
import { useGetInventoryLedgerReportQuery } from '../../../store/rtk/wmsReportsApi';
import s from '../StockValuationReportPage/StockValuationReportPage.module.css';

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

function formatDateTime(value, locale = 'en') {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function warehouseLabel(row) {
  return [row?.warehouseCode, row?.warehouseName].filter(Boolean).join(' · ') || row?.warehouseId || '—';
}

function locationLabel(row) {
  return [row?.locationCode, row?.locationName].filter(Boolean).join(' · ') || row?.locationId || '—';
}

function productLabel(product) {
  return [product?.name, product?.sku].filter(Boolean).join(' · ') || product?.id || '—';
}

function getErrorText(error, fallback) {
  return error?.data?.message || error?.data?.error || error?.error || error?.message || fallback;
}

function getDocumentRoute(row) {
  if (!row?.refId) return null;
  if (row.documentType === 'PZ') return `/main/wms/receipts/${row.refId}`;
  if (row.documentType === 'WZ') return `/main/wms/shipments/${row.refId}`;
  if (row.documentType === 'MM') return `/main/wms/transfers/${row.refId}`;
  if (row.documentType === 'RW' || row.documentType === 'PW') return `/main/wms/adjustments/${row.refId}`;
  return null;
}

function normalizeVariants(product) {
  const map = new Map();
  const add = (variant) => {
    if (!variant?.id) return;
    map.set(variant.id, variant);
  };
  if (Array.isArray(product?.variants)) product.variants.forEach(add);
  add(product?.defaultVariant);
  if (product?.variantId || product?.defaultVariantId) {
    add({ id: product.variantId || product.defaultVariantId, sku: product.variantSku || product.defaultVariantSku });
  }
  return [...map.values()];
}

function variantLabel(variant) {
  return [variant?.name, variant?.sku].filter(Boolean).join(' · ') || variant?.id || '—';
}

function rowKey(row, index) {
  return row.id || `${row.refType || 'ref'}-${row.refId || 'id'}-${row.refItemId || 'item'}-${index}`;
}

export default function InventoryLedgerReportPage() {
  const { t, i18n } = useTranslation();
  const [filters, setFilters] = useState({
    productId: '',
    variantId: '',
    dateFrom: monthStartIsoDate(),
    dateTo: todayIsoDate(),
    warehouseId: '',
    currency: '',
  });
  const [productSearch, setProductSearch] = useState('');

  const validationErrors = useMemo(() => {
    const errors = [];
    if (!filters.productId) errors.push(t('wms.inventoryLedger.validation.productRequired', 'Product is required.'));
    if (!filters.dateFrom || !filters.dateTo) {
      errors.push(t('wms.inventoryLedger.validation.dateRangeRequired', 'Date from and date to are required.'));
    }
    return errors;
  }, [filters.productId, filters.dateFrom, filters.dateTo, t]);

  const queryArgs = useMemo(
    () => ({
      productId: filters.productId || undefined,
      variantId: filters.variantId || undefined,
      dateFrom: filters.dateFrom || undefined,
      dateTo: filters.dateTo || undefined,
      warehouseId: filters.warehouseId || undefined,
      currency: filters.currency || undefined,
    }),
    [filters]
  );

  const shouldSkipReport = validationErrors.length > 0;
  const { data, isLoading, isFetching, isError, error, refetch } = useGetInventoryLedgerReportQuery(queryArgs, {
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
  const { data: selectedProduct } = useGetProductQuery(filters.productId, {
    skip: !filters.productId,
  });

  const warehouses = useMemo(
    () => (Array.isArray(warehousesData?.items) ? warehousesData.items : []),
    [warehousesData]
  );
  const products = useMemo(
    () => (Array.isArray(productsData?.items) ? productsData.items : []),
    [productsData]
  );
  const variants = useMemo(() => normalizeVariants(selectedProduct), [selectedProduct]);
  const rows = Array.isArray(data?.items) ? data.items : [];
  const totals = data?.totals || {};
  const busy = isLoading || isFetching;

  const updateFilter = (field, value) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'productId') next.variantId = '';
      return next;
    });
  };

  const clearFilters = () => {
    setFilters({
      productId: '',
      variantId: '',
      dateFrom: monthStartIsoDate(),
      dateTo: todayIsoDate(),
      warehouseId: '',
      currency: '',
    });
    setProductSearch('');
  };

  return (
    <div className={s.page}>
      <header className={s.header}>
        <div>
          <h1 className={s.title}>{t('wms.inventoryLedger.title', 'Karta magazynowa')}</h1>
          <p className={s.subtle}>
            {t('wms.inventoryLedger.subtitle', 'Product inventory ledger with running quantity and value balance.')}
          </p>
        </div>
        <button type="button" className={s.button} onClick={() => refetch()} disabled={busy || shouldSkipReport}>
          {busy ? t('common.loading', 'Loading...') : t('common.refresh', 'Refresh')}
        </button>
      </header>

      <section className={s.panel}>
        <div className={s.filtersGrid}>
          <label className={s.field}>
            <span>{t('wms.inventoryLedger.filters.productSearch', 'Product search')}</span>
            <input
              value={productSearch}
              onChange={(event) => setProductSearch(event.target.value)}
              placeholder={t('wms.inventoryLedger.filters.productSearchPlaceholder', 'Search product name or SKU...')}
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.inventoryLedger.filters.product', 'Product')}</span>
            <select value={filters.productId} onChange={(event) => updateFilter('productId', event.target.value)} required>
              <option value="">{isFetchingProducts ? t('common.loading', 'Loading...') : t('wms.inventoryLedger.filters.selectProduct', 'Select product')}</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {productLabel(product)}
                </option>
              ))}
            </select>
          </label>

          <label className={s.field}>
            <span>{t('wms.inventoryLedger.filters.variant', 'Variant')}</span>
            <select
              value={filters.variantId}
              onChange={(event) => updateFilter('variantId', event.target.value)}
              disabled={!filters.productId || variants.length === 0}
            >
              <option value="">{t('common.all', 'All')}</option>
              {variants.map((variant) => (
                <option key={variant.id} value={variant.id}>
                  {variantLabel(variant)}
                </option>
              ))}
            </select>
          </label>

          <label className={s.field}>
            <span>{t('wms.inventoryLedger.filters.dateFrom', 'Date from')}</span>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(event) => updateFilter('dateFrom', event.target.value)}
              required
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.inventoryLedger.filters.dateTo', 'Date to')}</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(event) => updateFilter('dateTo', event.target.value)}
              required
            />
          </label>

          <label className={s.field}>
            <span>{t('wms.inventoryLedger.filters.warehouse', 'Warehouse')}</span>
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
            <span>{t('wms.inventoryLedger.filters.currency', 'Currency')}</span>
            <input
              value={filters.currency}
              onChange={(event) => updateFilter('currency', event.target.value.toUpperCase().slice(0, 3))}
              placeholder="PLN"
              maxLength={3}
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
          <span>{t('wms.inventoryLedger.totals.qtyIn', 'Qty in')}</span>
          <strong>{formatQty(totals.qtyIn, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.inventoryLedger.totals.qtyOut', 'Qty out')}</span>
          <strong>{formatQty(totals.qtyOut, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.inventoryLedger.totals.valueIn', 'Value in')}</span>
          <strong>{formatMoney(totals.valueIn, totals.currency, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.inventoryLedger.totals.valueOut', 'Value out')}</span>
          <strong>{formatMoney(totals.valueOut, totals.currency, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.inventoryLedger.totals.balanceAfter', 'Balance')}</span>
          <strong>{formatQty(totals.balanceAfter, i18n.language)}</strong>
        </div>
        <div className={s.totalCard}>
          <span>{t('wms.inventoryLedger.totals.valueBalance', 'Value balance')}</span>
          <strong>{formatMoney(totals.valueBalance, totals.currency, i18n.language)}</strong>
        </div>
      </section>

      <section className={s.panel}>
        {validationErrors.length > 0 ? (
          <div className={s.error}>{validationErrors.join(' ')}</div>
        ) : null}
        {isError ? (
          <div className={s.error}>
            {getErrorText(error, t('wms.inventoryLedger.error', 'Failed to load inventory ledger.'))}
          </div>
        ) : null}

        {busy ? <div className={s.state}>{t('common.loading', 'Loading...')}</div> : null}

        {!busy && !isError && validationErrors.length === 0 && rows.length === 0 ? (
          <div className={s.state}>{t('wms.inventoryLedger.empty', 'No ledger rows for selected filters.')}</div>
        ) : null}

        {!busy && !isError && validationErrors.length === 0 && rows.length > 0 ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th>{t('wms.inventoryLedger.columns.date', 'Date')}</th>
                  <th>{t('wms.inventoryLedger.columns.documentType', 'Document type')}</th>
                  <th>{t('wms.inventoryLedger.columns.documentNumber', 'Document number')}</th>
                  <th>{t('wms.inventoryLedger.columns.warehouse', 'Warehouse')}</th>
                  <th>{t('wms.inventoryLedger.columns.location', 'Location')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.qtyIn', 'Qty in')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.qtyOut', 'Qty out')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.balanceAfter', 'Balance')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.unitCost', 'Unit cost')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.valueIn', 'Value in')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.valueOut', 'Value out')}</th>
                  <th className={s.textRight}>{t('wms.inventoryLedger.columns.valueBalance', 'Value balance')}</th>
                  <th>{t('wms.inventoryLedger.columns.currency', 'Currency')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => {
                  const documentRoute = getDocumentRoute(row);
                  return (
                    <tr key={rowKey(row, index)}>
                      <td>{formatDateTime(row.date, i18n.language)}</td>
                      <td>{row.documentType || row.refType || '—'}</td>
                      <td>
                        {documentRoute ? (
                          <Link className={s.link} to={documentRoute}>
                            {row.documentNumber || row.refId || '—'}
                          </Link>
                        ) : (
                          row.documentNumber || row.refId || '—'
                        )}
                      </td>
                      <td>{warehouseLabel(row)}</td>
                      <td>{locationLabel(row)}</td>
                      <td className={s.textRight}>{formatQty(row.qtyIn, i18n.language)}</td>
                      <td className={s.textRight}>{formatQty(row.qtyOut, i18n.language)}</td>
                      <td className={s.textRight}>{formatQty(row.balanceAfter, i18n.language)}</td>
                      <td className={s.textRight}>{formatMoney(row.unitCost, row.currency, i18n.language)}</td>
                      <td className={s.textRight}>{formatMoney(row.valueIn, row.currency, i18n.language)}</td>
                      <td className={s.textRight}>{formatMoney(row.valueOut, row.currency, i18n.language)}</td>
                      <td className={s.textRight}>{formatMoney(row.valueBalance, row.currency, i18n.language)}</td>
                      <td>{row.currency || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
