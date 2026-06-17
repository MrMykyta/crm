import {
  asNumber,
  buildExecuteLinePayload,
  buildTransferPayload,
  round4,
} from '../documentAdapters/payloadBuilders.js';
import { mapAdapterError } from '../documentAdapters/errorMapping.js';
import { mapAdapterResult } from '../documentAdapters/resultMapping.js';

const ACTION_SAVE = 'save';
const ACTION_EXECUTE_EXISTING = 'executeExisting';
const PERMISSION_CREATE = 'wms:document:create';
const PERMISSION_POST = 'wms:document:post';

async function invokeTrigger(trigger, arg) {
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
  if (typeof permissions === 'function') return permissions(permission);
  if (typeof permissions.can === 'function') return permissions.can(permission);
  return true;
}

function unsupported(action) {
  return {
    ok: false,
    warnings: [],
    errors: [{
      code: 'ACTION_NOT_SUPPORTED',
      message: `Action ${action} is not supported for transfer create shell`,
      messageKey: 'wms.adapters.errors.ACTION_NOT_SUPPORTED',
      klass: 'business',
      scope: 'document',
    }],
    raw: null,
  };
}

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

function getHistoryItems(history) {
  if (Array.isArray(history?.items)) return history.items;
  if (Array.isArray(history?.data?.items)) return history.data.items;
  if (Array.isArray(history)) return history;
  return [];
}

function createTransferShellAdapter({ triggers = {}, permissions } = {}) {
  return {
    kindKey: 'transfer',
    supports(action) {
      return action === ACTION_SAVE || action === ACTION_EXECUTE_EXISTING;
    },
    permissionFor(action) {
      if (action === ACTION_SAVE) return PERMISSION_CREATE;
      if (action === ACTION_EXECUTE_EXISTING) return PERMISSION_POST;
      return null;
    },
    async run(action, input = {}) {
      if (!this.supports(action)) return unsupported(action);
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
        if (action === ACTION_SAVE) {
          const payload = buildTransferPayload(input);
          const raw = await invokeTrigger(triggers.createTransfer, payload);
          return mapAdapterResult(raw, { status: raw?.status || 'draft' });
        }

        if (action === ACTION_EXECUTE_EXISTING) {
          const transfer = triggers.fetchTransferById
            ? await invokeTrigger(triggers.fetchTransferById, input.id)
            : null;
          const history = triggers.fetchTransferStockMoves
            ? await invokeTrigger(triggers.fetchTransferStockMoves, { id: input.id, page: 1, limit: 200 })
            : null;
          const sourceRows = Array.isArray(input.rows) && input.rows.length
            ? input.rows
            : Array.isArray(transfer?.items)
              ? transfer.items
              : [];
          const rows = mergeTransferRowsWithMovedQty(sourceRows, getHistoryItems(history));
          const executed = [];

          for (const row of rows) {
            if (!row?.id) continue;
            const payload = buildExecuteLinePayload(row, input);
            if (asNumber(payload.qty, 0) <= 0) continue;
            // eslint-disable-next-line no-await-in-loop
            const rowResult = await invokeTrigger(triggers.executeTransferLine, {
              itemId: row.id,
              payload,
            });
            executed.push({ itemId: row.id, result: rowResult, payload });
          }

          if (!executed.length) {
            return {
              ok: false,
              warnings: [],
              errors: [{
                code: 'NO_LINES_TO_EXECUTE',
                message: 'No remaining rows to execute.',
                messageKey: 'wms.shell.noLinesToExecute',
                klass: 'business',
                scope: 'document',
              }],
              raw: { executed },
            };
          }

          const latest = triggers.fetchTransferById
            ? await invokeTrigger(triggers.fetchTransferById, input.id)
            : null;
          return {
            ...mapAdapterResult(latest || { id: input.id }, {
              documentId: input.id,
              status: latest?.status || executed[executed.length - 1]?.result?.status || 'completed',
            }),
            raw: { latest, executed },
          };
        }

        return unsupported(action);
      } catch (error) {
        return mapAdapterError(error, {
          fallback: action === ACTION_EXECUTE_EXISTING
            ? 'Failed to execute transfer'
            : 'Failed to create transfer',
        });
      }
    },
  };
}

export {
  createTransferShellAdapter,
  mergeTransferRowsWithMovedQty,
  movedQtyByTransferItem,
};

export default createTransferShellAdapter;
