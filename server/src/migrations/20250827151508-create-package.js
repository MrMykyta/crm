'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('packages', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey: true, 
        allowNull: false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      shipmentId: {
        type: Sequelize.UUID, 
        allowNull: false,
        references: { 
          model: 'shipments', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field:'shipment_id'
      },
      weight: { 
        type: Sequelize.DECIMAL(10,3) 
      },
      dimensionsJson: { 
        type: Sequelize.JSONB,
         field: 'dimensions_json' 
      },
      trackingNumber: { 
        type: Sequelize.STRING(128),
        field: 'tracking_number'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at'
      },
      deletedAt: { 
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addIndex('packages', ['shipment_id'], { 
      name: 'packages_shipment_idx' 
    });
    await queryInterface.addConstraint('packages', {
      fields: ['company_id','tracking_number'],
      type: 'unique',
      name: 'packages_company_tracking_unique'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeConstraint('packages','packages_company_tracking_unique');
    await queryInterface.dropTable('packages');
  }
};