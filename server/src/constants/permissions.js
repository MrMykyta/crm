// Глобальный справочник всех permission-ключей системы.
// Используется для:
// - валидации прав в ACL/UI,
// - формирования дефолтных role-наборов,
// - централизованного контроля доступных действий.
module.exports.PERMISSIONS = [
  // Компания
  'company:read', 'company:update', 'company:delete',
  'company:settings:read', 'company:settings:update',

  // Системные настройки
  'settings:read', 'settings:update',

  // Пользователи
  'user:create', 'user:read', 'user:read:own', 'user:read:dept',
  'user:update', 'user:update:own', 'user:delete', 'user:invite', 'user:deactivate',

  // Участники/членство в компании
  'member:create', 'member:read', 'member:read:own', 'member:read:dept',
  'member:update', 'member:update:own', 'member:delete', 'member:invite',

  // ACL
  'role:read', 'role:create', 'role:update', 'role:delete', 'role:assign',
  'permission:read', 'permission:assign', 'permission:manage',

  // Отделы
  'department:read', 'department:create', 'department:update', 'department:delete',

  // Контрагенты
  'counterparty:read','counterparty:read:own','counterparty:read:dept',
  'counterparty:create','counterparty:update','counterparty:update:own','counterparty:update:dept','counterparty:delete',

  // Сделки
  'deal:read','deal:read:dept','deal:create','deal:update','deal:update:own','deal:update:dept','deal:delete',
  'deal:pipeline:read','deal:pipeline:manage',

  // Задачи
  'task:read','task:read:dept','task:create','task:update','task:update:own','task:update:dept','task:delete',

  // Контактные лица/точки контакта
  'contact:read', 'contact:read:own', 'contact:create','contact:update', 'contact:update:own', 'contact:delete',

  // Документы и шаблоны
  'document:read','document:create','document:update','document:delete',
  'document:template:read','document:template:manage',

  // Товары
  'product:read','product:create','product:update','product:delete','product:publish','product:archive','product:duplicate',
  'product:link:manage',

  // PIM-справочники и цены
  'category:read','category:create','category:update','category:delete',
  'brand:read','brand:create','brand:update','brand:delete',
  'attribute:read','attribute:create','attribute:update','attribute:delete',
  'product_type:read','product_type:create','product_type:update','product_type:delete',
  'variant:read','variant:create','variant:update','variant:delete',
  'collection:read','collection:create','collection:update','collection:delete',
  'tag:read','tag:create','tag:update','tag:delete',
  'channel:read','channel:create','channel:update','channel:delete',
  'price_list:read','price_list:create','price_list:update','price_list:delete',
  'uom:read','uom:create','uom:update','uom:delete',
  'tax_category:read','tax_category:create','tax_category:update','tax_category:delete',
  'shipping_class:read','shipping_class:create','shipping_class:update','shipping_class:delete',

  // Коммерческие предложения
  'offer:read','offer:create','offer:update','offer:delete','offer:convert',

  // Заказы
  'order:read','order:create','order:update','order:delete','order:from_offer','order:convert',

  // Финансы/OMS catalog reserve
  'invoice:read','invoice:create','invoice:update','invoice:delete','invoice:issue','invoice:cancel',
  'payment:read','payment:create','payment:update','payment:delete',
  'shipment:read','shipment:create','shipment:update','shipment:delete',
  'return:read','return:create','return:update','return:delete',
  'credit_note:read','credit_note:create','credit_note:update','credit_note:delete',
  'discount:read','discount:create','discount:update','discount:delete',

  // Заметки
  'note:read','note:create','note:update','note:delete',

  // Чат
  'chat.read','chat.write','chat:read','chat:write','chat:moderate',
  
  // Файлы (единая файловая подсистема)
  'file:read','file:upload','file:delete',
  // Legacy-attachments: временная обратная совместимость во время миграции.
  'attachment:read','attachment:upload','attachment:delete',

  // Системные поверхности
  'audit:read',
  'notification:read','notification:create',
  'workspace_view:read','workspace_view:create','workspace_view:update','workspace_view:delete',
  'integration:read','integration:update',
  'integration:webhook:read','integration:webhook:create','integration:webhook:update','integration:webhook:delete',
  'automation:read','automation:create','automation:update','automation:delete',
  'import:run','export:run',

  // WMS
  'wms:read',
  'wms:settings:update',
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
  'wms:reports:read',
  'wms:costing:manage'
];
