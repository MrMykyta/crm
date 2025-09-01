'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_webhook_deliveries', {
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
      webhookId: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'webhook_id',
        references:{ 
          model:'system_webhooks', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      eventId: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'event_id',
        references:{ 
          model:'system_events', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      status: { 
        type:Sequelize.ENUM('pending','success','failed'), 
        allowNull:false, 
        defaultValue:'pending' 
      },
      attempt: { 
        type:Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0 
      },
      nextAttemptAt: { 
        type:Sequelize.DATE, 
        allowNull:true, 
        field:'next_attempt_at' 
      },
      responseCode: { 
        type:Sequelize.INTEGER, 
        allowNull:true, 
        field:'response_code' 
      },
      errorMessage: { 
        type:Sequelize.TEXT, 
        allowNull:true, 
        field:'error_message' 
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
    await queryInterface.addIndex('system_webhook_deliveries',
      ['company_id','status','next_attempt_at'],
      { name:'idx_webhook_deliveries_retry' });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_webhook_deliveries');
  }
};