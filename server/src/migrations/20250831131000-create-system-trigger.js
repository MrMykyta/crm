'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_triggers', {
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
      workflowId: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'workflow_id',
        references:{ 
          model:'system_workflows', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      type: { 
        type:Sequelize.ENUM('event','cron','webhook'), 
        allowNull:false 
      },
      config: { 
        type:Sequelize.JSONB, 
        allowNull:false 
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
      }
    });
    await queryInterface.addIndex('system_triggers', ['company_id','type'], { 
      name:'idx_system_triggers_company_type' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_triggers');
  }
};