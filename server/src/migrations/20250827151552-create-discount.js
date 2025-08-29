'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Discounts', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      companyId: {
        type: Sequelize.UUID
      },
      ownerType: {
        type: Sequelize.STRING
      },
      ownerId: {
        type: Sequelize.UUID
      },
      type: {
        type: Sequelize.STRING
      },
      amountNet: {
        type: Sequelize.DECIMAL
      },
      amountGross: {
        type: Sequelize.DECIMAL
      },
      metaJson: {
        type: Sequelize.JSON
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
    await queryInterface.dropTable('Discounts');
  }
};