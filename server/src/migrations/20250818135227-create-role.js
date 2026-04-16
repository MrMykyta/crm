'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    await queryInterface.createTable('roles', {
      id: {
        type: Sequelize.UUID,
        primaryKey: true,
        defaultValue: Sequelize.UUIDV4
      },
      companyId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        field: 'company_id'
      },
      name: { 
        type: Sequelize.STRING(64), 
        allowNull: false 
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
    // Откатывает изменения, внесённые в up().
async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('roles');
  }
};
