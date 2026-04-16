'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('files', 'owner_id', {
      type: Sequelize.STRING(64),
      allowNull: false,
    });
  },
    // Откатывает изменения, внесённые в up().
async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('files', 'owner_id', {
      type: Sequelize.UUID,
      allowNull: false,
    });
  },
};

