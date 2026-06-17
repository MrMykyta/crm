const { ACTIONS, DOCUMENT_KINDS, WMS_PERMISSIONS, createDocumentAdapter, invokeTrigger } = require('./adapterTypes');
const { mapAdapterError } = require('./errorMapping');
const { mapAdapterResult, mapPrintResult } = require('./resultMapping');
const { buildCycleCountItemsPayload, buildCycleCountPayload } = require('./payloadBuilders');

function createCycleCountAdapter({ triggers = {}, permissions } = {}) {
  const mapError = (error) => mapAdapterError(error, { fallback: 'Failed to process cycle count' });

  const saveDefinition = {
    permission: WMS_PERMISSIONS.CREATE,
    buildPayload: buildCycleCountPayload,
    invoke: (payload) => invokeTrigger(triggers.createCycleCount, payload),
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'planned' }),
    mapError,
  };

  const addItemsDefinition = {
    permission: WMS_PERMISSIONS.UPDATE,
    buildPayload: buildCycleCountItemsPayload,
    invoke: (payload, input) => invokeTrigger(triggers.addCycleCountItems, { id: input.id, items: payload.items }),
    mapResult: (raw, input) => mapAdapterResult(raw, { status: raw?.status || 'counting', documentId: input.id }),
    mapError,
  };

  const reconcileDefinition = {
    permission: WMS_PERMISSIONS.POST,
    buildPayload: buildCycleCountItemsPayload,
    invoke: async (payload, input) => {
      if (payload.items.length) {
        await invokeTrigger(triggers.addCycleCountItems, { id: input.id, items: payload.items });
      }
      const reconciled = await invokeTrigger(triggers.reconcileCycleCount, { id: input.id });
      return { ...reconciled, id: input.id };
    },
    mapResult: (raw, input) => mapAdapterResult(raw, { status: raw?.status || 'reconciled', documentId: input.id }),
    mapError,
  };

  const reconcileExistingDefinition = {
    permission: WMS_PERMISSIONS.POST,
    buildPayload: (input) => ({ id: input.id }),
    invoke: async (payload) => {
      if (typeof triggers.fetchCycleCountById === 'function') {
        await invokeTrigger(triggers.fetchCycleCountById, payload.id);
      }
      const reconciled = await invokeTrigger(triggers.reconcileCycleCount, { id: payload.id });
      const latest = typeof triggers.fetchCycleCountById === 'function'
        ? await invokeTrigger(triggers.fetchCycleCountById, payload.id)
        : null;
      return { ...(latest || reconciled), id: payload.id, reconcileResult: reconciled };
    },
    mapResult: (raw, input) => mapAdapterResult(raw, { status: raw?.status || 'reconciled', documentId: input.id }),
    mapError,
  };

  return createDocumentAdapter({
    kindKey: DOCUMENT_KINDS.CYCLE_COUNT,
    permissions,
    actions: {
      [ACTIONS.SAVE]: saveDefinition,
      [ACTIONS.ADD_ITEMS]: addItemsDefinition,
      [ACTIONS.RECONCILE]: reconcileDefinition,
      [ACTIONS.RECONCILE_EXISTING]: reconcileExistingDefinition,
      [ACTIONS.POST]: reconcileDefinition,
      [ACTIONS.PRINT]: {
        permission: WMS_PERMISSIONS.VIEW,
        buildPayload: (input) => ({ kind: DOCUMENT_KINDS.CYCLE_COUNT, id: input.id }),
        invoke: (payload) => invokeTrigger(triggers.printDocument, payload),
        mapResult: mapPrintResult,
        mapError,
      },
    },
  });
}

module.exports = {
  createCycleCountAdapter,
};
