'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('contacts');

    if (!table.email) {
      await queryInterface.addColumn('contacts', 'email', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!table.phone) {
      await queryInterface.addColumn('contacts', 'phone', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }

    const indexes = await queryInterface.showIndex('contacts');
    const hasIndex = indexes.some((idx) => idx.name === 'contacts_company_is_primary_idx');
    if (!hasIndex) {
      await queryInterface.addIndex('contacts', ['company_id', 'is_primary'], {
        name: 'contacts_company_is_primary_idx',
      });
    }
  },

    // Откатывает изменения, внесённые в up().
async down(queryInterface) {
    const indexes = await queryInterface.showIndex('contacts');
    const hasIndex = indexes.some((idx) => idx.name === 'contacts_company_is_primary_idx');
    if (hasIndex) {
      await queryInterface.removeIndex('contacts', 'contacts_company_is_primary_idx');
    }

    const table = await queryInterface.describeTable('contacts');
    if (table.phone) {
      await queryInterface.removeColumn('contacts', 'phone');
    }
    if (table.email) {
      await queryInterface.removeColumn('contacts', 'email');
    }
  },
};

