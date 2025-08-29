'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_external_refs', {
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
        onDelete:'CASCADE', 
        onUpdate:'CASCADE' 
      },
      productId:{ 
        type:Sequelize.UUID, 
        field:'product_id',
        references:{ 
          model:'products', 
          key:'id' 
        }, 
        onDelete:'CASCADE', 
        onUpdate:'CASCADE' 
      },
      variantId:{ 
        type:Sequelize.UUID, 
        field:'variant_id',
        references:{ 
          model:'product_variants', 
          key:'id' 
        }, 
        onDelete:'CASCADE', 
        onUpdate:'CASCADE' 
      },
      system:{ 
        type:Sequelize.STRING(64), 
        allowNull:false 
      },            // 'allegro','idosell','erp','bybit' :)
      externalId:{ 
        type:Sequelize.STRING(160), 
        allowNull:false, 
        field:'external_id' 
      },
      data:{ 
        type:Sequelize.JSONB 
      },
      createdAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue:Sequelize.fn('NOW') 
      },
      updatedAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue:Sequelize.fn('NOW') 
      }
    });

    await queryInterface.addConstraint('product_external_refs', {
      fields:['company_id','system','external_id'],
      type:'unique', 
      name:'uniq_product_external_system_id'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_external_refs');
  }
};