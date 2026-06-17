const DOCUMENT_KINDS = Object.freeze({
  RECEIPT: 'receipt',
  SHIPMENT: 'shipment',
  TRANSFER: 'transfer',
  ADJUSTMENT: 'adjustment',
  CYCLE_COUNT: 'cycleCount',
});

const ACTIONS = Object.freeze({
  SAVE: 'save',
  LOAD_DRAFT: 'loadDraft',
  UPDATE_DRAFT_HEADER: 'updateDraftHeader',
  ADD_ITEM: 'addItem',
  UPDATE_ITEM: 'updateItem',
  REMOVE_ITEM: 'removeItem',
  RECEIVE_EXISTING: 'receiveExisting',
  SHIP_EXISTING: 'shipExisting',
  EXECUTE_EXISTING: 'executeExisting',
  POST_EXISTING: 'postExisting',
  RECONCILE_EXISTING: 'reconcileExisting',
  POST: 'post',
  RECEIVE: 'receive',
  SHIP: 'ship',
  EXECUTE: 'execute',
  RECONCILE: 'reconcile',
  ADD_ITEMS: 'addItems',
  CORRECT: 'correct',
  PRINT: 'print',
});

const WMS_PERMISSIONS = Object.freeze({
  VIEW: 'wms:read',
  CREATE: 'wms:document:create',
  UPDATE: 'wms:document:update',
  POST: 'wms:document:post',
  CORRECT: 'wms:document:correct',
});

function hasPermission(permissions, permission) {
  if (!permission) return true;
  if (!permissions) return true;
  if (typeof permissions === 'function') return permissions(permission);
  if (typeof permissions.can === 'function') return permissions.can(permission);
  if (Array.isArray(permissions)) return permissions.includes(permission);
  return true;
}

async function invokeTrigger(trigger, arg) {
  if (typeof trigger !== 'function') {
    throw new Error('Adapter trigger is not configured');
  }
  const result = trigger(arg);
  if (result && typeof result.unwrap === 'function') return result.unwrap();
  return result;
}

function createDocumentAdapter({ kindKey, actions, permissions }) {
  const actionMap = actions || {};

  return {
    kindKey,
    supports(action) {
      return Boolean(actionMap[action]);
    },
    permissionFor(action) {
      return actionMap[action]?.permission || null;
    },
    async run(action, input = {}) {
      const definition = actionMap[action];
      if (!definition) {
        return definition?.mapUnsupported?.(action) || {
          ok: false,
          warnings: [],
          errors: [{
            code: 'ACTION_NOT_SUPPORTED',
            message: `Action ${action} is not supported for ${kindKey}`,
            messageKey: 'wms.adapters.errors.ACTION_NOT_SUPPORTED',
            klass: 'business',
            scope: 'document',
          }],
          raw: null,
        };
      }

      if (!hasPermission(permissions, definition.permission)) {
        return {
          ok: false,
          warnings: [],
          errors: [{
            code: 'PERMISSION_DENIED',
            message: 'Permission denied',
            messageKey: 'wms.adapters.errors.PERMISSION_DENIED',
            klass: 'permission',
            scope: 'document',
            vars: { permission: definition.permission },
          }],
          raw: null,
        };
      }

      try {
        const payload = definition.buildPayload ? definition.buildPayload(input) : input;
        const raw = definition.invoke ? await definition.invoke(payload, input) : payload;
        return definition.mapResult(raw, input);
      } catch (error) {
        return definition.mapError(error, input);
      }
    },
  };
}

module.exports = {
  ACTIONS,
  DOCUMENT_KINDS,
  WMS_PERMISSIONS,
  createDocumentAdapter,
  invokeTrigger,
};
