'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('stock_moves', {
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
      type:{ 
        type:Sequelize.ENUM('receipt','putaway','pick','pack','ship','adjustment','transfer'), 
        allowNull:false 
      },
      warehouseId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'warehouse_id', 
        references:{ 
          model:'warehouses', 
          key:'id' 
        } 
      },
      fromLocationId:{ 
        type:Sequelize.UUID, 
        field:'from_location_id', 
        references:{ 
          model:'locations', 
          key:'id' 
        } 
      },
      toLocationId:{ 
        type:Sequelize.UUID, 
        field:'to_location_id', 
        references:{ 
          model:'locations', 
          key:'id' 
        } 
      },
      productId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'product_id' 
      },
      variantId:{ 
        type:Sequelize.UUID, 
        field:'variant_id' 
      },
      lotId:{ 
        type:Sequelize.UUID, 
        field:'lot_id' 
      },
      serialId:{ 
        type:Sequelize.UUID, 
        field:'serial_id' 
      },
      qty:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false 
      },
      refType:{ 
        type:Sequelize.STRING(32), 
        field:'ref_type' 
      },
      refId:{ 
        type:Sequelize.UUID, 
        field:'ref_id' 
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
    await queryInterface.addIndex('stock_moves', ['warehouse_id']);
    await queryInterface.addIndex('stock_moves', ['from_location_id']);
    await queryInterface.addIndex('stock_moves', ['to_location_id']);
    await queryInterface.addIndex('stock_moves', ['product_id']);
    await queryInterface.addIndex('stock_moves', ['ref_type','ref_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('stock_moves');
  }
};