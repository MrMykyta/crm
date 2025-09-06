'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('crm_pipeline_stages', {
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
      pipelineId: { 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'pipeline_id',
        references:{ 
          model:'crm_pipelines', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      name: { 
        type:Sequelize.STRING(128), 
        allowNull:false 
      },
      probability: { 
        type:Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0 
      },
      position: { 
        type:Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0 
      },
      color: { 
        type:Sequelize.STRING(16), 
        allowNull:true 
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
    await queryInterface.addIndex('crm_pipeline_stages', ['company_id','pipeline_id','position'], { 
      name:'idx_crm_stages_company_pipeline_position' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
    'ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_stage_id_fkey";'
  );
  await queryInterface.sequelize.query(
    'ALTER TABLE "deals" DROP CONSTRAINT IF EXISTS "deals_stageId_fkey";'
  );
    await queryInterface.dropTable('crm_pipeline_stages');
  }
};