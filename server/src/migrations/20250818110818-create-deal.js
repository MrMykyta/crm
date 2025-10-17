'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('deals', {
      id: {
        type: Sequelize.UUID,
        allowNull: false,
        primaryKey: true,
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
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      counterpartyId: {
        type: Sequelize.UUID,
        allowNull: false,
        field: 'counterparty_id',
        references: { 
          model: 'counterparties', 
          key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      title: { 
        type: Sequelize.STRING(256), 
        allowNull: false 
      },
      description: { 
        type: Sequelize.TEXT, 
        allowNull: true 
      },
      status: {
        type: Sequelize.ENUM('new', 'in_progress', 'won', 'lost'),
        allowNull: false,
        defaultValue: 'new'
      },
      value: { 
        type: Sequelize.DECIMAL(14,2), 
        allowNull: true 
      },
      currency: { 
        type: Sequelize.STRING(8),
         allowNull: true, 
         defaultValue: 'PLN' 
      },
      responsibleId: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'responsible_id',
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'created_by',
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        field: 'updated_by',
        references: {
          model: 'users', 
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
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

    await queryInterface.addConstraint('deals', {
      fields: ['company_id','counterparty_id'],
      type: 'unique',
      name: 'uniq_deals_company'
    });

    await queryInterface.addIndex('deals', ['company_id']);
    await queryInterface.addIndex('deals', ['counterparty_id']);
    await queryInterface.addIndex('deals', ['responsible_id']);
    await queryInterface.addIndex('deals', ['status']);
    await queryInterface.addIndex('deals', ['created_at']);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('deals', ['created_at']);
    await queryInterface.removeIndex('deals', ['status']);
    await queryInterface.removeIndex('deals', ['responsible_id']);
    await queryInterface.removeIndex('deals', ['counterparty_id']);
    await queryInterface.removeIndex('deals', ['company_id']);
    await queryInterface.dropTable('deals');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_deals_status";');
  }
};