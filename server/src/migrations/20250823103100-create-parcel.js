'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('parcels', {
      id:{ 
        type:Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue:Sequelize.UUIDV4 
      },
      shipmentId:{ 
        type:Sequelize.UUID, 
        allowNull:false, 
        field:'shipment_id',
        references:{ 
          model:'shipments', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE' 
      },
      carrier:{ 
        type:Sequelize.STRING(64) 
      },
      trackingNumber:{ 
        type:Sequelize.STRING(128), 
        field:'tracking_number' 
      },
      weight:{ 
        type:Sequelize.DECIMAL(12,3) 
      },
      dims:{ 
        type:Sequelize.JSONB 
      },
      createdAt:{
        type: Sequelize.DATE, 
        field:'created_at', 
        defaultValue:Sequelize.NOW
      },
      updatedAt:{ 
        type: Sequelize.DATE, 
        field:'updated_at', 
        defaultValue:Sequelize.NOW
      }
    });
    await queryInterface.addIndex('parcels', ['shipment_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('parcels');
  }
};