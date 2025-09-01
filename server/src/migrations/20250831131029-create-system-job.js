'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_jobs', {
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
      payload: { 
        type:Sequelize.JSONB, 
        allowNull:true 
      },
      status: { 
        type:Sequelize.ENUM('queued','running','success','failed'), 
        allowNull:false, 
        defaultValue:'queued' 
      },
      runAt: { 
        type:Sequelize.DATE, 
        allowNull:true, 
        field:'run_at' 
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
    await queryInterface.addIndex('system_jobs', ['company_id','status','run_at'], { 
      name:'idx_system_jobs_company_status_runat' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_jobs');
  }
};