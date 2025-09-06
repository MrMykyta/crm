const { PERMISSIONS } = require('./permissions');

const OWNER_PERMS    = [...PERMISSIONS]; // полный доступ
const ADMIN_PERMS    = [...PERMISSIONS]; // можно оставить полный, либо урезать company:update/user:delete
const MANAGER_PERMS  = [
  'company:read',
  'user:read','user:update',
  'counterparty:read','counterparty:create','counterparty:update',
  'deal:read','deal:create','deal:update','deal:update:own',
  'task:read','task:create','task:update','task:update:own',
  'contact:read','contact:create','contact:update',
  'report:read'
];

const EMPLOYEE_PERMS = [
  'counterparty:read',
  'deal:read','deal:update:own',
  'task:read','task:create','task:update:own',
  'contact:read'
];
module.exports.DEPT_HEAD_PERMS = [
  'deal:read:dept','deal:update:dept',
  'task:read:dept','task:update:dept',
  'user:read:dept','member:read:dept' // опционально
];

module.exports.DEFAULT_ROLE_SETS = {
  owner: OWNER_PERMS,
  admin: ADMIN_PERMS,
  manager: MANAGER_PERMS,
  user: EMPLOYEE_PERMS
};
