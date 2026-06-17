import { buildAdjustmentPayload } from '../documentAdapters/payloadBuilders.js';
import { mapAdapterError } from '../documentAdapters/errorMapping.js';
import { mapAdapterResult } from '../documentAdapters/resultMapping.js';

const ACTION_SAVE = 'save';
const ACTION_POST_EXISTING = 'postExisting';
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
      message: `Action ${action} is not supported for adjustment create shell`,
      messageKey: 'wms.adapters.errors.ACTION_NOT_SUPPORTED',
      klass: 'business',
      scope: 'document',
    }],
    raw: null,
  };
}

function createAdjustmentShellAdapter({ triggers = {}, permissions } = {}) {
  return {
    kindKey: 'adjustment',
    supports(action) {
      return action === ACTION_SAVE || action === ACTION_POST_EXISTING;
    },
    permissionFor(action) {
      if (action === ACTION_SAVE) return PERMISSION_CREATE;
      if (action === ACTION_POST_EXISTING) return PERMISSION_POST;
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
          const payload = buildAdjustmentPayload(input);
          const raw = await invokeTrigger(triggers.createAdjustment, payload);
          return mapAdapterResult(raw, { status: raw?.status || 'draft' });
        }

        if (action === ACTION_POST_EXISTING) {
          const before = triggers.fetchAdjustmentById
            ? await invokeTrigger(triggers.fetchAdjustmentById, input.id)
            : null;
          const posted = await invokeTrigger(triggers.postAdjustment, { id: input.id });
          const latest = triggers.fetchAdjustmentById
            ? await invokeTrigger(triggers.fetchAdjustmentById, input.id)
            : null;
          return {
            ...mapAdapterResult(latest || posted || before || { id: input.id }, {
              documentId: input.id,
              status: latest?.status || posted?.status || 'posted',
            }),
            raw: { before, posted, latest },
          };
        }

        return unsupported(action);
      } catch (error) {
        return mapAdapterError(error, {
          fallback: action === ACTION_POST_EXISTING
            ? 'Failed to post adjustment'
            : 'Failed to create adjustment',
        });
      }
    },
  };
}

export {
  createAdjustmentShellAdapter,
};

export default createAdjustmentShellAdapter;
