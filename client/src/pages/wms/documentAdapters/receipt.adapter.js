const { ACTIONS, DOCUMENT_KINDS, WMS_PERMISSIONS, createDocumentAdapter, invokeTrigger } = require('./adapterTypes');
const { mapAdapterError } = require('./errorMapping');
const { mapAdapterResult, mapPrintResult } = require('./resultMapping');
const {
  buildReceiptDraftHeaderPatch,
  buildReceiptDraftItemBody,
  buildReceiptDraftItemPatch,
  buildReceiptPayload,
  buildReceiveLinePayload,
  asNumber,
  round4,
} = require('./payloadBuilders');

function pickAddedItemId(raw) {
  const items = Array.isArray(raw?.items)
    ? raw.items
    : Array.isArray(raw?.data?.items)
      ? raw.data.items
      : [];
  return raw?.itemId || raw?.data?.itemId || items[items.length - 1]?.id || null;
}

async function receiveExistingDraft({ triggers, payload, input }) {
  const rows = Array.isArray(input.rows) ? input.rows : [];
  const received = [];
  for (const row of rows) {
    if (!row?.id) continue;
    const linePayload = buildReceiveLinePayload(row, input);
    if (asNumber(linePayload.qty, 0) <= 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const rowResult = await invokeTrigger(triggers.receiveReceiptLine, {
      id: payload.id,
      itemId: row.id,
      receiptId: payload.id,
      payload: linePayload,
    });
    received.push({ itemId: row.id, payload: linePayload, result: rowResult });
  }

  if (!received.length) {
    const error = new Error('No remaining rows to receive.');
    error.code = 'NO_LINES_TO_RECEIVE';
    throw error;
  }

  const latest = triggers.fetchReceiptById
    ? await invokeTrigger(triggers.fetchReceiptById, payload.id)
    : null;
  return { id: payload.id, status: latest?.status, latest, received };
}

function createReceiptAdapter({ triggers = {}, permissions } = {}) {
  const mapError = (error) => mapAdapterError(error, { fallback: 'Failed to create receipt' });

  const saveDefinition = {
    permission: WMS_PERMISSIONS.CREATE,
    buildPayload: buildReceiptPayload,
    invoke: (payload) => invokeTrigger(triggers.createReceipt, payload),
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'draft' }),
    mapError,
  };

  const receiveDefinition = {
    permission: WMS_PERMISSIONS.POST,
    buildPayload: buildReceiptPayload,
    invoke: async (payload, input) => {
      const created = await invokeTrigger(triggers.createReceipt, payload);
      const receiptId = created?.id;
      if (!receiptId) return created;

      const detail = triggers.fetchReceiptById
        ? await invokeTrigger(triggers.fetchReceiptById, receiptId)
        : created;
      const detailItems = Array.isArray(detail?.items) ? detail.items : [];
      const sourceRows = Array.isArray(input.rows) ? input.rows : [];
      const selectedFlags = sourceRows.map((row) => Boolean(row.receiveNow));
      const receiveMode = input.options?.receiveMode || 'all';
      const received = [];

      for (let index = 0; index < detailItems.length; index += 1) {
        const line = detailItems[index];
        if (receiveMode === 'selected' && !selectedFlags[index]) continue;
        const linePayload = buildReceiveLinePayload(line, input);
        if (asNumber(linePayload.qty, 0) <= 0) continue;
        // eslint-disable-next-line no-await-in-loop
        const rowResult = await invokeTrigger(triggers.receiveReceiptLine, {
          itemId: line.id,
          receiptId,
          payload: linePayload,
        });
        received.push(rowResult);
      }

      return { ...created, id: receiptId, received };
    },
    mapResult: (raw) => mapAdapterResult(raw, { status: 'received' }),
    mapError,
  };

  return createDocumentAdapter({
    kindKey: DOCUMENT_KINDS.RECEIPT,
    permissions,
    actions: {
      [ACTIONS.SAVE]: saveDefinition,
      [ACTIONS.LOAD_DRAFT]: {
        permission: WMS_PERMISSIONS.VIEW,
        buildPayload: (input) => input.id,
        invoke: (payload) => invokeTrigger(triggers.fetchReceiptById, payload),
        mapResult: (raw, input) => mapAdapterResult(raw, { documentId: input.id, status: raw?.status }),
        mapError,
      },
      [ACTIONS.UPDATE_DRAFT_HEADER]: {
        permission: WMS_PERMISSIONS.UPDATE,
        buildPayload: buildReceiptDraftHeaderPatch,
        invoke: (payload, input) => invokeTrigger(triggers.updateReceiptDraft, { id: input.id, payload }),
        mapResult: (raw, input) => mapAdapterResult(raw, { documentId: input.id, status: raw?.status }),
        mapError,
      },
      [ACTIONS.ADD_ITEM]: {
        permission: WMS_PERMISSIONS.UPDATE,
        buildPayload: buildReceiptDraftItemBody,
        invoke: (payload, input) => invokeTrigger(triggers.addReceiptDraftItem, { id: input.id, payload }),
        mapResult: (raw, input) => ({
          ...mapAdapterResult(raw, { documentId: input.id, status: raw?.status }),
          itemId: pickAddedItemId(raw),
        }),
        mapError,
      },
      [ACTIONS.UPDATE_ITEM]: {
        permission: WMS_PERMISSIONS.UPDATE,
        buildPayload: buildReceiptDraftItemPatch,
        invoke: (payload, input) => invokeTrigger(triggers.updateReceiptDraftItem, { id: input.id, itemId: input.itemId, payload }),
        mapResult: (raw, input) => mapAdapterResult(raw, { documentId: input.id, status: raw?.status }),
        mapError,
      },
      [ACTIONS.REMOVE_ITEM]: {
        permission: WMS_PERMISSIONS.UPDATE,
        buildPayload: (input) => ({ id: input.id, itemId: input.itemId }),
        invoke: (payload) => invokeTrigger(triggers.removeReceiptDraftItem, payload),
        mapResult: (raw, input) => mapAdapterResult(raw, { documentId: input.id, status: raw?.status }),
        mapError,
      },
      [ACTIONS.RECEIVE_EXISTING]: {
        permission: WMS_PERMISSIONS.POST,
        buildPayload: (input) => ({ id: input.id }),
        invoke: (payload, input) => receiveExistingDraft({ triggers, payload, input }),
        mapResult: (raw, input) => mapAdapterResult(raw.latest || raw, { documentId: input.id, status: raw.status }),
        mapError,
      },
      [ACTIONS.RECEIVE]: receiveDefinition,
      [ACTIONS.POST]: receiveDefinition,
      [ACTIONS.CORRECT]: {
        permission: WMS_PERMISSIONS.CORRECT,
        buildPayload: (input) => input.payload || input.lines || {},
        invoke: (payload, input) => invokeTrigger(triggers.createReceiptCorrection, { id: input.id, payload }),
        mapResult: (raw) => mapAdapterResult(raw, { status: 'corrected' }),
        mapError,
      },
      [ACTIONS.PRINT]: {
        permission: WMS_PERMISSIONS.VIEW,
        buildPayload: (input) => ({ kind: DOCUMENT_KINDS.RECEIPT, id: input.id }),
        invoke: (payload) => invokeTrigger(triggers.printDocument, payload),
        mapResult: mapPrintResult,
        mapError,
      },
    },
  });
}

module.exports = {
  createReceiptAdapter,
  round4,
};
