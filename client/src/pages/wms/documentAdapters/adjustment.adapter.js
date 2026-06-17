const { ACTIONS, DOCUMENT_KINDS, WMS_PERMISSIONS, createDocumentAdapter, invokeTrigger } = require('./adapterTypes');
const { mapAdapterError } = require('./errorMapping');
const { mapAdapterResult, mapPrintResult } = require('./resultMapping');
const { buildAdjustmentPayload } = require('./payloadBuilders');

function createAdjustmentAdapter({ triggers = {}, permissions } = {}) {
  const mapError = (error) => mapAdapterError(error, { fallback: 'Failed to create adjustment' });

  const saveDefinition = {
    permission: WMS_PERMISSIONS.CREATE,
    buildPayload: buildAdjustmentPayload,
    invoke: (payload) => invokeTrigger(triggers.createAdjustment, payload),
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'draft' }),
    mapError,
  };

  const postDefinition = {
    permission: WMS_PERMISSIONS.POST,
    buildPayload: buildAdjustmentPayload,
    invoke: async (payload) => {
      const created = await invokeTrigger(triggers.createAdjustment, payload);
      const adjustmentId = created?.id;
      if (!adjustmentId) return created;
      const posted = await invokeTrigger(triggers.postAdjustment, { id: adjustmentId });
      return { ...created, posted, status: posted?.status || 'posted' };
    },
    mapResult: (raw) => mapAdapterResult(raw, { status: raw?.status || 'posted' }),
    mapError,
  };

  return createDocumentAdapter({
    kindKey: DOCUMENT_KINDS.ADJUSTMENT,
    permissions,
    actions: {
      [ACTIONS.SAVE]: saveDefinition,
      [ACTIONS.POST_EXISTING]: {
        permission: WMS_PERMISSIONS.POST,
        buildPayload: (input) => ({ id: input.id }),
        invoke: async (payload) => {
          const adjustment = triggers.fetchAdjustmentById
            ? await invokeTrigger(triggers.fetchAdjustmentById, payload.id)
            : null;
          const posted = await invokeTrigger(triggers.postAdjustment, { id: payload.id });
          return {
            ...(adjustment || {}),
            ...(posted || {}),
            id: payload.id,
            posted,
            status: posted?.status || 'posted',
          };
        },
        mapResult: (raw, input) => mapAdapterResult(raw, { documentId: input.id, status: raw?.status || 'posted' }),
        mapError,
      },
      [ACTIONS.POST]: postDefinition,
      [ACTIONS.PRINT]: {
        permission: WMS_PERMISSIONS.VIEW,
        buildPayload: (input) => ({ kind: DOCUMENT_KINDS.ADJUSTMENT, id: input.id }),
        invoke: (payload) => invokeTrigger(triggers.printDocument, payload),
        mapResult: mapPrintResult,
        mapError,
      },
    },
  });
}

module.exports = {
  createAdjustmentAdapter,
};
