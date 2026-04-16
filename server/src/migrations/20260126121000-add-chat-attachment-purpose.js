'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_files_purpose\" ADD VALUE IF NOT EXISTS 'chat_attachment';"
    );
  },
    // Откатывает изменения, внесённые в up().
async down() {
    // enum value removal is not supported safely; no-op
  },
};

