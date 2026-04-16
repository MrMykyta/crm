'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface) {
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_notes_company_id ON notes (company_id);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_notes_owner_pair ON notes (owner_type, owner_id);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_notes_author_user ON notes (created_by);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes (created_at);'
    );
    await queryInterface.sequelize.query(
      'CREATE INDEX IF NOT EXISTS idx_notes_pinned ON notes (pinned);'
    );
  },

    // Откатывает изменения, внесённые в up().
async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_notes_pinned;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_notes_created_at;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_notes_author_user;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_notes_owner_pair;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS idx_notes_company_id;');
  },
};

