'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('transfer_items', 'moved_qty', {
      type: Sequelize.DECIMAL(14, 4),
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('transfer_items', 'moved_qty');
  },
};

