'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_permissions', {
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
      permissionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { 
          model: 'permissions', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        field: 'permission_id'
      },
      effect: {
        type: Sequelize.ENUM('allow', 'deny'),
        defaultValue: 'allow',
        allowNull: false
      }
      
    });

    await queryInterface.addConstraint('user_permissions', {
      fields: ['user_id','company_id','permission_id'],
      type: 'primary key',
      name: 'user_permissions_pkey'
    });
  },
  
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('user_permissions');
  }
};