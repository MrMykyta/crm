'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_companies', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      userId: {
        type: Sequelize.UUID, 
        allowNull:false,
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
        allowNull:false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      role: {
        type: Sequelize.ENUM('owner','admin','manager','viewer'),
        allowNull:false, 
        defaultValue: 'viewer'
      },
      status: {
        type: Sequelize.ENUM('active','invited','suspended'),
        allowNull:false, 
        defaultValue: 'active'
      },
      joinedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.NOW,
        field: 'joined_at'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.NOW,
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.NOW,
        field: 'updated_at'
      }
    });

    await queryInterface.addConstraint('user_companies', {
      type: 'unique',
      name: 'user_company_unique',
      fields: ['user_id', 'company_id']
    });

    await queryInterface.addIndex('user_companies', ['company_id','role'], { 
      name:'uc_company_role_idx' 
    });

    await queryInterface.addIndex('user_companies', ['user_id','status'], { 
      name:'uc_user_status_idx' 
    });

  },



  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('user_companies', 'user_company_unique');
    await queryInterface.removeIndex('user_companies', 'uc_company_role_idx');
    await queryInterface.removeIndex('user_companies', 'uc_user_status_idx');
    await queryInterface.dropTable('user_companies');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_user_companies_role";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_user_companies_status";');
  }
};