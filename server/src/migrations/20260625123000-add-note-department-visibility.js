'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = 'enum_notes_visibility'
              AND e.enumlabel = 'department'
          ) THEN
            ALTER TYPE "enum_notes_visibility" ADD VALUE 'department';
          END IF;
        END $$;
      `, { transaction });

      const table = await queryInterface.describeTable('notes');

      if (!table.visibility_department_id) {
        await queryInterface.addColumn('notes', 'visibility_department_id', {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'company_departments', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'SET NULL',
        }, { transaction });
      }

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS notes_company_visibility_idx
        ON notes (company_id, visibility)
      `, { transaction });

      await queryInterface.sequelize.query(`
        CREATE INDEX IF NOT EXISTS notes_company_visibility_department_idx
        ON notes (company_id, visibility_department_id)
      `, { transaction });
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS notes_company_visibility_department_idx', { transaction });
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS notes_company_visibility_idx', { transaction });

      const table = await queryInterface.describeTable('notes');
      if (table.visibility_department_id) {
        await queryInterface.removeColumn('notes', 'visibility_department_id', { transaction });
      }
    });
  },
};
