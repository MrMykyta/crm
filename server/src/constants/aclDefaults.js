const { PERMISSIONS } = require('./permissions');

// Дефолтные права owner/admin:
// берём полный набор из глобального справочника permissions.
const OWNER_PERMS = [...PERMISSIONS];
const ADMIN_PERMS = [...PERMISSIONS];

// Базовый набор прав менеджера:
// CRUD по операционным сущностям + ограниченный доступ к пользователям/компании.
const MANAGER_PERMS  = [
  'company:read',
  'user:read','user:update',
  'counterparty:read','counterparty:create','counterparty:update',
  'deal:read','deal:create','deal:update','deal:update:own',
  'task:read','task:create','task:update','task:update:own',
  'contact:read','contact:create','contact:update',
  'note:read','note:create','note:update','note:delete',
  'chat.read','chat.write',
  'report:read',
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
  'counterparty:read',
  'deal:read','deal:update:own',
  'task:read','task:create','task:update:own',
  'contact:read',
  'note:read','note:create','note:update','note:delete',
  'chat.read','chat.write',
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
  user: EMPLOYEE_PERMS
};
