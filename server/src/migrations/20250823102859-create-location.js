'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('locations', {
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
      code:{ 
        type:Sequelize.STRING(64), 
        allowNull:false 
      },
      type:{ 
        type:Sequelize.ENUM('inbound','pick','bulk','buffer','staging','outbound'), 
        allowNull:false, 
        defaultValue:'bulk' 
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
    await queryInterface.addIndex('locations', ['warehouse_id']);
    await queryInterface.addConstraint('locations', { 
      fields:['warehouse_id','code'], 
      type:'unique', 
      name:'uniq_location_in_wh' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('locations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_locations_type";');
  }
};