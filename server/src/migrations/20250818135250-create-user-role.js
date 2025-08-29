'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_roles', {
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'user_id'
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
      roleId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'roles', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'role_id'
      }
    });

    await queryInterface.addConstraint('user_roles', {
      fields: ['user_id', 'company_id', 'role_id'],
      type: 'primary key',
      name: 'user_roles_pkey'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_roles');
  }
};