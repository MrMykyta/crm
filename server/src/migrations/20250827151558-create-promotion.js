'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('promotions', {
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
      type: { 
        type: Sequelize.ENUM('percentage','fixed','shipping_free'), 
        allowNull: false 
      },
      value: { 
        type: Sequelize.DECIMAL(12,4) 
      },
      conditionsJson: { 
        type: Sequelize.JSONB,
        field: 'conditions_json'
      },
      validFrom: { 
        type: Sequelize.DATE,
        field: 'valid_from'
      }, 
      validTo: { 
        type: Sequelize.DATE,
        field: 'valid_to'
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
    await queryInterface.addIndex('promotions', ['company_id','type'], { 
      name: 'promotions_company_type_idx' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('promotions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_promotions_type";');
  }
};