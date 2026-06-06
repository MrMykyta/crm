'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('shipments', 'number', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addIndex('shipments', ['company_id', 'number'], {
      name: 'shipments_company_number_uniq',
      unique: true,
      where: {
        number: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('shipments', 'shipments_company_number_uniq');
    await queryInterface.removeColumn('shipments', 'number');
  },
};
