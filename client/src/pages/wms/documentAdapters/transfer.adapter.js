const { ACTIONS, DOCUMENT_KINDS, WMS_PERMISSIONS, createDocumentAdapter, invokeTrigger } = require('./adapterTypes');
const { mapAdapterError } = require('./errorMapping');
const { mapAdapterResult, mapPrintResult } = require('./resultMapping');
const { buildExecuteLinePayload, buildTransferPayload, asNumber, round4 } = require('./payloadBuilders');

function movedQtyByTransferItem(historyItems = []) {
  const grouped = historyItems.reduce((acc, move) => {
    const refItemId = String(move?.refItemId || '').trim();
    if (!refItemId || String(move?.type || '').trim().toLowerCase() !== 'transfer') return acc;
    const current = acc[refItemId] || { qty: 0, count: 0 };
    acc[refItemId] = {
      qty: round4(asNumber(current.qty, 0) + asNumber(move?.qty, 0)),
      count: current.count + 1,
    };
    return acc;
  }, {});
  return Object.entries(grouped).reduce((acc, [refItemId, entry]) => {
    acc[refItemId] = round4(entry.count > 1 ? asNumber(entry.qty, 0) / 2 : asNumber(entry.qty, 0));
    return acc;
  }, {});
}

function mergeTransferRowsWithMovedQty(items = [], historyItems = []) {
  const movedByItem = movedQtyByTransferItem(historyItems);
  return items.map((item) => ({
    ...item,
    movedQty: item?.movedQty !== undefined && item?.movedQty !== null && item?.movedQty !== ''
      ? asNumber(item.movedQty, 0)
      : asNumber(movedByItem[item?.id], 0),
  }));
}

async function executeExistingTransfer({ triggers, payload, input }) {
  const transfer = triggers.fetchTransferById
    ? await invokeTrigger(triggers.fetchTransferById, payload.id)
    : null;
  const history = triggers.fetchTransferStockMoves
    ? await invokeTrigger(triggers.fetchTransferStockMoves, { id: payload.id, page: 1, limit: 200 })
    : null;
  const historyItems = Array.isArray(history?.items)
    ? history.items
    : Array.isArray(history?.data?.items)
      ? history.data.items
      : [];
  const sourceRows = Array.isArray(input.rows) && input.rows.length
    ? input.rows
    : Array.isArray(transfer?.items)
      ? transfer.items
      : [];
  const rows = mergeTransferRowsWithMovedQty(sourceRows, historyItems);
  const executed = [];

  for (const row of rows) {
    if (!row?.id) continue;
    const linePayload = buildExecuteLinePayload(row, input);
    if (asNumber(linePayload.qty, 0) <= 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const rowResult = await invokeTrigger(triggers.executeTransferLine, {
      itemId: row.id,
      payload: linePayload,
    });
    executed.push({ itemId: row.id, payload: linePayload, result: rowResult });
  }

  if (!executed.length) {
    const error = new Error('No remaining rows to execute.');
    error.code = 'NO_LINES_TO_EXECUTE';
    throw error;
  }

  const latest = triggers.fetchTransferById
    ? await invokeTrigger(triggers.fetchTransferById, payload.id)
    : null;
  return { id: payload.id, status: latest?.status, latest, executed };
}

function createTransferAdapter({ triggers = {}, permissions } = {}) {
  const mapError = (error) => mapAdapterError(error, { fallback: 'Failed to create transfer' });

  const saveDefinition = {
    permission: WMS_PERMISSIONS.CREATE,
    buildPayload: buildTransferPayload,
    invoke: (payload) => invokeTrigger(triggers.createTransfer, payload),
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'draft' }),
    mapError,
  };

  const executeDefinition = {
    permission: WMS_PERMISSIONS.POST,
    buildPayload: buildTransferPayload,
    invoke: async (payload, input) => {
      const created = await invokeTrigger(triggers.createTransfer, payload);
      const transferId = created?.id;
      const detail = triggers.fetchTransferById
        ? await invokeTrigger(triggers.fetchTransferById, transferId)
        : created;
      const items = Array.isArray(detail?.items) ? detail.items : [];
      const executed = [];

      for (const line of items) {
        const linePayload = buildExecuteLinePayload(line, input);
        if (asNumber(linePayload.qty, 0) <= 0) continue;
        // eslint-disable-next-line no-await-in-loop
        const rowResult = await invokeTrigger(triggers.executeTransferLine, {
          itemId: line.id,
          payload: linePayload,
        });
        executed.push(rowResult);
      }

      return { ...created, executed };
    },
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'received' }),
    mapError,
  };

  return createDocumentAdapter({
    kindKey: DOCUMENT_KINDS.TRANSFER,
    permissions,
    actions: {
      [ACTIONS.SAVE]: saveDefinition,
      [ACTIONS.EXECUTE]: executeDefinition,
      [ACTIONS.EXECUTE_EXISTING]: {
        permission: WMS_PERMISSIONS.POST,
        buildPayload: (input) => ({ id: input.id }),
        invoke: (payload, input) => executeExistingTransfer({ triggers, payload, input }),
        mapResult: (raw, input) => mapAdapterResult(raw.latest || raw, { documentId: input.id, status: raw.status }),
        mapError,
      },
      [ACTIONS.POST]: executeDefinition,
      [ACTIONS.PRINT]: {
        permission: WMS_PERMISSIONS.VIEW,
        buildPayload: (input) => ({ kind: DOCUMENT_KINDS.TRANSFER, id: input.id }),
        invoke: (payload) => invokeTrigger(triggers.printDocument, payload),
        mapResult: mapPrintResult,
        mapError,
      },
    },
  });
}

module.exports = {
  createTransferAdapter,
  mergeTransferRowsWithMovedQty,
  movedQtyByTransferItem,
};
