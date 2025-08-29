'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_items', {
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
      warehouseId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'warehouse_id',
        references:{ 
          model:'warehouses', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      locationId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'location_id',
        references:{ 
          model:'locations', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
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
      qtyOnHand:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        defaultValue:0, 
        field:'qty_on_hand' 
      },
      qtyReserved:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        defaultValue:0, 
        field:'qty_reserved' 
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
      },
    });
    await queryInterface.addIndex('inventory_items', ['warehouse_id']);
    await queryInterface.addIndex('inventory_items', ['location_id']);
    await queryInterface.addIndex('inventory_items', ['product_id']);
    await queryInterface.addIndex('inventory_items', ['variant_id']);
    await queryInterface.addIndex('inventory_items', ['lot_id']);
    await queryInterface.addIndex('inventory_items', ['serial_id']);
    await queryInterface.addConstraint('inventory_items', {
      fields:['location_id','product_id','variant_id','lot_id','serial_id'],
      type:'unique', 
      name:'uniq_invitem_loc_prod_variant_lot_serial'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('inventory_items');
  }
};