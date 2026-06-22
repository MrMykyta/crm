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

function hasValue(value) {
  return Boolean(asText(value));
}

function firstText(...values) {
  return values.map(asText).find(Boolean) || '';
}

function displayWarehouse(header) {
  if (header?.kind === 'transfer') {
    const from = header?.fromWarehouse?.label || header?.fromWarehouseId || '';
    const to = header?.toWarehouse?.label || header?.toWarehouseId || '';
    return `${from} -> ${to}`;
  }
  return header?.warehouse?.label || header?.warehouseId || '';
}

function displayProduct(item) {
  return item?.product?.label || item?.product?.name || item?.productName || item?.nameSnapshot || item?.productId || '';
}

function displaySku(item) {
  return firstText(item?.sku, item?.variantSku, item?.product?.sku, item?.variant?.sku);
}

function displayVariant(item) {
  return firstText(item?.variant?.label, item?.variant?.name, item?.variantId);
}

function displayLocation(item) {
  return firstText(item?.location?.label, item?.location?.code, item?.location?.name, item?.locationId);
}

function displayLotSerial(item) {
  return [
    item?.lotNumber || item?.lotId,
    item?.serialNumber || item?.serialId,
  ].filter(Boolean).join(' / ');
}

function displayCounterparty(header) {
  return firstText(
    header?.supplier?.label,
    header?.supplier?.name,
    header?.counterparty?.label,
    header?.counterparty?.name,
    header?.counterpartyName,
    header?.supplierName,
    header?.counterpartyId
  );
}

function displayLocationHeader(header) {
  return firstText(
    header?.location?.label,
    header?.location?.code,
    header?.location?.name,
    header?.inboundLocation?.label,
    header?.inboundLocation?.code,
    header?.inboundLocation?.name,
    header?.locationId,
    header?.inboundLocationId
  );
}

function displayCompanyLine(company = {}) {
  return [
    firstText(company?.address, company?.street),
    firstText(company?.postalCode, company?.zipCode),
    firstText(company?.city),
    firstText(company?.country),
  ].filter(Boolean).join(', ');
}

function getCompany(document = {}, header = {}) {
  return document.company || header.company || document.companySnapshot || {};
}

function getCreatedBy(header = {}) {
  const user = header.createdBy || header.issuedBy || {};
  if (typeof user === 'string') return user;
  return firstText(user.label, user.name, [user.firstName, user.lastName].filter(Boolean).join(' '), header.createdByName);
}

function getDocumentTypeLabel(header = {}, t) {
  const type = firstText(header.documentType, header.title, header.kind, 'WMS');
  if (type === 'PZ' || header.kind === 'receipt') {
    return t('wms.print.pzDocumentType', 'PZ / Przyjęcie / Приёмка');
  }
  return type;
}

function getStatusLabel(status = '', t) {
  const value = asText(status);
  return value ? t(`statuses.${value.toLowerCase()}`, value) : '';
}

function getQtyValue(item = {}) {
  return item.qty ?? item.quantity ?? item.plannedQty ?? item.processedQty;
}

export default function WarehousePrintDocument({ document }) {
  const { t, i18n } = useTranslation();
  const header = document?.header || {};
  const items = useMemo(
    () => (Array.isArray(document?.items) ? document.items : []),
    [document?.items]
  );
  const totals = document?.totals || {};
  const company = getCompany(document, header);
  const isPz = header.kind === 'receipt'
    || document?.kind === 'receipt'
    || asText(header.documentType).toUpperCase() === 'PZ';
  const documentNumber = header.number || `#${asText(header.id).slice(0, 8)}`;
  const companyName = firstText(company.name, company.legalName, company.companyName);
  const companyAddress = displayCompanyLine(company);
  const companyTaxId = firstText(company.nip, company.taxId, company.vatId);
  const hasCompany = Boolean(companyName || companyAddress || companyTaxId);
  const supplier = displayCounterparty(header);
  const sourceRef = firstText(header.sourceRef, header.orderId, header.sourceDocumentNumber);
  const createdBy = getCreatedBy(header);
  const locationLabel = displayLocationHeader(header);

  const showProcessed = useMemo(
    () => items.some((item) => item?.processedQty !== null && item?.processedQty !== undefined),
    [items]
  );
  const showPlanned = useMemo(
    () => items.some((item) => item?.plannedQty !== null && item?.plannedQty !== undefined),
    [items]
  );
  const showSku = isPz || items.some((item) => hasValue(displaySku(item)));
  const showVariant = items.some((item) => hasValue(displayVariant(item)));
  const showLocation = items.some((item) => hasValue(displayLocation(item)));
  const showLotSerial = items.some((item) => hasValue(displayLotSerial(item)));
  const expectedTotal = items.reduce((acc, item) => acc + asNumber(item.plannedQty, 0), 0);
  const receivedTotal = items.reduce((acc, item) => acc + asNumber(item.processedQty, 0), 0);
  const qtyTotal = totals.qtyTotal ?? items.reduce((acc, item) => acc + asNumber(getQtyValue(item), 0), 0);
  const visibleColumnCount = [
    true,
    true,
    showSku,
    showVariant,
    showLocation,
    showLotSerial,
    showPlanned,
    showProcessed,
    true,
  ].filter(Boolean).length;

  return (
    <article className={`${s.sheet} ${isPz ? s.pzSheet : ''}`} data-print-area="warehouse-print">
      <header className={`${s.header} ${hasCompany ? '' : s.headerNoBrand}`}>
        {hasCompany ? (
          <div className={s.brandBlock}>
            {companyName ? <strong className={s.companyName}>{companyName}</strong> : null}
            {companyAddress ? <span>{companyAddress}</span> : null}
            {companyTaxId ? <span>{t('wms.print.taxId', 'Tax ID')}: {companyTaxId}</span> : null}
          </div>
        ) : null}
        <div className={s.documentIdentity}>
          <div className={s.documentType}>{getDocumentTypeLabel(header, t)}</div>
          <h1 className={s.title}>{documentNumber}</h1>
          {getStatusLabel(header.status, t) ? <span className={s.statusPill}>{getStatusLabel(header.status, t)}</span> : null}
        </div>
        <div className={s.metaBox}>
          <div className={s.metaRow}>
            <span>{t('wms.print.date', 'Date')}</span>
            <strong>{formatDate(header.issueDate || header.createdAt, i18n.language)}</strong>
          </div>
          {displayWarehouse(header) ? (
            <div className={s.metaRow}>
              <span>{t('wms.print.warehouse', 'Warehouse')}</span>
              <strong>{displayWarehouse(header)}</strong>
            </div>
          ) : null}
          {locationLabel ? (
            <div className={s.metaRow}>
              <span>{t('wms.print.location', 'Location')}</span>
              <strong>{locationLabel}</strong>
            </div>
          ) : null}
        </div>
      </header>

      <section className={s.parties}>
        {supplier ? (
          <div className={s.infoBlock}>
            <div className={s.blockLabel}>{t('wms.fields.supplier', 'Supplier')}</div>
            <div className={s.blockValue}>{supplier}</div>
          </div>
        ) : null}
        <div className={s.infoBlock}>
          <div className={s.blockLabel}>{t('wms.print.document', 'Document')}</div>
          <div className={s.blockValue}>
            {getDocumentTypeLabel(header, t)}
            {header.reason ? <span className={s.muted}>{header.reason}</span> : null}
            {sourceRef ? <span className={s.muted}>{t('wms.summary.order', 'Order')}: {sourceRef}</span> : null}
            {createdBy ? <span className={s.muted}>{t('wms.print.createdBy', 'Created by')}: {createdBy}</span> : null}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <h2 className={s.sectionTitle}>{t('wms.tabs.items', 'Items')}</h2>
        <table className={s.table}>
          <colgroup>
            <col className={s.colIndex} />
            <col className={s.colProduct} />
            {showSku ? <col className={s.colSku} /> : null}
            {showVariant ? <col className={s.colVariant} /> : null}
            {showLocation ? <col className={s.colLocation} /> : null}
            {showLotSerial ? <col className={s.colLot} /> : null}
            {showPlanned ? <col className={s.colQty} /> : null}
            {showProcessed ? <col className={s.colQty} /> : null}
            <col className={s.colQty} />
          </colgroup>
          <thead>
            <tr>
              <th className={s.indexCol}>#</th>
              <th>{t('wms.columns.product', 'Product')}</th>
              {showSku ? <th>{t('wms.columns.sku', 'SKU')}</th> : null}
              {showVariant ? <th>{t('wms.columns.variant', 'Variant')}</th> : null}
              {showLocation ? <th>{t('wms.print.location', 'Location')}</th> : null}
              {showLotSerial ? <th>{t('wms.print.lotSerial', 'Lot / serial')}</th> : null}
              {showPlanned ? <th className={s.num}>{isPz ? t('wms.shell.posted.expected', 'Expected') : t('wms.print.plannedQty', 'Planned')}</th> : null}
              {showProcessed ? <th className={s.num}>{isPz ? t('wms.shell.posted.received', 'Received') : t('wms.print.processedQty', 'Processed')}</th> : null}
              <th className={s.num}>{t('wms.columns.qty', 'Qty')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, index) => (
              <tr key={item.id || `${item.productId || 'item'}-${index}`}>
                <td className={s.indexCol}>{index + 1}</td>
                <td>
                  <strong className={s.productName}>{displayProduct(item) || t('wms.shell.product.unnamed', 'Product')}</strong>
                </td>
                {showSku ? <td className={s.codeText}>{displaySku(item)}</td> : null}
                {showVariant ? <td>{displayVariant(item)}</td> : null}
                {showLocation ? <td>{displayLocation(item)}</td> : null}
                {showLotSerial ? <td>{displayLotSerial(item)}</td> : null}
                {showPlanned ? <td className={s.num}>{item.plannedQty === null ? '' : formatQty(item.plannedQty, i18n.language)}</td> : null}
                {showProcessed ? <td className={s.num}>{item.processedQty === null ? '' : formatQty(item.processedQty, i18n.language)}</td> : null}
                <td className={s.num}>{formatQty(getQtyValue(item), i18n.language)}</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={visibleColumnCount} className={s.empty}>
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
        {showPlanned ? (
          <div>
            <span>{isPz ? t('wms.shell.posted.expected', 'Expected') : t('wms.print.plannedQty', 'Planned')}</span>
            <strong>{formatQty(totals.plannedQtyTotal ?? expectedTotal, i18n.language)}</strong>
          </div>
        ) : null}
        {showProcessed ? (
          <div>
            <span>{isPz ? t('wms.shell.posted.received', 'Received') : t('wms.print.processedQty', 'Processed')}</span>
            <strong>{formatQty(totals.processedQtyTotal ?? receivedTotal, i18n.language)}</strong>
          </div>
        ) : null}
        <div>
          <span>{t('wms.summary.qtyTotal', 'Total qty')}</span>
          <strong>{formatQty(qtyTotal, i18n.language)}</strong>
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
