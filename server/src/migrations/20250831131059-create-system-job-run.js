'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_job_runs', {
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
      jobId: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'job_id',
        references:{ 
          model:'system_jobs', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      status: { 
        type:Sequelize.ENUM('running','success','failed'), 
        allowNull:false 
      },
      startedAt: { 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.fn('now'), 
        field:'started_at' 
      },
      finishedAt: { 
        type:Sequelize.DATE, 
        allowNull:true, 
        field:'finished_at' 
      },
      errorMessage: { 
        type:Sequelize.TEXT, 
        allowNull:true, 
        field:'error_message' 
      }
    });
    await queryInterface.addIndex('system_job_runs', ['company_id','status','started_at'], { 
      name:'idx_system_job_runs_company_status_started' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('system_job_runs');
  }
};