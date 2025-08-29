'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('channel_category_maps', {
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
      channelId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'channel_id',
        references: { 
          model: 'channels', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      categoryId: { 
        type: Sequelize.UUID, 
        allowNull: false, 
        field: 'category_id',
        references: { 
          model: 'categories', 
          key: 'id' 
        }, 
        onDelete: 'CASCADE', 
        onUpdate: 'CASCADE' 
      },
      externalCategoryId: { 
        type: Sequelize.STRING(160), 
        allowNull: false, 
        field: 'external_category_id' 
      },
      externalPath: { 
        type: Sequelize.STRING(1000), 
        field: 'external_path' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'created_at' 
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull: false, 
        field: 'updated_at' 
      }
    });

    await queryInterface.addConstraint('channel_category_maps', {
      fields:['channel_id','category_id'],
      type:'unique', 
      name:'uniq_channel_category'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('channel_category_maps');
  }
};