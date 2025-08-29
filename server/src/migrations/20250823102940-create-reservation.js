'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reservations', {
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
      orderId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'order_id', 
        references:{ 
          model:'orders', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      orderItemId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'order_item_id' 
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
      productId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'product_id' 
      },
      variantId:{ 
        type:Sequelize.UUID, 
        field:'variant_id' 
      },
      qty:{ 
        type:Sequelize.DECIMAL(14,4), 
        allowNull:false, 
        defaultValue:0
      },
      status:{ 
        type:Sequelize.ENUM('active','fulfilled','cancelled'), 
        allowNull:false, 
        defaultValue:'active' 
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

    await queryInterface.addIndex('reservations', ['warehouse_id']);
    await queryInterface.addIndex('reservations', ['order_id']);
    await queryInterface.addConstraint('reservations', { 
      fields:['order_id','order_item_id'], 
      type:'unique', 
      name:'uniq_reservation_order_item' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('reservations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_reservations_status";');
  }
};