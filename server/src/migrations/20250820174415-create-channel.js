'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channels', {
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
      type: { 
        type: Sequelize.ENUM('shop','marketplace','b2b','feed','custom'), 
        allowNull: false, 
        defaultValue: 'shop' 
      },
      isActive: { 
        type: Sequelize.BOOLEAN, 
        allowNull: false, 
        defaultValue: true, 
        field: 'is_active' 
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

    await queryInterface.addConstraint('channels', { 
      fields:['company_id','code'], 
      type:'unique', 
      name:'uniq_channel_company_code' 
    });

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('channels');
  }
};