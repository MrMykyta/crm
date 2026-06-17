import { buildCycleCountPayload } from '../documentAdapters/payloadBuilders.js';
import { mapAdapterError } from '../documentAdapters/errorMapping.js';
import { mapAdapterResult } from '../documentAdapters/resultMapping.js';

const ACTION_SAVE = 'save';
const ACTION_RECONCILE_EXISTING = 'reconcileExisting';
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
      message: `Action ${action} is not supported for cycle count create shell`,
      messageKey: 'wms.adapters.errors.ACTION_NOT_SUPPORTED',
      klass: 'business',
      scope: 'document',
    }],
    raw: null,
  };
}

function permissionFor(action) {
  if (action === ACTION_SAVE) return PERMISSION_CREATE;
  if (action === ACTION_RECONCILE_EXISTING) return PERMISSION_POST;
  return null;
}

function createCycleCountShellAdapter({ triggers = {}, permissions } = {}) {
  return {
    kindKey: 'cycleCount',
    supports(action) {
      return action === ACTION_SAVE || action === ACTION_RECONCILE_EXISTING;
    },
    permissionFor,
    async run(action, input = {}) {
      if (!this.supports(action)) return unsupported(action);
      const requiredPermission = permissionFor(action);
      if (!hasPermission(permissions, requiredPermission)) {
        return {
          ok: false,
          warnings: [],
          errors: [{
            code: 'PERMISSION_DENIED',
            message: 'Permission denied',
            messageKey: 'wms.adapters.errors.PERMISSION_DENIED',
            klass: 'permission',
            scope: 'document',
            vars: { permission: requiredPermission },
          }],
          raw: null,
        };
      }

      try {
        if (action === ACTION_RECONCILE_EXISTING) {
          if (typeof triggers.fetchCycleCountById === 'function') {
            await invokeTrigger(triggers.fetchCycleCountById, input.id);
          }
          const reconciled = await invokeTrigger(triggers.reconcileCycleCount, { id: input.id });
          const latest = typeof triggers.fetchCycleCountById === 'function'
            ? await invokeTrigger(triggers.fetchCycleCountById, input.id)
            : null;
          return mapAdapterResult({ ...(latest || reconciled), id: input.id, reconcileResult: reconciled }, {
            status: latest?.status || reconciled?.status || 'reconciled',
            documentId: input.id,
          });
        }

        const payload = buildCycleCountPayload(input);
        const raw = await invokeTrigger(triggers.createCycleCount, payload);
        return mapAdapterResult(raw, { status: raw?.status || 'planned' });
      } catch (error) {
        return mapAdapterError(error, {
          fallback: action === ACTION_RECONCILE_EXISTING
            ? 'Failed to reconcile cycle count'
            : 'Failed to create cycle count',
        });
      }
    },
  };
}

export {
  createCycleCountShellAdapter,
};

export default createCycleCountShellAdapter;
