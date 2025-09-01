'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_webhooks', {
      id: { 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      companyId: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field:'company_id' 
      },
      name: { 
        type:Sequelize.STRING(128), 
        allowNull:false 
      },
      url: { 
        type:Sequelize.TEXT, 
        allowNull:false 
      },
      secret: { 
        type:Sequelize.STRING(256), 
        allowNull:true 
      },
      isActive: { 
        type:Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:true, 
        field:'is_active' 
      },
      eventFilters: { 
        type:Sequelize.JSONB, 
        allowNull:true, 
        field:'event_filters' 
      },
      createdAt: { 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.fn('now'), 
        field:'created_at' 
      },
      updatedAt: { 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.fn('now'), 
        field:'updated_at' 
      },
      deletedAt: { 
        type:Sequelize.DATE, 
        allowNull:true, 
        field:'deleted_at' 
      }
    });

    await queryInterface.addIndex('system_webhooks', ['company_id','is_active'], { 
      name:'idx_system_webhooks_company_active' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_webhooks');
  }
};