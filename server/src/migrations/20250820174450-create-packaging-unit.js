'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('packaging_units', {
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
      level:{ 
        type:Sequelize.ENUM('unit','inner','case','pallet'), 
        allowNull:false 
      },
      quantity:{ 
        type:Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:1 
      },
      gtin14:{ 
        type:Sequelize.STRING(20) 
      },
      weight:{ 
        type:Sequelize.DECIMAL(12,3) 
      }, 
      length:{ 
        type:Sequelize.DECIMAL(12,3) 
      }, 
      width:{ 
        type:Sequelize.DECIMAL(12,3) 
      }, 
      height:{ 
        type:Sequelize.DECIMAL(12,3) 
      },
      uomId:{ 
        type:Sequelize.UUID, 
        field:'uom_id', 
        references:{ 
          model:'uoms', 
          key:'id' 
        }, 
        onDelete:'SET NULL', 
        onUpdate:'CASCADE' 
      },
      createdAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue:Sequelize.NOW 
      },
      updatedAt:{ 
        type:Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue:Sequelize.NOW
      }
    });
    await queryInterface.addIndex('packaging_units', ['company_id','product_id','variant_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('packaging_units');
  }
};