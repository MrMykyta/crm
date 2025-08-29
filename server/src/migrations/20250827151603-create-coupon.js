'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Coupons', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      companyId: {
        type: Sequelize.UUID
      },
      code: {
        type: Sequelize.STRING
      },
      promotionId: {
        type: Sequelize.UUID
      },
      usageLimit: {
        type: Sequelize.INTEGER
      },
      usedCount: {
        type: Sequelize.INTEGER
      },
      validFrom: {
        type: Sequelize.DATE
      },
      validTo: {
        type: Sequelize.DATE
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
    await queryInterface.dropTable('Coupons');
  }
};