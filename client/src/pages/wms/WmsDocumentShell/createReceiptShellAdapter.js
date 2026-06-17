import {
  buildReceiptDraftHeaderPatch,
  buildReceiptDraftItemBody,
  buildReceiptDraftItemPatch,
  buildReceiptPayload,
  buildReceiveLinePayload,
  asNumber,
} from '../documentAdapters/payloadBuilders.js';
import { mapAdapterError } from '../documentAdapters/errorMapping.js';
import { mapAdapterResult } from '../documentAdapters/resultMapping.js';

const ACTIONS = {
  SAVE: 'save',
  LOAD_DRAFT: 'loadDraft',
  UPDATE_DRAFT_HEADER: 'updateDraftHeader',
  ADD_ITEM: 'addItem',
  UPDATE_ITEM: 'updateItem',
  REMOVE_ITEM: 'removeItem',
  RECEIVE_EXISTING: 'receiveExisting',
  RECEIVE: 'receive',
  POST: 'post',
};

const PERMISSIONS = {
  VIEW: 'wms:read',
  CREATE: 'wms:document:create',
  UPDATE: 'wms:document:update',
  POST: 'wms:document:post',
};

function invokeTrigger(trigger, arg) {
  if (typeof trigger !== 'function') {
    throw new Error('Adapter trigger is not configured');
  }
  const result = trigger(arg);
  if (result && typeof result.unwrap === 'function') return result.unwrap();
  return result;
}

function hasPermission(permissions, permission) {
  if (!permission) return true;
  if (!permissions) return true;
  if (typeof permissions.can === 'function') return permissions.can(permission);
  if (typeof permissions === 'function') return permissions(permission);
  return true;
}

export function createReceiptShellAdapter({ triggers = {}, permissions } = {}) {
  const supported = new Set([
    ACTIONS.SAVE,
    ACTIONS.LOAD_DRAFT,
    ACTIONS.UPDATE_DRAFT_HEADER,
    ACTIONS.ADD_ITEM,
    ACTIONS.UPDATE_ITEM,
    ACTIONS.REMOVE_ITEM,
    ACTIONS.RECEIVE_EXISTING,
  ]);

  return {
    kindKey: 'receipt',
    supports(action) {
      return supported.has(action);
    },
    permissionFor(action) {
      if (action === ACTIONS.SAVE) return PERMISSIONS.CREATE;
      if (action === ACTIONS.LOAD_DRAFT) return PERMISSIONS.VIEW;
      if (
        action === ACTIONS.UPDATE_DRAFT_HEADER
        || action === ACTIONS.ADD_ITEM
        || action === ACTIONS.UPDATE_ITEM
        || action === ACTIONS.REMOVE_ITEM
      ) return PERMISSIONS.UPDATE;
      if (action === ACTIONS.RECEIVE_EXISTING || action === ACTIONS.RECEIVE || action === ACTIONS.POST) return PERMISSIONS.POST;
      return null;
    },
    async run(action, input = {}) {
      if (!supported.has(action)) {
        return {
          ok: false,
          warnings: [],
          errors: [{
            code: 'ACTION_DEFERRED',
            message: 'Action is deferred in SHELL-1',
            messageKey: 'wms.shell.deferredAction',
            klass: 'business',
            scope: 'document',
          }],
          raw: null,
        };
      }

      const permission = this.permissionFor(action);
      if (!hasPermission(permissions, permission)) {
        return {
          ok: false,
          warnings: [],
          errors: [{
            code: 'PERMISSION_DENIED',
            message: 'Permission denied',
            messageKey: 'wms.adapters.errors.PERMISSION_DENIED',
            klass: 'permission',
            scope: 'document',
            vars: { permission },
          }],
          raw: null,
        };
      }

      try {
        if (action === ACTIONS.SAVE) {
          const payload = buildReceiptPayload(input);
          const raw = await invokeTrigger(triggers.createReceipt, payload);
          return mapAdapterResult(raw, { status: raw?.status || 'draft' });
        }

        if (action === ACTIONS.LOAD_DRAFT) {
          const raw = await invokeTrigger(triggers.fetchReceiptById, input.id);
          return mapAdapterResult(raw, { documentId: input.id, status: raw?.status });
        }

        if (action === ACTIONS.UPDATE_DRAFT_HEADER) {
          const payload = buildReceiptDraftHeaderPatch(input);
          const raw = await invokeTrigger(triggers.updateReceiptDraft, { id: input.id, payload });
          return mapAdapterResult(raw, { documentId: input.id, status: raw?.status });
        }

        if (action === ACTIONS.ADD_ITEM) {
          const payload = buildReceiptDraftItemBody(input.row || input);
          const raw = await invokeTrigger(triggers.addReceiptDraftItem, { id: input.id, payload });
          return {
            ...mapAdapterResult(raw, { documentId: input.id, status: raw?.status }),
            itemId: raw?.itemId || raw?.data?.itemId || raw?.items?.[raw.items.length - 1]?.id || null,
          };
        }

        if (action === ACTIONS.UPDATE_ITEM) {
          const payload = buildReceiptDraftItemPatch(input.row || input);
          const raw = await invokeTrigger(triggers.updateReceiptDraftItem, { id: input.id, itemId: input.itemId, payload });
          return mapAdapterResult(raw, { documentId: input.id, status: raw?.status });
        }

        if (action === ACTIONS.REMOVE_ITEM) {
          const raw = await invokeTrigger(triggers.removeReceiptDraftItem, { id: input.id, itemId: input.itemId });
          return mapAdapterResult(raw, { documentId: input.id, status: raw?.status });
        }

        if (action === ACTIONS.RECEIVE_EXISTING) {
          const rows = Array.isArray(input.rows) ? input.rows : [];
          const received = [];
          for (const row of rows) {
            if (!row?.id) continue;
            const payload = buildReceiveLinePayload(row, input);
            if (asNumber(payload.qty, 0) <= 0) continue;
            // eslint-disable-next-line no-await-in-loop
            const rowResult = await invokeTrigger(triggers.receiveReceiptLine, {
              id: input.id,
              itemId: row.id,
              receiptId: input.id,
              payload,
            });
            received.push({ itemId: row.id, result: rowResult, payload });
          }

          if (!received.length) {
            return {
              ok: false,
              warnings: [],
              errors: [{
                code: 'NO_LINES_TO_RECEIVE',
                message: 'No remaining rows to receive.',
                messageKey: 'wms.shell.noLinesToReceive',
                klass: 'business',
                scope: 'document',
              }],
              raw: { received },
            };
          }

          const latest = triggers.fetchReceiptById
            ? await invokeTrigger(triggers.fetchReceiptById, input.id)
            : null;
          return {
            ...mapAdapterResult(latest || { id: input.id }, {
              documentId: input.id,
              status: latest?.status || received[received.length - 1]?.result?.status,
            }),
            raw: { latest, received },
          };
        }

        return {
          ok: false,
          warnings: [],
          errors: [{ code: 'ACTION_NOT_SUPPORTED', message: `Action ${action} is not supported`, scope: 'document' }],
          raw: null,
        };
      } catch (error) {
        return mapAdapterError(error, {
          fallback: action === ACTIONS.RECEIVE_EXISTING
            ? 'Failed to receive receipt'
            : action === ACTIONS.SAVE
              ? 'Failed to create receipt'
              : 'Failed to save receipt draft',
        });
      }
    },
  };
}

export default createReceiptShellAdapter;
