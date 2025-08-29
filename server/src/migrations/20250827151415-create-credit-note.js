'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CreditNotes', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      invoiceId: {
        type: Sequelize.UUID
      },
      amountNet: {
        type: Sequelize.DECIMAL
      },
      amountTax: {
        type: Sequelize.DECIMAL
      },
      amountGross: {
        type: Sequelize.DECIMAL
      },
      reason: {
        type: Sequelize.STRING
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('CreditNotes');
  }
};