const { PERMISSIONS } = require('./permissions');

// Дефолтные права owner/admin:
// берём полный набор из глобального справочника permissions.
const OWNER_PERMS = [...PERMISSIONS];
const OWNER_ONLY_PERMS = new Set([
  'company:delete',
  'permission:manage',
]);
const ADMIN_PERMS = PERMISSIONS.filter((permission) => !OWNER_ONLY_PERMS.has(permission));

// Базовый набор прав менеджера:
// операционные CRU-права без ACL management, system-level и destructive settings.
const MANAGER_PERMS  = [
  'company:read',
  'user:read',
  'member:read',
  'department:read',
  'counterparty:read','counterparty:read:own','counterparty:read:dept','counterparty:create','counterparty:update','counterparty:update:own','counterparty:update:dept',
  'deal:read','deal:read:dept','deal:create','deal:update','deal:update:own','deal:update:dept',
  'task:read','task:read:dept','task:create','task:update','task:update:own','task:update:dept',
  'contact:read','contact:read:own','contact:create','contact:update','contact:update:own',
  'document:read','document:create','document:update','document:template:read','document:template:manage',
  'product:read','product:create','product:update','product:publish','product:archive','product:duplicate','product:link:manage',
  'category:read','category:create','category:update',
  'brand:read','brand:create','brand:update',
  'attribute:read','attribute:create','attribute:update',
  'product_type:read','product_type:create','product_type:update',
  'variant:read','variant:create','variant:update',
  'collection:read','collection:create','collection:update',
  'tag:read','tag:create','tag:update',
  'channel:read','channel:create','channel:update',
  'price_list:read','price_list:create','price_list:update',
  'uom:read','uom:create','uom:update',
  'tax_category:read','tax_category:create','tax_category:update',
  'shipping_class:read','shipping_class:create','shipping_class:update',
  'offer:read','offer:create','offer:update','offer:convert',
  'order:read','order:create','order:update','order:from_offer','order:convert',
  'invoice:read',
  'payment:read',
  'note:read','note:create','note:update','note:delete',
  'chat.read','chat.write','chat:read','chat:write',
  'file:read','file:upload',
  'attachment:read','attachment:upload',
  'notification:read',
  'workspace_view:read','workspace_view:create','workspace_view:update',
  'wms:read',
  'wms:warehouse:manage',
  'wms:location:manage',
  'wms:document:create',
  'wms:document:update',
  'wms:document:post',
  'wms:document:correct',
  'wms:inventory:read',
  'wms:inventory:count',
  'wms:reservation:manage',
  'wms:picking:manage',
  'wms:reports:read'
];

// Базовый набор прав сотрудника:
// чтение основных сущностей и scoped-обновление своих задач/сделок.
const EMPLOYEE_PERMS = [
  'company:read',
  'user:read:own','user:update:own',
  'member:read:own',
  'department:read',
  'counterparty:read',
  'counterparty:create','counterparty:update:own',
  'deal:read','deal:create','deal:update:own',
  'task:read','task:create','task:update:own',
  'contact:read','contact:read:own','contact:create','contact:update:own',
  'document:read','document:create','document:update',
  'document:template:read',
  'product:read',
  'category:read','brand:read','attribute:read','product_type:read','variant:read',
  'collection:read','tag:read','channel:read','price_list:read',
  'uom:read','tax_category:read','shipping_class:read',
  'offer:read',
  'order:read',
  'note:read','note:create','note:update',
  'chat.read','chat.write','chat:read','chat:write',
  'file:read','file:upload',
  'attachment:read','attachment:upload',
  'notification:read',
  'workspace_view:read','workspace_view:create','workspace_view:update',
  'wms:read',
  'wms:inventory:read',
  'wms:reports:read'
];

// Read-only роль: никаких create/update/delete/manage/assign.
const VIEWER_PERMS = [
  'company:read',
  'user:read',
  'member:read',
  'department:read',
  'counterparty:read',
  'deal:read',
  'task:read',
  'contact:read',
  'document:read','document:template:read',
  'product:read',
  'category:read','brand:read','attribute:read','product_type:read','variant:read',
  'collection:read','tag:read','channel:read','price_list:read',
  'uom:read','tax_category:read','shipping_class:read',
  'offer:read',
  'order:read',
  'note:read',
  'chat.read','chat:read',
  'file:read',
  'attachment:read',
  'audit:read',
  'notification:read',
  'workspace_view:read',
  'wms:read',
  'wms:inventory:read',
  'wms:reports:read'
];

// Дополнительный набор для руководителя департамента:
// доступ к сущностям в пределах dept-скоупа.
module.exports.DEPT_HEAD_PERMS = [
  'deal:read:dept','deal:update:dept',
  'task:read:dept','task:update:dept',
  'user:read:dept','member:read:dept'
];

// Дефолтное сопоставление role -> permissions.
// Используется при bootstrap/инициализации ACL для новых компаний.
module.exports.DEFAULT_ROLE_SETS = {
  owner: OWNER_PERMS,
  admin: ADMIN_PERMS,
  manager: MANAGER_PERMS,
  employee: EMPLOYEE_PERMS,
  viewer: VIEWER_PERMS
};

module.exports.DEFAULT_ROLE_META = {
  owner: { slug: 'owner', name: 'owner', isSystem: true, isDefault: true },
  admin: { slug: 'admin', name: 'admin', isSystem: true, isDefault: true },
  manager: { slug: 'manager', name: 'manager', isSystem: false, isDefault: true },
  employee: { slug: 'employee', name: 'employee', isSystem: false, isDefault: true },
  viewer: { slug: 'viewer', name: 'viewer', isSystem: false, isDefault: true },
};

module.exports.KNOWN_ROLE_META = {
  ...module.exports.DEFAULT_ROLE_META,
  sales: { slug: 'sales', name: 'sales', isSystem: false, isDefault: true },
  operations: { slug: 'operations', name: 'operations', isSystem: false, isDefault: true },
  accountant: { slug: 'accountant', name: 'accountant', isSystem: false, isDefault: true },
};

module.exports.normalizeRoleSlug = (value) => String(value || '').trim().toLowerCase();

module.exports.canonicalMembershipRole = (value) => {
  const role = module.exports.normalizeRoleSlug(value);
  return role === 'user' ? 'employee' : role;
};

module.exports.getKnownRoleMeta = (value) => (
  module.exports.KNOWN_ROLE_META[module.exports.canonicalMembershipRole(value)] || null
);
