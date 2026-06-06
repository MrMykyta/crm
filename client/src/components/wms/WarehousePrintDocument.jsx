import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import s from './WarehousePrintDocument.module.css';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function asNumber(value, fallback = 0) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value, locale = 'en') {
  const text = asText(value);
  if (!text) return '—';
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function formatQty(value, locale = 'en') {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(asNumber(value, 0));
}

function displayWarehouse(header) {
  if (header?.kind === 'transfer') {
    const from = header?.fromWarehouse?.label || header?.fromWarehouseId || '—';
    const to = header?.toWarehouse?.label || header?.toWarehouseId || '—';
    return `${from} -> ${to}`;
  }
  return header?.warehouse?.label || header?.warehouseId || '—';
}

function displayProduct(item) {
  return item?.product?.label || item?.productId || '—';
}

function displayLocation(item) {
  return item?.location?.label || item?.locationId || '—';
}

function displayLotSerial(item) {
  return [
    item?.lotNumber || item?.lotId,
    item?.serialNumber || item?.serialId,
  ].filter(Boolean).join(' / ') || '—';
}

export default function WarehousePrintDocument({ document }) {
  const { t, i18n } = useTranslation();
  const header = document?.header || {};
  const items = useMemo(
    () => (Array.isArray(document?.items) ? document.items : []),
    [document?.items]
  );
  const totals = document?.totals || {};

  const showProcessed = useMemo(
    () => items.some((item) => item?.processedQty !== null && item?.processedQty !== undefined),
    [items]
  );
  const showPlanned = useMemo(
    () => items.some((item) => item?.plannedQty !== null && item?.plannedQty !== undefined),
    [items]
  );

  return (
    <article className={s.sheet} data-print-area="warehouse-print">
      <header className={s.header}>
        <div>
          <div className={s.documentType}>{header.documentType || header.title || 'WMS'}</div>
          <h1 className={s.title}>{header.number || `#${asText(header.id).slice(0, 8)}`}</h1>
        </div>
        <div className={s.metaBox}>
          <div className={s.metaRow}>
            <span>{t('wms.print.date', 'Date')}</span>
            <strong>{formatDate(header.issueDate || header.createdAt, i18n.language)}</strong>
          </div>
          <div className={s.metaRow}>
            <span>{t('wms.print.status', 'Status')}</span>
            <strong>{t(`statuses.${asText(header.status).toLowerCase()}`, header.status || '—')}</strong>
          </div>
        </div>
      </header>

      <section className={s.parties}>
        <div className={s.infoBlock}>
          <div className={s.blockLabel}>{t('wms.print.warehouse', 'Warehouse')}</div>
          <div className={s.blockValue}>{displayWarehouse(header)}</div>
        </div>
        <div className={s.infoBlock}>
          <div className={s.blockLabel}>{t('wms.print.document', 'Document')}</div>
          <div className={s.blockValue}>
            {header.documentType || '—'}
            {header.reason ? <span className={s.muted}>{header.reason}</span> : null}
            {header.orderId ? <span className={s.muted}>{t('wms.summary.order', 'Order')}: {header.orderId}</span> : null}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>{t('wms.tabs.items', 'Items')}</h2>
        <table className={s.table}>
          <thead>
            <tr>
              <th className={s.indexCol}>#</th>
              <th>{t('wms.columns.product', 'Product')}</th>
              <th>{t('wms.columns.variant', 'Variant')}</th>
              <th>{t('wms.print.location', 'Location')}</th>
              <th>{t('wms.print.lotSerial', 'Lot / serial')}</th>
              {showPlanned ? <th className={s.num}>{t('wms.print.plannedQty', 'Planned')}</th> : null}
              {showProcessed ? <th className={s.num}>{t('wms.print.processedQty', 'Processed')}</th> : null}
              <th className={s.num}>{t('wms.columns.qty', 'Qty')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || `${item.productId || 'item'}-${index}`}>
                <td className={s.indexCol}>{index + 1}</td>
                <td>{displayProduct(item)}</td>
                <td>{item?.variant?.label || item?.variantId || '—'}</td>
                <td>{displayLocation(item)}</td>
                <td>{displayLotSerial(item)}</td>
                {showPlanned ? <td className={s.num}>{item.plannedQty === null ? '—' : formatQty(item.plannedQty, i18n.language)}</td> : null}
                {showProcessed ? <td className={s.num}>{item.processedQty === null ? '—' : formatQty(item.processedQty, i18n.language)}</td> : null}
                <td className={s.num}>{formatQty(item.qty, i18n.language)}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={showPlanned && showProcessed ? 8 : showPlanned || showProcessed ? 7 : 6} className={s.empty}>
                  {t('wms.items.empty', 'No items')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className={s.summary}>
        <div>
          <span>{t('wms.summary.items', 'Items')}</span>
          <strong>{totals.itemsCount ?? items.length}</strong>
        </div>
        <div>
          <span>{t('wms.summary.qtyTotal', 'Total qty')}</span>
          <strong>{formatQty(totals.qtyTotal, i18n.language)}</strong>
        </div>
      </section>

      <footer className={s.signatures}>
        <div className={s.signatureBox}>
          <span>{t('wms.print.issuedBy', 'Issued by')}</span>
        </div>
        <div className={s.signatureBox}>
          <span>{t('wms.print.receivedBy', 'Received by')}</span>
        </div>
      </footer>
    </article>
  );
}
