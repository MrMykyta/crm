import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '../Modal';
import { SearchField } from '../ui/fields';
import { useListProductsQuery } from '../../store/rtk/productsApi';
import {
  getAvailabilitySnapshot,
  getProductInventoryKind,
  getProductInventoryLabel,
} from './lineItemSemantics';
import s from './OmsProductPicker.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, locale) {
  return new Intl.NumberFormat(locale || undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value, 0));
}

export default function OmsProductPicker({
  open = false,
  onClose,
  onSelect,
  title = 'Add product',
  variant = 'modal',
}) {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const isInline = variant === 'inline';
  const isActive = isInline || open;

  useEffect(() => {
    if (!isActive) {
      setSearch('');
      setDebouncedSearch('');
      return;
    }
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(asText(search));
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [isActive, search]);

  const queryArgs = useMemo(() => ({
    page: 1,
    limit: 30,
    sort: 'updatedAt',
    dir: 'DESC',
    q: debouncedSearch || undefined,
  }), [debouncedSearch]);

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useListProductsQuery(queryArgs, {
    skip: !isActive,
    refetchOnMountOrArgChange: true,
  });

  const products = Array.isArray(data?.items) ? data.items : [];

  const content = (
    <div className={`${s.shell} ${isInline ? s.inlineShell : ''}`}>
      {isInline ? (
        <div className={s.inlineHeader}>
          <div>
            <div className={s.inlineTitle}>{title}</div>
            <div className={s.inlineSubtitle}>
              {t('oms.productPicker.inlineHint', 'Search products and add them without leaving the item list.')}
            </div>
          </div>
          <button type="button" className={s.inlineCloseButton} onClick={onClose}>
            {t('common.close', 'Close')}
          </button>
        </div>
      ) : null}

      <div className={s.searchRow}>
        <SearchField
          inputClassName={s.searchInput}
          value={search}
          onValueChange={setSearch}
          placeholder={t('oms.productPicker.searchPlaceholder', 'Search by product name, SKU, or barcode')}
        />
      </div>

      <div className={s.listWrap}>
        <table className={s.table}>
          <thead>
            <tr>
              <th>{t('oms.productPicker.columns.product', 'Product')}</th>
              <th>{t('oms.productPicker.columns.sku', 'SKU')}</th>
              <th>{t('oms.productPicker.columns.kind', 'Kind')}</th>
              <th>{t('oms.productPicker.columns.available', 'Available')}</th>
              <th>{t('oms.productPicker.columns.netPrice', 'Net price')}</th>
              <th>{t('oms.productPicker.columns.tax', 'VAT')}</th>
              <th>{t('oms.productPicker.columns.unit', 'Unit')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {products.map((product) => {
              const vatRate = asNumber(product?.taxCategory?.rate ?? product?.vatRate ?? product?.taxRate, 0);
              const netPrice = asNumber(product?.price ?? product?.netPrice ?? product?.salePrice, 0);
              const unit = asText(
                product?.uom?.symbol
                || product?.uom?.code
                || product?.uom?.name
                || product?.unit
              );
              const inventoryKind = getProductInventoryKind(product);
              const inventoryLabel = getProductInventoryLabel(product, t);
              const availability = getAvailabilitySnapshot(product);

              return (
                <tr key={product.id}>
                  <td>
                    <div className={s.name}>{product.name || t('oms.productPicker.unnamedProduct', 'Unnamed product')}</div>
                    <div className={s.nameMeta}>
                      {inventoryKind === 'stock' ? t('oms.productPicker.trackedInventory', 'Tracked inventory product') : inventoryLabel}
                    </div>
                  </td>
                  <td>{product.sku || '—'}</td>
                  <td>
                    <span className={`${s.badge} ${s[`badge${inventoryKind}`] || ''}`}>
                      {inventoryLabel}
                    </span>
                  </td>
                  <td>
                    {inventoryKind === 'stock' ? formatNumber(availability.availableQuantity, i18n.language) : '—'}
                  </td>
                  <td>{formatNumber(netPrice, i18n.language)}</td>
                  <td>{formatNumber(vatRate, i18n.language)}</td>
                  <td>{unit || '—'}</td>
                  <td className={s.actionCell}>
                    <button
                      type="button"
                      className={s.pickButton}
                      onClick={() => onSelect?.(product)}
                    >
                      {t('oms.productPicker.addItem', 'Add item')}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {(isLoading || isFetching) ? (
          <div className={s.state}>{t('oms.productPicker.loading', 'Loading products...')}</div>
        ) : null}

        {!isLoading && !isFetching && !products.length ? (
          <div className={s.state}>{t('oms.productPicker.empty', 'No products match the current search.')}</div>
        ) : null}

        {isError ? (
          <div className={s.error}>
            {error?.data?.message || error?.error || t('oms.productPicker.loadFailed', 'Failed to load products')}
          </div>
        ) : null}
      </div>
    </div>
  );

  if (isInline) return content;

  const footer = (
    <Modal.Button onClick={onClose}>{t('common.close', 'Close')}</Modal.Button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={footer}
    >
      {content}
    </Modal>
  );
}
