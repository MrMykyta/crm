'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('documents');

    if (!table.payment_date) {
      await queryInterface.addColumn('documents', 'payment_date', {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!table.payment_method) {
      await queryInterface.addColumn('documents', 'payment_method', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('documents');

    if (table.payment_method) {
      await queryInterface.removeColumn('documents', 'payment_method');
    }

    if (table.payment_date) {
      await queryInterface.removeColumn('documents', 'payment_date');
    }
  },
};
