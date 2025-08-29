'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('price_lists', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey: true,
        allowNull: false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'company_id',
        references: { 
          model: 'companies', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      code: { 
        type: Sequelize.STRING(64), 
        allowNull: false 
      },
      name: { 
        type: Sequelize.STRING(160), 
        allowNull: false 
      },
      currency: { 
        type: Sequelize.STRING(3), 
        allowNull: false, 
        defaultValue: 'PLN' 
      },
      type: { 
        type: Sequelize.ENUM('base','b2b','b2c','promo','wholesale'), 
        allowNull: false, 
        defaultValue: 'base' 
      },
      isActive: { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: true, 
        field: 'is_active' 
      },
      startAt: { 
        type: Sequelize.DATE, 
        field: 'start_at' 
      },
      endAt: { 
        type: Sequelize.DATE, 
        field: 'end_at' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      }
    });

    await queryInterface.addIndex('price_lists', ['company_id']);
    await queryInterface.addConstraint('price_lists', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_pricelist_company_code' 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('price_lists');
  }
};