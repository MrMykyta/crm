'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    /**
     * Add altering commands here.
     *
     * Example:
     * await queryInterface.createTable('users', { id: Sequelize.INTEGER });
     */
    await queryInterface.addColumn('deals','pipeline_id',{ 
      type:Sequelize.UUID, 
      allowNull:true,
      references:{ 
        model:'crm_pipelines', 
        key:'id' 
      }, 
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
    });
    await queryInterface.addColumn('deals','stage_id',{ 
      type:Sequelize.UUID, 
      allowNull:true,
      references:{ 
        model:'crm_pipeline_stages', 
        key:'id' 
      }, 
      onUpdate:'CASCADE', 
      onDelete:'SET NULL' 
    });
    await queryInterface.addColumn('deals','stage_entered_at',{ 
      type:Sequelize.DATE, 
      allowNull:true,
    });
    await queryInterface.addIndex('deals',['pipeline_id','stage_id'],{ 
      name:'idx_deals_pipeline_stage' 
    });
  },

  async down (queryInterface, Sequelize) {
    /**
     * Add reverting commands here.
     *
     * Example:
     * await queryInterface.dropTable('users');
     */
    await queryInterface.removeIndex('deals','idx_deals_pipeline_stage');
    await queryInterface.removeColumn('deals','stage_entered_at');
    await queryInterface.removeColumn('deals','stage_id');
    await queryInterface.removeColumn('deals','pipeline_id');
  }
};
