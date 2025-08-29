'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('lots', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      companyId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'company_id',
        references:{ 
          model:'companies', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      productId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'product_id',
        references:{ 
          model:'products', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'RESTRICT' 
      },
      lotNumber:{ 
        type:Sequelize.STRING(64), 
        allowNull:false, 
        field:'lot_number' 
      },
      mfgDate:{ 
        type:Sequelize.DATE, 
        field:'mfg_date' 
      },
      expDate:{ 
        type:Sequelize.DATE, 
        field:'exp_date' 
      },
      createdAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.NOW, 
        field:'created_at' 
      },
      updatedAt:{
        type:Sequelize.DATE, 
        allowNull:false, 
        defaultValue:Sequelize.NOW, 
        field:'updated_at' 
      }
    });

    await queryInterface.addIndex('lots', ['product_id']);
    await queryInterface.addConstraint('lots', { 
      fields:['company_id','product_id','lot_number'], 
      type:'unique', 
      name:'uniq_lot_per_product' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('lots');
  }
};