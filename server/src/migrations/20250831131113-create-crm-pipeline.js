'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('crm_pipelines', {
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
      description: { 
        type:Sequelize.TEXT, 
        allowNull:true 
      },
      isDefault: { 
        type:Sequelize.BOOLEAN, 
        allowNull:false, 
        defaultValue:false, 
        field:'is_default' 
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
    await queryInterface.addIndex('crm_pipelines', ['company_id','is_default'], { 
      name:'idx_crm_pipelines_company_default' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('crm_pipelines');
  }
};