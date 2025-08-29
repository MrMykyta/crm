'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('company_departments', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      },
      deletedAt: {
        type: Sequelize.DATE,
        field: 'deleted_at',
        allowNull: true
      }
    });

    await queryInterface.addConstraint('company_departments', {
      fields: ['company_id','name'],
      type: 'unique',
      name: 'company_departments_company_name_uq'
    });

    await queryInterface.addIndex('company_departments', ['company_id'], { 
      name: 'cd_company_idx' 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('company_departments', 'company_departments_company_name_uq');
    await queryInterface.removeIndex('company_departments', 'cd_company_idx');
    await queryInterface.dropTable('company_departments');
  }
};