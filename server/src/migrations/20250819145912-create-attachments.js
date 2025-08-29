'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('attachments', {
      id: { 
        type: Sequelize.UUID, 
        primaryKey:true, 
        allowNull:false, 
        defaultValue: Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull:false,
        references: { 
          model: 'companies', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'CASCADE',
        field: 'company_id'
      },
      ownerType: {
        type: Sequelize.ENUM('counterparty','deal','task','order','offer','product','contact','user','company','department'),
        allowNull:false,
        field: 'owner_type'
      },
      ownerId: { 
        type: Sequelize.UUID, 
        allowNull:false,
        field: 'owner_id'
      },
      filename: { 
        type: Sequelize.STRING(255), 
        allowNull:false 
      },
      mime: { 
        type: Sequelize.STRING(128), 
        allowNull:false 
      },
      size: { 
        type: Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0 
      },
      storagePath: { 
        type: Sequelize.STRING(512), 
        allowNull:false,
        field:'storage_path'
      },
      uploadedBy: {
        type: Sequelize.UUID, 
        allowNull:false,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'uploaded_by'
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'created_at'
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        defaultValue: Sequelize.fn('NOW'),
        field: 'updated_at'
      },
      deletedAt: { 
        type: Sequelize.DATE, 
        allowNull:true,
        field: 'deleted_at'
      }
    });

    await queryInterface.addIndex('attachments', ['company_id','owner_type','owner_id'], { 
      name: 'idx_attachments_owner' 
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('attachments', 'idx_attachments_owner');
    await queryInterface.dropTable('attachments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_attachments_owner_type";');
  }
};