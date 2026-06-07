// Adapters: map OMS order/offer/invoice DTOs into the generic DocumentEngine model.
// Pure data shaping — no UI, no mutations. Pages add actions / sections / navigation
// and (for editable docs) override fields/itemsSlot/totals with live edit state.

import { asNumber, asText, calculateLine, toEditorItem } from '../LineItemsEditor/lineModel';
import { isInventoryLine } from '../../oms/lineItemSemantics';
import { stripHtml } from '../../../lib/format';

function statusText(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function counterpartyName(cp) {
  return cp?.name || cp?.shortName || cp?.fullName || '';
}

// Build read-only visual line rows with computed net/vat/gross, preserving A4 badges.
function buildItems(rawItems, t, locale) {
  const list = Array.isArray(rawItems) ? rawItems : [];
  return list.map((raw, index) => {
    const item = toEditorItem(raw);
    const line = calculateLine(item);
    const lineType = item.lineType || (item.productId ? 'product' : 'custom');
    return {
      key: item.id || item.localId || `${index}`,
      name: item.name || '—',
      lineTypeLabel: t(`oms.lineTypes.${lineType}`, lineType),
      lineTypeTone: lineType === 'product' ? 'info' : 'neutral',
      affectsStock: isInventoryLine(item),
      qty: new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(asNumber(item.qty, 0)),
      unit: item.unitSnapshot || '',
      priceNet: asNumber(item.priceNet, 0),
      vatRate: asNumber(item.taxRate, 0),
      sumNet: line.lineNet,
      sumVat: line.lineVat,
      sumGross: line.lineGross,
    };
  });
}

function totalsModel(net, vat, gross, t) {
  return {
    netLabel: t('oms.summaryLabels.net'),
    vatLabel: t('oms.summaryLabels.vat'),
    grossLabel: t('oms.summaryLabels.gross'),
    net,
    vat,
    gross,
  };
}

export function mapOrderToDocumentModel(order, { t, locale }) {
  const cp = order?.counterparty || order?.customer;
  const name = counterpartyName(cp);
  const currency = order?.currencyCode || 'PLN';
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(locale) : '—');
  return {
    typeLabel: t('documents.types.order'),
    title: order?.number || `#${String(order?.id || '').slice(0, 8)}`,
    subtitle: t('oms.orders.detailTitle'),
    statusLabel: statusText(order?.status, t),
    summaryStatusLabel: statusText(order?.status, t),
    number: order?.number || `#${String(order?.id || '').slice(0, 8)}`,
    facts: [
      { label: t('oms.detailLabels.placedAt'), value: fmtDate(order?.placedAt) },
      { label: t('oms.detailLabels.counterparty'), value: name || '—' },
      { label: t('oms.summaryLabels.currency'), value: currency },
    ],
    paramsTitle: t('documents.editor.header'),
    primaryFields: [
      { label: t('oms.detailLabels.counterparty'), value: name },
      { label: t('oms.detailLabels.contact'), value: order?.contact?.name || order?.contact?.email || '' },
      { label: t('oms.detailLabels.owner'), value: order?.owner?.name || order?.owner?.email || '' },
      { label: t('oms.detailLabels.notes'), value: stripHtml(order?.notes) },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.paymentStatus'), value: statusText(order?.paymentStatus, t) },
      { label: t('oms.detailLabels.fulfillmentStatus'), value: statusText(order?.fulfillmentStatus, t) },
      { label: t('oms.detailLabels.placedAt'), value: fmtDate(order?.placedAt) },
      { label: t('oms.summaryLabels.currency'), value: currency },
      { label: t('oms.detailLabels.paymentTerms'), value: order?.paymentTerms || '' },
      { label: t('oms.detailLabels.deliveryTerms'), value: order?.deliveryTerms || '' },
      { label: t('oms.detailLabels.leadTime'), value: order?.leadTime || '' },
    ],
    items: buildItems(order?.items, t, locale),
    totals: totalsModel(order?.totalNet, order?.totalTax, order?.totalGross, t),
  };
}

export function mapOfferToDocumentModel(offer, { t, locale }) {
  const cp = offer?.counterparty;
  const name = counterpartyName(cp);
  const currency = offer?.currency || offer?.currencyCode || 'PLN';
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(locale) : '—');
  return {
    typeLabel: t('documents.types.offer'),
    title: offer?.number || `#${String(offer?.id || '').slice(0, 8)}`,
    subtitle: t('oms.offers.detailTitle'),
    statusLabel: statusText(offer?.status, t),
    summaryStatusLabel: statusText(offer?.status, t),
    number: offer?.number || `#${String(offer?.id || '').slice(0, 8)}`,
    facts: [
      { label: t('oms.detailLabels.issueDate'), value: fmtDate(offer?.issueDate) },
      { label: t('oms.detailLabels.validUntil'), value: fmtDate(offer?.validUntil) },
      { label: t('oms.detailLabels.counterparty'), value: name || '—' },
    ],
    paramsTitle: t('documents.editor.header'),
    primaryFields: [
      { label: t('oms.detailLabels.counterparty'), value: name },
      { label: t('oms.detailLabels.contact'), value: offer?.contact?.name || offer?.contact?.email || '' },
      { label: t('oms.detailLabels.owner'), value: offer?.owner?.name || offer?.owner?.email || '' },
      { label: t('oms.detailLabels.deal'), value: offer?.deal?.title || offer?.dealId || '' },
      { label: t('oms.detailLabels.notes'), value: stripHtml(offer?.notes) },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.issueDate'), value: fmtDate(offer?.issueDate) },
      { label: t('oms.detailLabels.validUntil'), value: fmtDate(offer?.validUntil) },
      { label: t('oms.summaryLabels.currency'), value: currency },
      { label: t('oms.detailLabels.paymentTerms'), value: offer?.paymentTerms || '' },
      { label: t('oms.detailLabels.deliveryTerms'), value: offer?.deliveryTerms || '' },
      { label: t('oms.detailLabels.leadTime'), value: offer?.leadTime || '' },
    ],
    items: buildItems(offer?.items, t, locale),
    totals: totalsModel(offer?.subtotalNet ?? offer?.totalNet, offer?.totalVat ?? offer?.totalTax, offer?.totalGross, t),
  };
}

export function mapInvoiceToDocumentModel(invoice, { t, locale }) {
  const cp = invoice?.counterparty || invoice?.order?.counterparty;
  const name = counterpartyName(cp) || '—';
  const currency = invoice?.currencyCode || 'PLN';
  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString(locale) : '—');
  return {
    typeLabel: t('documents.types.invoice'),
    title: invoice?.number || `#${String(invoice?.id || '').slice(0, 8)}`,
    subtitle: t('oms.invoices.detailTitle'),
    statusLabel: statusText(invoice?.status, t),
    summaryStatusLabel: statusText(invoice?.status, t),
    number: invoice?.number || `#${String(invoice?.id || '').slice(0, 8)}`,
    facts: [
      { label: t('oms.detailLabels.counterparty'), value: name },
      { label: t('oms.detailLabels.issueDate'), value: fmtDate(invoice?.issueDate) },
      { label: t('oms.detailLabels.dueDate'), value: fmtDate(invoice?.dueDate) },
    ],
    paramsTitle: t('documents.editor.header'),
    primaryFields: [
      { label: t('oms.detailLabels.counterparty'), value: name },
      { label: t('oms.detailLabels.status'), value: statusText(invoice?.status, t) },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.issueDate'), value: fmtDate(invoice?.issueDate) },
      { label: t('oms.detailLabels.dueDate'), value: fmtDate(invoice?.dueDate) },
      { label: t('oms.summaryLabels.currency'), value: currency },
    ],
    items: buildItems(invoice?.items, t, locale),
    totals: totalsModel(invoice?.totalNet, invoice?.totalTax, invoice?.totalGross, t),
  };
}
