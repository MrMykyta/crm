// WMS ACL backfill policy — единый источник правды для синхронизации WMS-прав
// по уже существующим компаниям/ролям.
//
// Используется одновременно:
//  - data-миграцией (backfill для существующих компаний),
//  - сервисом aclSyncService + script `npm run acl:sync:wms` (ручной повторный запуск),
//  - smoke-проверкой.
//
// Принципы:
//  - ADDITIVE ONLY: здесь описано, какие WMS-права роль ДОЛЖНА иметь по умолчанию.
//    Потребители только ДОБАВЛЯют недостающие права и НИКОГДА не удаляют существующие.
//  - Для неизвестных/кастомных ролей возвращается пустой набор → мы не выдаём лишних прав.
//  - manager/employee/user наследуют WMS-подмножество напрямую из DEFAULT_ROLE_SETS,
//    поэтому набор всегда совпадает с aclDefaults.js и не дублируется руками.

const { PERMISSIONS } = require('./permissions');
const { DEFAULT_ROLE_SETS } = require('./aclDefaults');

// Полный каталог WMS-прав (берём из глобального справочника permissions.js).
const WMS_PERMISSIONS = PERMISSIONS.filter((name) => name.startsWith('wms:'));

// Read-only WMS-набор для viewer/finance и сотрудников.
const WMS_READONLY = ['wms:read', 'wms:inventory:read', 'wms:reports:read'];

// finance: read-only + управление себестоимостью (costing), без операций со складом.
const WMS_FINANCE = [...WMS_READONLY, 'wms:costing:manage'];

const wmsSet = new Set(WMS_PERMISSIONS);

/**
 * Возвращает набор WMS-прав, который роль должна иметь по умолчанию.
 * Имя роли нормализуется в нижний регистр.
 *
 * - owner / admin            → все WMS-права (из DEFAULT_ROLE_SETS = весь каталог)
 * - manager                  → операционный WMS-набор (из DEFAULT_ROLE_SETS.manager)
 * - employee / user          → read-only WMS-набор (из DEFAULT_ROLE_SETS.employee)
 * - viewer                   → read-only WMS-набор (роль может отсутствовать)
 * - finance                  → read-only + costing:manage (роль может отсутствовать)
 * - любая другая (кастомная) → [] (ничего не выдаём, чтобы не расширять права)
 *
 * @param {string} roleName
 * @returns {string[]}
 */
function wmsDefaultsForRole(roleName) {
  const name = String(roleName || '').trim().toLowerCase();
  if (!name) return [];

  if (name === 'viewer') return [...WMS_READONLY];
  if (name === 'finance') return [...WMS_FINANCE];

  const defaultSet = DEFAULT_ROLE_SETS[name];
  if (!defaultSet) return []; // неизвестная/кастомная роль — не трогаем

  // WMS-подмножество дефолтного набора роли (owner/admin/manager/employee/user).
  return defaultSet.filter((perm) => wmsSet.has(perm));
}

module.exports = {
  WMS_PERMISSIONS,
  WMS_READONLY,
  WMS_FINANCE,
  wmsDefaultsForRole,
};
