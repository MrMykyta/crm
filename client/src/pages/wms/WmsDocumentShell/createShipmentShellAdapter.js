import {
  buildShipmentPayload,
  buildShipItemPayload,
  asNumber,
  round4,
} from '../documentAdapters/payloadBuilders.js';
import { mapAdapterError } from '../documentAdapters/errorMapping.js';
import { mapAdapterResult } from '../documentAdapters/resultMapping.js';

const ACTION_SAVE = 'save';
const ACTION_SHIP_EXISTING = 'shipExisting';
const ACTION_CORRECT = 'correct';
const PERMISSION_CREATE = 'wms:document:create';
const PERMISSION_POST = 'wms:document:post';
const PERMISSION_CORRECT = 'wms:document:correct';

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

function getHistoryItems(history) {
  if (Array.isArray(history?.items)) return history.items;
  if (Array.isArray(history?.data?.items)) return history.data.items;
  if (Array.isArray(history)) return history;
  return [];
}

function unsupported(action) {
  return {
    ok: false,
    warnings: [],
    errors: [{
      code: 'ACTION_NOT_SUPPORTED',
      message: `Action ${action} is not supported for shipment create shell`,
      messageKey: 'wms.adapters.errors.ACTION_NOT_SUPPORTED',
      klass: 'business',
      scope: 'document',
    }],
    raw: null,
  };
}

function createShipmentShellAdapter({ triggers = {}, permissions } = {}) {
  return {
    kindKey: 'shipment',
    supports(action) {
      return action === ACTION_SAVE || action === ACTION_SHIP_EXISTING || action === ACTION_CORRECT;
    },
    permissionFor(action) {
      if (action === ACTION_SAVE) return PERMISSION_CREATE;
      if (action === ACTION_SHIP_EXISTING) return PERMISSION_POST;
      if (action === ACTION_CORRECT) return PERMISSION_CORRECT;
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
          const payload = buildShipmentPayload(input);
          const raw = await invokeTrigger(triggers.createShipment, payload);
          return mapAdapterResult(raw, { status: raw?.status || 'packing' });
        }

        if (action === ACTION_SHIP_EXISTING) {
          const shipment = triggers.fetchShipmentById
            ? await invokeTrigger(triggers.fetchShipmentById, input.id)
            : null;
          const history = triggers.fetchShipmentStockMoves
            ? await invokeTrigger(triggers.fetchShipmentStockMoves, { id: input.id, page: 1, limit: 200 })
            : null;
          const sourceRows = Array.isArray(input.rows) && input.rows.length
            ? input.rows
            : Array.isArray(shipment?.items)
              ? shipment.items
              : [];
          const rows = mergeShipmentRowsWithShippedQty(sourceRows, getHistoryItems(history));
          const shipped = [];

          for (const row of rows) {
            if (!row?.id) continue;
            const payload = buildShipItemPayload(row, input);
            if (asNumber(payload.qty, 0) <= 0) continue;
            // eslint-disable-next-line no-await-in-loop
            const rowResult = await invokeTrigger(triggers.shipShipmentItem, {
              itemId: row.id,
              shipmentId: input.id,
              payload,
            });
            shipped.push({ itemId: row.id, result: rowResult, payload });
          }

          if (!shipped.length) {
            return {
              ok: false,
              warnings: [],
              errors: [{
                code: 'NO_LINES_TO_SHIP',
                message: 'No remaining rows to ship.',
                messageKey: 'wms.shell.noLinesToShip',
                klass: 'business',
                scope: 'document',
              }],
              raw: { shipped },
            };
          }

          const latest = triggers.fetchShipmentById
            ? await invokeTrigger(triggers.fetchShipmentById, input.id)
            : null;
          return {
            ...mapAdapterResult(latest || { id: input.id }, {
              documentId: input.id,
              status: latest?.status || shipped[shipped.length - 1]?.result?.status || 'shipped',
            }),
            raw: { latest, shipped },
          };
        }

        if (action === ACTION_CORRECT) {
          const payload = input.payload || input.lines || {};
          const raw = await invokeTrigger(triggers.createShipmentCorrection, { id: input.id, payload });
          return mapAdapterResult(raw, { status: raw?.status || 'corrected' });
        }

        return unsupported(action);
      } catch (error) {
        return mapAdapterError(error, {
          fallback: action === ACTION_CORRECT
            ? 'Failed to create correction'
            : action === ACTION_SHIP_EXISTING
            ? 'Failed to ship shipment'
            : 'Failed to create shipment',
        });
      }
    },
  };
}

export {
  createShipmentShellAdapter,
  mergeShipmentRowsWithShippedQty,
  shippedQtyByShipmentItem,
};

export default createShipmentShellAdapter;
