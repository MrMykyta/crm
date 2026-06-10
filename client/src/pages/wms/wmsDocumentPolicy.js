function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function getParentDocumentId(document) {
  return document?.parentDocumentId || document?.parent_document_id || null;
}

function getCorrectedById(document) {
  return document?.correctedById || document?.corrected_by_id || null;
}

function getTransferLocationIds(document) {
  return {
    fromLocationId: asText(document?.fromLocationId || document?.sourceLocationId),
    toLocationId: asText(document?.toLocationId || document?.targetLocationId),
  };
}

export function getWmsDocumentPolicy({ kind, document }) {
  const status = asText(document?.status).toLowerCase();
  const isCorrection = Boolean(getParentDocumentId(document));
  const correctedById = getCorrectedById(document);
  const disabledModes = ['edit', 'split'];
  const base = {
    documentType: '',
    isCorrection,
    isEditable: false,
    isReadonly: true,
    disabledModes,
    defaultMode: 'preview',
    canReceive: false,
    canCreateCorrection: false,
    canExecute: false,
    canPost: false,
    canPrint: true,
    lockedReason: '',
  };

  if (kind === 'receipt') {
    const documentType = isCorrection ? 'PZK' : 'PZ';
    return {
      ...base,
      documentType,
      canReceive: !isCorrection && status === 'draft',
      canCreateCorrection: !isCorrection && !correctedById && ['received', 'putaway'].includes(status),
    };
  }

  if (kind === 'shipment') {
    const documentType = isCorrection ? 'WZK' : 'WZ';
    return {
      ...base,
      documentType,
      canCreateCorrection: !isCorrection && !correctedById && status === 'shipped',
    };
  }

  if (kind === 'transfer') {
    const { fromLocationId, toLocationId } = getTransferLocationIds(document);
    const executionStatus = ['draft', 'in_transit'].includes(status);
    const hasExecutionLocations = Boolean(fromLocationId && toLocationId);
    return {
      ...base,
      documentType: 'MM',
      canExecute: executionStatus && hasExecutionLocations,
      lockedReason: executionStatus && !hasExecutionLocations ? 'executionRequiresLocations' : '',
    };
  }

  if (kind === 'adjustment') {
    const documentType = asText(document?.documentType).toUpperCase() || 'PW';
    return {
      ...base,
      documentType,
      canPost: status === 'draft',
    };
  }

  return base;
}
