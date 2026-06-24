const SCOPE_KEYS = new Set(['own', 'dept']);

export const MODULE_ORDER = ['core', 'crm', 'pim', 'oms', 'wms', 'system', 'other'];

const RESOURCE_META = {
  company: { module: 'core' },
  'company:settings': { module: 'core' },
  settings: { module: 'core' },
  user: { module: 'core' },
  member: { module: 'core' },
  role: { module: 'core' },
  permission: { module: 'core' },
  department: { module: 'core' },

  counterparty: { module: 'crm' },
  contact: { module: 'crm' },
  deal: { module: 'crm' },
  'deal:pipeline': { module: 'crm' },
  task: { module: 'crm' },
  note: { module: 'crm' },
  document: { module: 'crm' },
  'document:template': { module: 'crm' },
  calendar: { module: 'crm' },

  product: { module: 'pim' },
  category: { module: 'pim' },
  brand: { module: 'pim' },
  attribute: { module: 'pim' },
  product_type: { module: 'pim' },
  variant: { module: 'pim' },
  collection: { module: 'pim' },
  tag: { module: 'pim' },
  channel: { module: 'pim' },
  price_list: { module: 'pim' },
  uom: { module: 'pim' },
  tax_category: { module: 'pim' },
  shipping_class: { module: 'pim' },

  offer: { module: 'oms' },
  order: { module: 'oms' },
  invoice: { module: 'oms' },
  payment: { module: 'oms' },
  shipment: { module: 'oms' },
  return: { module: 'oms' },
  credit_note: { module: 'oms' },
  discount: { module: 'oms' },

  wms: { module: 'wms' },
  'wms:settings': { module: 'wms' },
  'wms:warehouse': { module: 'wms' },
  'wms:location': { module: 'wms' },
  'wms:document': { module: 'wms' },
  'wms:inventory': { module: 'wms' },
  'wms:reservation': { module: 'wms' },
  'wms:picking': { module: 'wms' },
  'wms:reports': { module: 'wms' },
  'wms:costing': { module: 'wms' },

  file: { module: 'system' },
  attachment: { module: 'system', canonicalResource: 'file', legacy: true },
  notification: { module: 'system' },
  chat: { module: 'system' },
  integration: { module: 'system' },
  'integration:webhook': { module: 'system' },
  automation: { module: 'system' },
  audit: { module: 'system' },
  import: { module: 'system' },
  export: { module: 'system' },
  workspace_view: { module: 'system' },
};

const ACTION_VERBS = {
  read: 'view',
  create: 'create',
  update: 'update',
  delete: 'delete',
  manage: 'manage',
  assign: 'assign',
  invite: 'invite',
  convert: 'convert',
  issue: 'issue',
  cancel: 'cancel',
  post: 'post',
  correct: 'correct',
  publish: 'publish',
  archive: 'archive',
  duplicate: 'duplicate',
  deactivate: 'deactivate',
  run: 'run',
  upload: 'upload',
  moderate: 'moderate',
  count: 'count',
  from_offer: 'convert',
  write: 'write',
};

const DANGER_ACTIONS = new Set(['delete', 'manage', 'assign', 'cancel', 'post', 'correct', 'issue', 'deactivate', 'run']);
const DANGER_KEYS = new Set([
  'company:delete',
  'permission:manage',
  'wms:document:correct',
  'wms:document:post',
  'wms:costing:manage',
]);

function titleCase(value) {
  return String(value || '')
    .replace(/[._:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function translate(t, key, fallback) {
  if (typeof t !== 'function') return fallback;
  return t(key, { defaultValue: fallback });
}

function resourceLabelKey(resource) {
  return `acl.permissionUx.resources.${String(resource || 'unknown').replace(/[:.]/g, '_')}`;
}

function actionLabelKey(action) {
  return `acl.permissionUx.actions.${action || 'unknown'}`;
}

export function normalizePermissionKey(key) {
  const raw = String(key || '').trim();
  if (raw === 'chat.read') return 'chat:read';
  if (raw === 'chat.write') return 'chat:write';
  return raw;
}

export function splitPermissionKey(key) {
  const normalized = normalizePermissionKey(key);
  const segments = normalized.split(':').filter(Boolean);
  const scope = SCOPE_KEYS.has(segments[segments.length - 1]) ? segments.pop() : null;
  let action = segments.pop() || 'read';
  if (segments.length === 1 && segments[0] === 'chat' && action === 'write') action = 'write';
  const resource = segments.join(':') || normalized || 'unknown';
  const knownResource = RESOURCE_META[resource]
    ? resource
    : RESOURCE_META[segments[0]]
      ? segments[0]
      : resource;
  return {
    normalized,
    resource: knownResource,
    action,
    scope,
  };
}

export function getPermissionResource(key) {
  const parsed = splitPermissionKey(key);
  return RESOURCE_META[parsed.resource]?.canonicalResource || parsed.resource;
}

export function getPermissionModule(key) {
  const parsed = splitPermissionKey(key);
  const resource = getPermissionResource(key);
  return RESOURCE_META[parsed.resource]?.module || RESOURCE_META[resource]?.module || 'other';
}

export function isDangerPermission(key) {
  const parsed = splitPermissionKey(key);
  const normalized = parsed.normalized;
  if (DANGER_KEYS.has(normalized)) return true;
  if (DANGER_ACTIONS.has(parsed.action)) return true;
  if (/:(delete|manage|assign|correct|post|cancel|run)(:|$)/.test(normalized)) return true;
  return false;
}

export function humanizePermissionKey(key, t) {
  const parsed = splitPermissionKey(key);
  const resource = getPermissionResource(key);
  const action = ACTION_VERBS[parsed.action] || parsed.action || 'read';
  const actionLabel = translate(t, actionLabelKey(action), titleCase(action));
  const resourceLabel = translate(t, resourceLabelKey(resource), titleCase(resource));
  const scopeLabel = parsed.scope ? translate(t, `acl.permissionUx.scopes.${parsed.scope}`, titleCase(parsed.scope)) : '';
  return [actionLabel, resourceLabel, scopeLabel ? `(${scopeLabel})` : ''].filter(Boolean).join(' ');
}

export function getPermissionMeta(key, t) {
  const parsed = splitPermissionKey(key);
  const resource = getPermissionResource(key);
  const action = ACTION_VERBS[parsed.action] || parsed.action || 'read';
  const module = getPermissionModule(key);
  const rawKey = String(key || '');
  const normalizedKey = parsed.normalized;
  const resourceInfo = RESOURCE_META[parsed.resource] || RESOURCE_META[resource] || {};
  const label = humanizePermissionKey(key, t);
  const moduleLabel = translate(t, `acl.permissionUx.modules.${module}`, titleCase(module));
  const resourceLabel = translate(t, resourceLabelKey(resource), titleCase(resource));

  return {
    rawKey,
    normalizedKey,
    module,
    moduleLabel,
    resource,
    resourceLabel,
    action,
    actionLabel: translate(t, actionLabelKey(action), titleCase(action)),
    scope: parsed.scope,
    scopeLabel: parsed.scope ? translate(t, `acl.permissionUx.scopes.${parsed.scope}`, titleCase(parsed.scope)) : '',
    label,
    description: translate(t, 'acl.permissionUx.fallbackDescription', label),
    danger: isDangerPermission(key),
    legacy: Boolean(resourceInfo.legacy) || rawKey !== normalizedKey,
  };
}

export function groupPermissions(permissions = [], t) {
  const moduleMap = new Map();
  for (const permission of permissions) {
    const rawKey = typeof permission === 'string' ? permission : permission?.name;
    if (!rawKey) continue;
    const meta = getPermissionMeta(rawKey, t);
    if (!moduleMap.has(meta.module)) {
      moduleMap.set(meta.module, {
        key: meta.module,
        label: meta.moduleLabel,
        order: MODULE_ORDER.indexOf(meta.module) >= 0 ? MODULE_ORDER.indexOf(meta.module) : MODULE_ORDER.length,
        resources: new Map(),
      });
    }
    const moduleGroup = moduleMap.get(meta.module);
    if (!moduleGroup.resources.has(meta.resource)) {
      moduleGroup.resources.set(meta.resource, {
        key: meta.resource,
        label: meta.resourceLabel,
        module: meta.module,
        permissions: [],
        effectiveCount: 0,
        directAllowCount: 0,
        directDenyCount: 0,
        roleCount: 0,
        dangerCount: 0,
      });
    }
    const resourceGroup = moduleGroup.resources.get(meta.resource);
    const item = typeof permission === 'string' ? { name: permission } : permission;
    resourceGroup.permissions.push({ ...item, meta });
    if (item?.effective) resourceGroup.effectiveCount += 1;
    if (item?.viaUserAllow) resourceGroup.directAllowCount += 1;
    if (item?.viaUserDeny) resourceGroup.directDenyCount += 1;
    if (item?.viaRole) resourceGroup.roleCount += 1;
    if (meta.danger) resourceGroup.dangerCount += 1;
  }

  return [...moduleMap.values()]
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label))
    .map((moduleGroup) => ({
      ...moduleGroup,
      resources: [...moduleGroup.resources.values()].sort((a, b) => a.label.localeCompare(b.label)),
    }));
}
