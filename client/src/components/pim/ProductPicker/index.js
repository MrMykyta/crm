import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useProductPickerQuery } from '../../../store/rtk/productsApi';
import { withApiOrigin } from '../../../config/api';
import s from './ProductPicker.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function formatQty(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '0';
  return num.toLocaleString('ru-RU', { maximumFractionDigits: 3 });
}

function formatMoney(price) {
  const value = Number(price?.value);
  if (!Number.isFinite(value)) return '—';
  return `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${price?.currency || ''}`.trim();
}

function rowKey(row) {
  return `${row?.productId || 'product'}:${row?.variantId || 'base'}`;
}

function selectedPayload(row) {
  return {
    productId: row?.productId || null,
    variantId: row?.variantId || null,
    productName: row?.productName || null,
    variantLabel: row?.variantLabel || null,
    sku: row?.variantSku || row?.sku || null,
    barcode: row?.barcode || null,
    ean: row?.ean || null,
    thumbnailUrl: row?.thumbnailUrl || null,
  };
}

export default function ProductPicker({
  value = null,
  onSelect,
  placeholder,
  limit = 20,
  warehouseId = null,
  includeInactive = false,
  disabled = false,
  autoFocus = false,
}) {
  const { t } = useTranslation();
  const rootRef = useRef(null);
  const activeRowRef = useRef(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [selected, setSelected] = useState(value);

  useEffect(() => {
    setSelected(value);
  }, [value]);

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedQuery(asText(query)), 350);
    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const onDoc = (event) => {
      if (!rootRef.current || rootRef.current.contains(event.target)) return;
      setOpen(false);
      setActiveIndex(-1);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const queryArgs = useMemo(() => ({
    q: debouncedQuery || undefined,
    limit,
    warehouseId: warehouseId || undefined,
    includeInactive: includeInactive || undefined,
  }), [debouncedQuery, includeInactive, limit, warehouseId]);

  const hasQuery = Boolean(asText(query));
  const hasDebouncedQuery = Boolean(asText(debouncedQuery));

  const {
    data,
    isLoading,
    isFetching,
    isError,
  } = useProductPickerQuery(queryArgs, {
    skip: disabled || !open || !hasDebouncedQuery,
    refetchOnMountOrArgChange: true,
  });

  const rows = useMemo(() => (
    hasDebouncedQuery && Array.isArray(data?.items) ? data.items : []
  ), [data?.items, hasDebouncedQuery]);

  useEffect(() => {
    if (!open || !rows.length) {
      setActiveIndex(-1);
      return;
    }
    setActiveIndex((idx) => {
      if (idx < 0) return 0;
      return Math.min(idx, rows.length - 1);
    });
  }, [open, rows.length]);

  useEffect(() => {
    activeRowRef.current?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex]);

  const pick = (row) => {
    const payload = selectedPayload(row);
    setSelected(payload);
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
    setActiveIndex(-1);
    onSelect?.(payload, row);
  };

  const clearSelection = () => {
    setSelected(null);
    setQuery('');
    setDebouncedQuery('');
    setOpen(false);
    setActiveIndex(-1);
    onSelect?.(null, null);
  };

  const move = (delta) => {
    if (!rows.length) return;
    setActiveIndex((idx) => {
      if (idx < 0) return delta > 0 ? 0 : rows.length - 1;
      const next = idx + delta;
      if (next < 0) return rows.length - 1;
      if (next >= rows.length) return 0;
      return next;
    });
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      move(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      move(-1);
      return;
    }
    if (event.key === 'Enter' && open && activeIndex >= 0 && rows[activeIndex]) {
      event.preventDefault();
      pick(rows[activeIndex]);
    }
  };

  const waitingForDebounce = open && hasQuery && asText(query) !== asText(debouncedQuery);
  const busy = isLoading || isFetching || waitingForDebounce;
  const selectedKey = selected ? rowKey(selected) : null;
  const selectedThumb = selected?.thumbnailUrl ? withApiOrigin(selected.thumbnailUrl) : '';
  const inputPlaceholder = placeholder || t('productPicker.placeholder');

  return (
    <div className={s.shell} ref={rootRef}>
      <input
        className={s.input}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => !disabled && setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={inputPlaceholder}
        disabled={disabled}
        autoFocus={autoFocus}
        autoComplete="off"
      />

      {selected ? (
        <div className={s.selectedCard}>
          <span className={s.selectedThumb}>
            {selectedThumb ? <img src={selectedThumb} alt={selected.productName || 'product'} /> : asText(selected.productName).slice(0, 2).toUpperCase() || 'P'}
          </span>
          <span className={s.selectedInfo}>
            <span className={s.selectedTitle}>{selected.productName || '—'}</span>
            {selected.variantLabel ? <span className={s.variantBadge}>{selected.variantLabel}</span> : null}
            <span className={s.selectedMeta}>
              {selected.sku ? <span>SKU {selected.sku}</span> : null}
              {selected.ean ? <span>EAN {selected.ean}</span> : null}
            </span>
          </span>
          <button type="button" className={s.clearButton} onClick={clearSelection}>
            {t('productPicker.clearSelection')}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className={s.panel}>
          {busy ? <div className={s.state}>{t('productPicker.searching')}</div> : null}
          {!busy && isError ? <div className={s.state}>{t('productPicker.searchFailed')}</div> : null}
          {!busy && !isError && !hasQuery ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>⌕</div>
              <strong>{t('productPicker.startTyping')}</strong>
            </div>
          ) : null}
          {!busy && !isError && hasQuery && rows.length === 0 ? (
            <div className={s.emptyState}>
              <div className={s.emptyIcon}>⌕</div>
              <strong>{t('productPicker.noProductsFound')}</strong>
              <span>{t('productPicker.noResultsHelp')}</span>
              {query ? (
                <button
                  type="button"
                  className={s.emptyAction}
                  onClick={() => {
                    setQuery('');
                    setDebouncedQuery('');
                  }}
                >
                  {t('productPicker.clearSearch')}
                </button>
              ) : null}
            </div>
          ) : null}
          {!busy && !isError && hasQuery && rows.length > 0 ? (
            <div className={s.list} role="listbox">
              {rows.map((row, index) => {
                const active = index === activeIndex;
                const isSelected = rowKey(row) === selectedKey;
                const sku = row.variantSku || row.sku || '—';
                const thumb = row.thumbnailUrl ? withApiOrigin(row.thumbnailUrl) : '';
                const variantText = row.variantLabel || (row.variantId ? row.variantSku || t('productPicker.variant') : t('productPicker.baseProduct'));
                const available = formatQty(row.stock?.available);
                return (
                  <button
                    type="button"
                    key={rowKey(row)}
                    ref={active ? activeRowRef : null}
                    className={`${s.row} ${active ? s.rowActive : ''} ${isSelected ? s.rowSelected : ''}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => pick(row)}
                    role="option"
                    aria-selected={active || isSelected}
                  >
                    <span className={s.thumb}>
                      {thumb ? <img src={thumb} alt={row.productName || 'product'} /> : asText(row.productName).slice(0, 2).toUpperCase() || 'P'}
                    </span>
                    <span className={s.nameCell}>
                      <span className={s.primary}>{row.productName || '—'}</span>
                      <span className={row.variantId ? s.variantBadge : s.secondary}>{variantText}</span>
                    </span>
                    <span className={s.idCell}>
                      <span className={s.chips}>
                        <span className={s.chip}>SKU {sku}</span>
                        {row.ean ? <span className={s.chip}>EAN {row.ean}</span> : null}
                      </span>
                      <span className={s.secondary}>{row.barcode ? `${t('productPicker.barcode')} ${row.barcode}` : t('productPicker.noBarcode')}</span>
                    </span>
                    <span className={s.metricsCell}>
                      <span className={s.stockLine}>{t('productPicker.available')}: {available}</span>
                      <span className={s.priceLine}>{formatMoney(row.purchasePrice)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
