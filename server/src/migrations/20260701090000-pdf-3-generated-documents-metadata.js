'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const documents = await queryInterface.describeTable('documents');

    if (!documents.file_id) {
      await queryInterface.addColumn('documents', 'file_id', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'files', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!documents.generated_at) {
      await queryInterface.addColumn('documents', 'generated_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    if (!documents.generated_by) {
      await queryInterface.addColumn('documents', 'generated_by', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
    }

    if (!documents.template_version_id) {
      await queryInterface.addColumn('documents', 'template_version_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
    }

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_enum
          WHERE enumlabel = 'document'
            AND enumtypid = (
              SELECT oid
              FROM pg_type
              WHERE typname = 'enum_files_owner_type'
            )
        ) THEN
          ALTER TYPE "enum_files_owner_type" ADD VALUE 'document';
        END IF;
      END
      $$;
    `);

    await queryInterface.addIndex('documents', ['company_id', 'source_entity_type', 'source_entity_id'], {
      name: 'documents_company_source_entity_idx',
    }).catch((error) => {
      if (error?.name !== 'SequelizeDatabaseError') throw error;
    });

    await queryInterface.addIndex('documents', ['file_id'], {
      name: 'documents_file_id_idx',
    }).catch((error) => {
      if (error?.name !== 'SequelizeDatabaseError') throw error;
    });
  },

  async down(queryInterface) {
    const documents = await queryInterface.describeTable('documents');

    await queryInterface.removeIndex('documents', 'documents_file_id_idx').catch(() => {});
    await queryInterface.removeIndex('documents', 'documents_company_source_entity_idx').catch(() => {});

    if (documents.template_version_id) {
      await queryInterface.removeColumn('documents', 'template_version_id');
    }
    if (documents.generated_by) {
      await queryInterface.removeColumn('documents', 'generated_by');
    }
    if (documents.generated_at) {
      await queryInterface.removeColumn('documents', 'generated_at');
    }
    if (documents.file_id) {
      await queryInterface.removeColumn('documents', 'file_id');
    }
  },
};
