// единый список всех прав в системе (глобальный справочник)
module.exports.PERMISSIONS = [
  // company
  'company:read', 'company:update',

  // users
  'user:create', 'user:read', 'user:read:own', 'user:update', 'user:update:own', 'user:delete',

  // members
  'member:create', 'member:read', 'member:read:own', 'member:update', 'member:update:own', 'member:delete',

  // counterparties
  'counterparty:read','counterparty:create','counterparty:update','counterparty:delete',

  // deals
  'deal:read','deal:create','deal:update','deal:update:own','deal:delete',

  // tasks
  'task:read','task:create','task:update','task:update:own','task:delete',

  // contact points
  'contact:read', 'contact:read:own', 'contact:create','contact:update', 'contact:update:own', 'contact:delete',

  // products
  'product:read','product:create','product:update','product:delete',

  // offers
  'offer:read','offer:create','offer:update','offer:delete','offer:convert',

  // orders
  'order:read','order:create','order:update','order:delete','order:from_offer',

  // notes
  'note:read','note:create','note:update','note:delete',
  
  // files (unified)
  'file:read','file:upload','file:delete',
  // legacy attachments (kept for compatibility while migrating)
  'attachment:read','attachment:upload','attachment:delete'
];
