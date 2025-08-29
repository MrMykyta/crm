'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('product_attachments', {
      id: { 
        type: Sequelize.UUID, 
        allowNull:false, 
        primaryKey:true, 
        defaultValue:Sequelize.UUIDV4 
      },
      companyId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'company_id',
        references:{ 
          model:'companies', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      productId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'product_id',
        references:{ 
          model:'products', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      attachmentId: {
        type: Sequelize.UUID, 
        allowNull:false, 
        field:'attachment_id',
        references:{ 
          model:'attachments', 
          key:'id' 
        }, 
        onUpdate:'CASCADE', 
        onDelete:'CASCADE'
      },
      role: { 
        type: Sequelize.ENUM('image','manual','spec','other'), 
        allowNull:false, 
        defaultValue:'image' 
      },
      sortOrder: { 
        type: Sequelize.INTEGER, 
        allowNull:false, 
        defaultValue:0, 
        field:'sort_order' 
      },
      createdAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'created_at',
        defaultValue: Sequelize.fn('NOW')
      },
      updatedAt: { 
        type: Sequelize.DATE, 
        allowNull:false, 
        field:'updated_at',
        defaultValue: Sequelize.fn('NOW')
      }
    });

    await queryInterface.addIndex('product_attachments', ['company_id']);
    await queryInterface.addIndex('product_attachments', ['product_id']);
    await queryInterface.addIndex('product_attachments', ['attachment_id']);
    await queryInterface.addConstraint('product_attachments', {
      fields:['product_id','attachment_id'],
      type:'unique', 
      name:'uniq_product_attachment'
    });
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('product_attachments');
  }
};