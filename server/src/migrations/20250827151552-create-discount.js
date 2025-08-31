'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('discounts', {
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
      ownerType: { 
        type: Sequelize.ENUM('offer','offerItem','order','orderItem'), 
        allowNull: false,
        field: 'owner_type'
      },
      ownerId: { 
        type: Sequelize.UUID, 
        allowNull: false,
        field: 'owner_id'
      },
      type: { 
        type: Sequelize.ENUM('manual','promotion','coupon'), 
        allowNull: false 
      },
      amountNet: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'amount_net'
      },
      amountGross: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: false, 
        defaultValue: 0,
        field: 'amount_gross'
      },
      metaJson: { 
        type: Sequelize.JSONB,
        field:'meta_json'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at' ,
        defaultValue: Sequelize.fn('NOW') 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.fn('NOW') 
      },
      deletedAt: { 
        type: Sequelize.DATE ,
        allowNull: true,
        field: 'deleted_at'
      }
    });
    await queryInterface.addIndex('discounts', ['company_id','owner_type','owner_id'], { 
      name: 'discounts_owner_idx' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('discounts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_discounts_owner_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_discounts_type";');
  }
};