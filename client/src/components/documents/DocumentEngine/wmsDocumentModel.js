// Adapters: map WMS documents (PZ / PZK / WZ / WZK / MM / RW / PW) into the generic
// DocumentEngine model. Pure data shaping — no UI, no mutations. Preview-only:
// the page supplies items via itemsSlot and history/relations via sections.

import { asNumber, asText } from '../LineItemsEditor/lineModel';
import {
  formatDocumentRelationLabel,
  formatLocationLabel,
  formatOrderLabel,
  formatWarehouseLabel,
} from './wmsDisplay';

function statusText(status, t) {
  const key = asText(status).toLowerCase();
  if (!key) return '—';
  return t(`statuses.${key}`, key);
}

function fmtDate(value, locale) {
  const text = asText(value);
  if (!text) return '—';
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return text;
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(parsed);
}

function qtyFmt(value, locale) {
  const n = asNumber(value, NaN);
  if (!Number.isFinite(n)) return '—';
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 4 }).format(n);
}

export function getParentDocumentId(entity) {
  return entity?.parentDocumentId || entity?.parent_document_id || null;
}

export function getCorrectedById(entity) {
  return entity?.correctedById || entity?.corrected_by_id || null;
}

function docNumber(entity) {
  return entity?.number || `#${String(entity?.id || '').slice(0, 8)}`;
}

function itemQty(item, kind) {
  if (kind === 'adjustment') return item?.qtyDelta ?? 0;
  return item?.qty ?? item?.qtyExpected ?? 0;
}

function itemProcessed(item) {
  if (item?.qtyReceived !== undefined) return item.qtyReceived;
  if (item?.movedQty !== undefined) return item.movedQty;
  return null;
}

function baseSummaryRows(entity, kind, t, locale) {
  const items = Array.isArray(entity?.items) ? entity.items : [];
  const totalQty = items.reduce((acc, it) => acc + asNumber(itemQty(it, kind), 0), 0);
  const processedQty = items.reduce((acc, it) => acc + asNumber(itemProcessed(it), 0), 0);
  return [
    { label: t('wms.summary.items', 'Items'), value: String(items.length) },
    { label: t('wms.summary.qtyTotal', 'Total qty'), value: qtyFmt(totalQty, locale) },
    { label: t('wms.summary.qtyProcessed', 'Processed qty'), value: qtyFmt(processedQty, locale), strong: true },
  ];
}

function commonHead(entity, { code, subtitle }, t, locale) {
  const number = docNumber(entity);
  const status = statusText(entity?.status, t);
  return {
    documentType: code,
    typeLabel: code,
    number,
    title: number,
    subtitle,
    statusLabel: status,
    summaryStatusLabel: status,
  };
}

// PZ / PZK — receipts. Correction (PZK) when it has a parent document.
export function mapReceiptToDocumentModel(receipt, { t, locale, lookups = {} }) {
  const isCorrection = Boolean(getParentDocumentId(receipt));
  const code = isCorrection ? 'PZK' : 'PZ';
  const relations = [];
  const parentId = getParentDocumentId(receipt);
  const correctedById = getCorrectedById(receipt);
  if (parentId) {
    relations.push({ key: 'original', label: t('wms.relations.originalDocument', 'Original document'), value: formatDocumentRelationLabel(receipt?.parentDocument || parentId), to: `/main/wms/receipts/${parentId}` });
  }
  if (correctedById) {
    relations.push({ key: 'correction', label: t('wms.relations.correctionDocument', 'Correction document'), value: formatDocumentRelationLabel(receipt?.correctedBy || correctedById), to: `/main/wms/receipts/${correctedById}` });
  }
  const warehouseLabel = formatWarehouseLabel(receipt?.warehouse || receipt?.warehouseId, lookups.warehousesById);
  return {
    ...commonHead(receipt, { code, subtitle: t('wms.receipts.detailTitle', 'Receipt details') }, t, locale),
    facts: [
      { label: t('wms.print.warehouse', 'Warehouse'), value: warehouseLabel },
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(receipt?.createdAt, locale) },
    ],
    primaryFields: [
      { label: t('oms.detailLabels.number'), value: receipt?.number || '' },
      { label: t('oms.detailLabels.status'), value: statusText(receipt?.status, t) },
      { label: t('wms.print.warehouse', 'Warehouse'), value: warehouseLabel },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(receipt?.createdAt, locale) },
      { label: t('oms.detailLabels.updatedAt'), value: fmtDate(receipt?.updatedAt, locale) },
    ],
    summaryRows: baseSummaryRows(receipt, 'receipt', t, locale),
    relations,
  };
}

// WZ / WZK — shipments. Correction (WZK) when it has a parent document.
export function mapShipmentToDocumentModel(shipment, { t, locale, lookups = {} }) {
  const isCorrection = Boolean(getParentDocumentId(shipment));
  const code = isCorrection ? 'WZK' : 'WZ';
  const relations = [];
  const parentId = getParentDocumentId(shipment);
  const correctedById = getCorrectedById(shipment);
  if (parentId) {
    relations.push({ key: 'original', label: t('wms.relations.originalDocument', 'Original document'), value: formatDocumentRelationLabel(shipment?.parentDocument || parentId), to: `/main/wms/shipments/${parentId}` });
  }
  if (correctedById) {
    relations.push({ key: 'correction', label: t('wms.relations.correctionDocument', 'Correction document'), value: formatDocumentRelationLabel(shipment?.correctedBy || correctedById), to: `/main/wms/shipments/${correctedById}` });
  }
  if (shipment?.orderId) {
    relations.push({ key: 'order', label: t('documents.types.order'), value: formatOrderLabel(shipment?.order || shipment.orderId), to: `/main/oms/orders/${shipment.orderId}` });
  }
  const warehouseLabel = formatWarehouseLabel(shipment?.warehouse || shipment?.warehouseId, lookups.warehousesById);
  return {
    ...commonHead(shipment, { code, subtitle: t('wms.shipments.detailTitle', 'Shipment details') }, t, locale),
    facts: [
      { label: t('wms.print.warehouse', 'Warehouse'), value: warehouseLabel },
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(shipment?.createdAt, locale) },
    ],
    primaryFields: [
      { label: t('oms.detailLabels.number'), value: shipment?.number || '' },
      { label: t('oms.detailLabels.status'), value: statusText(shipment?.status, t) },
      { label: t('wms.print.warehouse', 'Warehouse'), value: warehouseLabel },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(shipment?.createdAt, locale) },
      { label: t('oms.detailLabels.updatedAt'), value: fmtDate(shipment?.updatedAt, locale) },
    ],
    summaryRows: baseSummaryRows(shipment, 'shipment', t, locale),
    relations,
  };
}

// MM — transfers (no corrections).
export function mapTransferToDocumentModel(transfer, { t, locale, lookups = {} }) {
  const fromWarehouseLabel = formatWarehouseLabel(transfer?.sourceWarehouse || transfer?.fromWarehouse || transfer?.fromWarehouseId, lookups.warehousesById);
  const toWarehouseLabel = formatWarehouseLabel(transfer?.targetWarehouse || transfer?.toWarehouse || transfer?.toWarehouseId, lookups.warehousesById);
  const sourceLocationLabel = transfer?.sourceLocation || transfer?.sourceLocationId
    ? formatLocationLabel(transfer?.sourceLocation || transfer?.sourceLocationId, lookups.locationsById)
    : '—';
  const targetLocationLabel = transfer?.targetLocation || transfer?.targetLocationId
    ? formatLocationLabel(transfer?.targetLocation || transfer?.targetLocationId, lookups.locationsById)
    : '—';
  return {
    ...commonHead(transfer, { code: 'MM', subtitle: t('wms.transfers.detailTitle', 'Transfer details') }, t, locale),
    facts: [
      { label: t('wms.fields.fromWarehouse', 'From warehouse'), value: fromWarehouseLabel },
      { label: t('wms.fields.toWarehouse', 'To warehouse'), value: toWarehouseLabel },
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(transfer?.createdAt, locale) },
    ],
    primaryFields: [
      { label: t('oms.detailLabels.number'), value: transfer?.number || '' },
      { label: t('oms.detailLabels.status'), value: statusText(transfer?.status, t) },
      { label: t('wms.fields.fromWarehouse', 'From warehouse'), value: fromWarehouseLabel },
      { label: t('wms.fields.toWarehouse', 'To warehouse'), value: toWarehouseLabel },
    ],
    secondaryFields: [
      { label: t('wms.fields.fromLocation', 'From location'), value: sourceLocationLabel },
      { label: t('wms.fields.toLocation', 'To location'), value: targetLocationLabel },
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(transfer?.createdAt, locale) },
      { label: t('oms.detailLabels.updatedAt'), value: fmtDate(transfer?.updatedAt, locale) },
    ],
    summaryRows: baseSummaryRows(transfer, 'transfer', t, locale),
    relations: [],
  };
}

// RW / PW — adjustments. Code from documentType, else from net qtyDelta sign.
export function mapAdjustmentToDocumentModel(adjustment, { t, locale, lookups = {} }) {
  let code = asText(adjustment?.documentType).toUpperCase();
  if (code !== 'RW' && code !== 'PW') {
    const net = (Array.isArray(adjustment?.items) ? adjustment.items : [])
      .reduce((acc, it) => acc + asNumber(it?.qtyDelta, 0), 0);
    code = net < 0 ? 'RW' : 'PW';
  }
  const warehouseLabel = formatWarehouseLabel(adjustment?.warehouse || adjustment?.warehouseId, lookups.warehousesById);
  return {
    ...commonHead(adjustment, { code, subtitle: t('wms.adjustments.detailTitle', 'Adjustment details') }, t, locale),
    facts: [
      { label: t('wms.adjustments.filters.documentType', 'Type'), value: code },
      { label: t('wms.print.warehouse', 'Warehouse'), value: warehouseLabel },
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(adjustment?.createdAt, locale) },
    ],
    primaryFields: [
      { label: t('oms.detailLabels.number'), value: adjustment?.number || '' },
      { label: t('wms.adjustments.filters.documentType', 'Type'), value: code },
      { label: t('oms.detailLabels.status'), value: statusText(adjustment?.status, t) },
      { label: t('wms.print.warehouse', 'Warehouse'), value: warehouseLabel },
      { label: t('wms.fields.reason', 'Reason'), value: asText(adjustment?.reason) },
    ],
    secondaryFields: [
      { label: t('oms.detailLabels.createdAt'), value: fmtDate(adjustment?.createdAt, locale) },
      { label: t('wms.fields.postedAt', 'Posted at'), value: fmtDate(adjustment?.postedAt, locale) },
    ],
    summaryRows: baseSummaryRows(adjustment, 'adjustment', t, locale),
    relations: [],
  };
}

export const WMS_DOCUMENT_ADAPTERS = {
  receipt: mapReceiptToDocumentModel,
  shipment: mapShipmentToDocumentModel,
  transfer: mapTransferToDocumentModel,
  adjustment: mapAdjustmentToDocumentModel,
};
