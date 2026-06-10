// Глобальный справочник всех permission-ключей системы.
// Используется для:
// - валидации прав в ACL/UI,
// - формирования дефолтных role-наборов,
// - централизованного контроля доступных действий.
module.exports.PERMISSIONS = [
  // Компания
  'company:read', 'company:update',

  // Пользователи
  'user:create', 'user:read', 'user:read:own', 'user:update', 'user:update:own', 'user:delete',

  // Участники/членство в компании
  'member:create', 'member:read', 'member:read:own', 'member:update', 'member:update:own', 'member:delete',

  // Контрагенты
  'counterparty:read','counterparty:create','counterparty:update','counterparty:delete',

  // Сделки
  'deal:read','deal:create','deal:update','deal:update:own','deal:delete',

  // Задачи
  'task:read','task:create','task:update','task:update:own','task:delete',

  // Контактные лица/точки контакта
  'contact:read', 'contact:read:own', 'contact:create','contact:update', 'contact:update:own', 'contact:delete',

  // Товары
  'product:read','product:create','product:update','product:delete',

  // Коммерческие предложения
  'offer:read','offer:create','offer:update','offer:delete','offer:convert',

  // Заказы
  'order:read','order:create','order:update','order:delete','order:from_offer','order:convert',

  // Заметки
  'note:read','note:create','note:update','note:delete',

  // Чат
  'chat.read','chat.write',
  
  // Файлы (единая файловая подсистема)
  'file:read','file:upload','file:delete',
  // Legacy-attachments: временная обратная совместимость во время миграции.
  'attachment:read','attachment:upload','attachment:delete',

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
