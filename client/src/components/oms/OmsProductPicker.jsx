import { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import { useListProductsQuery } from '../../store/rtk/productsApi';
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

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(asNumber(value, 0));
}

export default function OmsProductPicker({
  open = false,
  onClose,
  onSelect,
  title = 'Add product',
}) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setDebouncedSearch('');
      return;
    }
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(asText(search));
    }, 250);
    return () => clearTimeout(timeoutId);
  }, [open, search]);

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
    skip: !open,
    refetchOnMountOrArgChange: true,
  });

  const products = Array.isArray(data?.items) ? data.items : [];

  const footer = (
    <Modal.Button onClick={onClose}>Close</Modal.Button>
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="xl"
      footer={footer}
    >
      <div className={s.shell}>
        <div className={s.searchRow}>
          <input
            className={s.searchInput}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name or SKU"
          />
        </div>

        <div className={s.listWrap}>
          <table className={s.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>SKU</th>
                <th>Net price</th>
                <th>VAT %</th>
                <th>Unit</th>
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

                return (
                  <tr key={product.id}>
                    <td>
                      <div className={s.name}>{product.name || '—'}</div>
                    </td>
                    <td>{product.sku || '—'}</td>
                    <td>{formatNumber(netPrice)}</td>
                    <td>{formatNumber(vatRate)}</td>
                    <td>{unit || '—'}</td>
                    <td className={s.actionCell}>
                      <button
                        type="button"
                        className={s.pickButton}
                        onClick={() => onSelect?.(product)}
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(isLoading || isFetching) ? (
            <div className={s.state}>Loading products…</div>
          ) : null}

          {!isLoading && !isFetching && !products.length ? (
            <div className={s.state}>No products found.</div>
          ) : null}

          {isError ? (
            <div className={s.error}>
              {error?.data?.message || error?.error || 'Failed to load products'}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
