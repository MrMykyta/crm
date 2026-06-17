const { ACTIONS, DOCUMENT_KINDS, WMS_PERMISSIONS, createDocumentAdapter, invokeTrigger } = require('./adapterTypes');
const { mapAdapterError } = require('./errorMapping');
const { mapAdapterResult, mapPrintResult } = require('./resultMapping');
const {
  buildShipmentPayload,
  buildShipItemPayload,
  asNumber,
  round4,
} = require('./payloadBuilders');

function shippedQtyByShipmentItem(historyItems = []) {
  return historyItems.reduce((acc, move) => {
    const refItemId = String(move?.refItemId || '').trim();
    if (!refItemId || String(move?.type || '').trim().toLowerCase() !== 'ship') return acc;
    acc[refItemId] = round4(asNumber(acc[refItemId], 0) + asNumber(move?.qty, 0));
    return acc;
  }, {});
}

function mergeShipmentRowsWithShippedQty(items = [], historyItems = []) {
  const shippedByItem = shippedQtyByShipmentItem(historyItems);
  return items.map((item) => ({
    ...item,
    qtyShipped: asNumber(shippedByItem[item?.id] ?? item?.qtyShipped, 0),
  }));
}

async function shipExistingShipment({ triggers, payload, input }) {
  const shipment = triggers.fetchShipmentById
    ? await invokeTrigger(triggers.fetchShipmentById, payload.id)
    : null;
  const history = triggers.fetchShipmentStockMoves
    ? await invokeTrigger(triggers.fetchShipmentStockMoves, { id: payload.id, page: 1, limit: 200 })
    : null;
  const historyItems = Array.isArray(history?.items)
    ? history.items
    : Array.isArray(history?.data?.items)
      ? history.data.items
      : [];
  const sourceRows = Array.isArray(input.rows) && input.rows.length
    ? input.rows
    : Array.isArray(shipment?.items)
      ? shipment.items
      : [];
  const rows = mergeShipmentRowsWithShippedQty(sourceRows, historyItems);
  const shipped = [];

  for (const row of rows) {
    if (!row?.id) continue;
    const linePayload = buildShipItemPayload(row, input);
    if (asNumber(linePayload.qty, 0) <= 0) continue;
    // eslint-disable-next-line no-await-in-loop
    const rowResult = await invokeTrigger(triggers.shipShipmentItem, {
      itemId: row.id,
      shipmentId: payload.id,
      payload: linePayload,
    });
    shipped.push({ itemId: row.id, payload: linePayload, result: rowResult });
  }

  if (!shipped.length) {
    const error = new Error('No remaining rows to ship.');
    error.code = 'NO_LINES_TO_SHIP';
    throw error;
  }

  const latest = triggers.fetchShipmentById
    ? await invokeTrigger(triggers.fetchShipmentById, payload.id)
    : null;
  return { id: payload.id, status: latest?.status, latest, shipped };
}

function createShipmentAdapter({ triggers = {}, permissions } = {}) {
  const mapError = (error) => mapAdapterError(error, { fallback: 'Failed to create shipment' });

  const saveDefinition = {
    permission: WMS_PERMISSIONS.CREATE,
    buildPayload: buildShipmentPayload,
    invoke: (payload) => invokeTrigger(triggers.createShipment, payload),
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'packing' }),
    mapError,
  };

  const shipDefinition = {
    permission: WMS_PERMISSIONS.POST,
    buildPayload: buildShipmentPayload,
    invoke: async (payload, input) => {
      const created = await invokeTrigger(triggers.createShipment, payload);
      const shipmentId = created?.id;
      const items = Array.isArray(created?.items) ? created.items : [];
      const shipped = [];

      for (const line of items) {
        const linePayload = buildShipItemPayload(line, input);
        if (linePayload.qty <= 0) continue;
        // eslint-disable-next-line no-await-in-loop
        const rowResult = await invokeTrigger(triggers.shipShipmentItem, {
          itemId: line.id,
          shipmentId,
          payload: linePayload,
        });
        shipped.push(rowResult);
      }

      return { ...created, shipped };
    },
    mapResult: (raw) => mapAdapterResult(raw, { status: 'shipped' }),
    mapError,
  };

  return createDocumentAdapter({
    kindKey: DOCUMENT_KINDS.SHIPMENT,
    permissions,
    actions: {
      [ACTIONS.SAVE]: saveDefinition,
      [ACTIONS.SHIP]: shipDefinition,
      [ACTIONS.SHIP_EXISTING]: {
        permission: WMS_PERMISSIONS.POST,
        buildPayload: (input) => ({ id: input.id }),
        invoke: (payload, input) => shipExistingShipment({ triggers, payload, input }),
        mapResult: (raw, input) => mapAdapterResult(raw.latest || raw, { documentId: input.id, status: raw.status }),
        mapError,
      },
      [ACTIONS.POST]: shipDefinition,
      [ACTIONS.CORRECT]: {
        permission: WMS_PERMISSIONS.CORRECT,
        buildPayload: (input) => input.payload || input.lines || {},
        invoke: (payload, input) => invokeTrigger(triggers.createShipmentCorrection, { id: input.id, payload }),
        mapResult: (raw) => mapAdapterResult(raw, { status: 'corrected' }),
        mapError,
      },
      [ACTIONS.PRINT]: {
        permission: WMS_PERMISSIONS.VIEW,
        buildPayload: (input) => ({ kind: DOCUMENT_KINDS.SHIPMENT, id: input.id }),
        invoke: (payload) => invokeTrigger(triggers.printDocument, payload),
        mapResult: mapPrintResult,
        mapError,
      },
    },
  });
}

module.exports = {
  createShipmentAdapter,
  mergeShipmentRowsWithShippedQty,
  shippedQtyByShipmentItem,
};
