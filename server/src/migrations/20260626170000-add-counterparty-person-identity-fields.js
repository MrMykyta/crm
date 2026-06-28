'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable('counterparties');

      if (!table.pesel) {
        await queryInterface.addColumn('counterparties', 'pesel', {
          type: Sequelize.STRING(11),
          allowNull: true,
        }, { transaction });
      }

      if (!table.birth_date) {
        await queryInterface.addColumn('counterparties', 'birth_date', {
          type: Sequelize.DATEONLY,
          allowNull: true,
        }, { transaction });
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const table = await queryInterface.describeTable('counterparties');

      if (table.birth_date) {
        await queryInterface.removeColumn('counterparties', 'birth_date', { transaction });
      }

      if (table.pesel) {
        await queryInterface.removeColumn('counterparties', 'pesel', { transaction });
      }
    });
  },
};
