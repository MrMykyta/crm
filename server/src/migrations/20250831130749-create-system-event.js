'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_events', {
      id: { 
        type: Sequelize.UUID, 
        allowNull:false, 
        primaryKey:true, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: { 
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'company_id',
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE', 
      },
      type: { 
        type: Sequelize.STRING(128), 
        allowNull:false 
      },
      entityType: { 
        type: Sequelize.STRING(64), 
        allowNull:true, 
        field:'entity_type' 
      },
      entityId: { 
        type: Sequelize.UUID, 
        allowNull:true, 
        field:'entity_id' 
      },
      payload: { 
        type: Sequelize.JSONB, 
        allowNull:true 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.fn('now'), 
        field:'created_at' 
      }
    });
    await queryInterface.addIndex('system_events', ['company_id','type','created_at'], { 
      name:'idx_system_events_company_type_created' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_events');
  }
};