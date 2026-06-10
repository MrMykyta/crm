'use strict';

// Data-migration: безопасный backfill WMS-прав для УЖЕ существующих компаний/ролей.
//
// Зачем: в Phase 1–2 в каталог (constants/permissions.js) и в default role sets
// (constants/aclDefaults.js) добавлены WMS-права. Новые компании получают их через
// bootstrapCompanyAcl, но существующие компании/роли в БД нужно догнать.
//
// Свойства миграции:
//  - ADDITIVE ONLY: только добавляет недостающие grants; ничего не удаляет.
//  - Не трогает user_permissions (кастомные override пользователей сохраняются).
//  - Idempotent: ON CONFLICT DO NOTHING (composite PK role_id+permission_id и UNIQUE name).
//  - Кастомные/неизвестные роли пропускаются (wmsDefaultsForRole → []), лишних прав нет.
//
// Реализовано на raw SQL через queryInterface (как и прочие data-миграции проекта),
// чтобы не инициализировать модельный слой внутри sequelize-cli.

const { v4: uuidv4 } = require('uuid');
const { QueryTypes } = require('sequelize');
const { WMS_PERMISSIONS, wmsDefaultsForRole } = require('../constants/wmsAclDefaults');

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;

    await sequelize.transaction(async (transaction) => {
      const now = new Date();

      // 1) Каталог: добавить недостающие WMS-права в `permissions`.
      const existingPerms = await sequelize.query(
        'SELECT id, name FROM permissions WHERE name IN (:names)',
        { replacements: { names: WMS_PERMISSIONS }, type: QueryTypes.SELECT, transaction }
      );
      const existingNames = new Set(existingPerms.map((p) => p.name));
      const missing = WMS_PERMISSIONS.filter((name) => !existingNames.has(name));

      if (missing.length) {
        await queryInterface.bulkInsert(
          'permissions',
          missing.map((name) => ({
            id: uuidv4(),
            name,
            description: null,
            created_at: now,
            updated_at: now,
          })),
          { transaction }
        );
      }

      // Перечитываем id всех WMS-прав (теперь все существуют).
      const allWmsPerms = await sequelize.query(
        'SELECT id, name FROM permissions WHERE name IN (:names)',
        { replacements: { names: WMS_PERMISSIONS }, type: QueryTypes.SELECT, transaction }
      );
      const permIdByName = new Map(allWmsPerms.map((p) => [p.name, p.id]));

      // 2) Роли всех компаний → добавить недостающие WMS-grants по default-набору роли.
      const roles = await sequelize.query(
        'SELECT id, name FROM roles',
        { type: QueryTypes.SELECT, transaction }
      );

      const rpRows = [];
      for (const role of roles) {
        const wmsPerms = wmsDefaultsForRole(role.name);
        for (const permName of wmsPerms) {
          const permissionId = permIdByName.get(permName);
          if (permissionId) {
            rpRows.push({
              role_id: role.id,
              permission_id: permissionId,
              created_at: now,
              updated_at: now,
            });
          }
        }
      }

      if (rpRows.length) {
        // ignoreDuplicates → ON CONFLICT DO NOTHING (PK role_id+permission_id).
        // Существующие (в т.ч. кастомные) grants не затрагиваются.
        await queryInterface.bulkInsert('role_permissions', rpRows, {
          transaction,
          ignoreDuplicates: true,
        });
      }
    });
  },

  async down() {
    // No-op: это additive-backfill дефолтных прав. Автоматический revoke ACL-прав
    // опасен (может снять права, которые администратор намеренно оставил), поэтому
    // откат не выполняется. При необходимости права снимаются вручную через ACL UI/API.
  },
};
