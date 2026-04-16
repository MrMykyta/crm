'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('contacts');

    if (!table.avatar_url && !table.avatarUrl) {
      await queryInterface.addColumn('contacts', 'avatar_url', {
        type: Sequelize.STRING(512),
        allowNull: true,
      });
    }
  },

    // Откатывает изменения, внесённые в up().
async down(queryInterface) {
    const table = await queryInterface.describeTable('contacts');
    if (table.avatar_url) {
      await queryInterface.removeColumn('contacts', 'avatar_url');
    }
  },
};

