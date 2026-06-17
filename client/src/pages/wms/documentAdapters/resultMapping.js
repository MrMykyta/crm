function pickDocumentId(raw) {
  if (!raw) return undefined;
  if (typeof raw === 'string') return raw;
  return raw.id
    || raw.documentId
    || raw.receiptId
    || raw.shipmentId
    || raw.transferId
    || raw.adjustmentId
    || raw.cycleCountId
    || raw.data?.id;
}

function pickStatus(raw, fallback) {
  return raw?.status || raw?.data?.status || fallback;
}

function mapAdapterResult(raw, { status, documentId } = {}) {
  return {
    ok: true,
    documentId: documentId || pickDocumentId(raw),
    status: pickStatus(raw, status),
    warnings: [],
    errors: [],
    raw,
  };
}

function mapPrintResult(raw, input = {}) {
  return {
    ok: true,
    documentId: input.id,
    status: undefined,
    warnings: [],
    errors: [],
    raw,
  };
}

const resultMapping = {
  mapAdapterResult,
  mapPrintResult,
  pickDocumentId,
  pickStatus,
};

export {
  mapAdapterResult,
  mapPrintResult,
  pickDocumentId,
  pickStatus,
};

export default resultMapping;
