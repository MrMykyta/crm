'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('permissions', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      name: { 
        type: Sequelize.STRING(128), 
        allowNull: false, 
        unique: true 
      },
      description: { 
        type: Sequelize.STRING(256) 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        field: 'created_at', 
        defaultValue: Sequelize.NOW 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        field: 'updated_at', 
        defaultValue: Sequelize.NOW 
      }
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('permissions');
  }
};