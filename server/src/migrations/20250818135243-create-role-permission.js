'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('role_permissions', {
      roleId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'roles', 
          key: 'id' 
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        field: 'role_id'
      },
      permissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'permissions', 
          key: 'id' 
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE',
        field: 'permission_id'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        field: 'created_at'
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        field: 'updated_at'
      }
    });

    await queryInterface.addConstraint('role_permissions', {
      fields: ['role_id', 'permission_id'],
      type: 'primary key',
      name: 'role_permissions_pkey'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('role_permissions');
  }
};