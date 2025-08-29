'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('counterparties', {
      id: {
        type: Sequelize.UUID, 
        allowNull: false, 
        primaryKey: true, 
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
      holdingId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'counterparties', 
          key: 'id' 
        },
        onUpdate: 'SET NULL', 
        onDelete: 'SET NULL',
        field: 'holding_id'
      },
      departmentId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'company_departments', 
          key: 'id' 
        },
        onUpdate: 'SET NULL', 
        onDelete: 'SET NULL',
        field: 'department_id'
      },
      mainResponsibleUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'SET NULL', 
        onDelete: 'SET NULL',
        field: 'main_responsible_user_id'
      },
      fullName: {
        type: Sequelize.STRING(200),
        allowNull: false,
        field: 'full_name'
      },
      shortName: {
        type: Sequelize.STRING(200),
        allowNull: false,
        field:'short_name'
      },
      nip: {
        type: Sequelize.STRING(10),
        allowNull: true
      },
      regon: {
        type: Sequelize.STRING(14),
        allowNull: true
      },
      krs: {
        type: Sequelize.STRING(14),
        allowNull: true,
      },
      bdo: {
        type: Sequelize.STRING(30),
        allowNull: true
      },
      type: {
        type: Sequelize.ENUM('lead','client','partner','supplier','manufacturer'), 
        allowNull: false, 
        defaultValue: 'lead'
      },
      status: {
        type: Sequelize.ENUM('potential','active','inactive'), 
        allowNull: false, 
        defaultValue: 'potential'
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: true
      },
      city: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      postalCode: {
        type: Sequelize.STRING(6),
        allowNull: true,
        field: 'postal_code'
      },
      street: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      isCompany: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_company'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'SET NULL', 
        onDelete: 'SET NULL',
        field: 'created_by'
      },
      updatedBy: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'SET NULL', 
        onDelete: 'SET NULL',
        field: 'updated_by'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        field: 'created_at'
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
        field: 'updated_at'
      },
      deletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
        field: 'deleted_at'
      }
    });

    await queryInterface.addConstraint('counterparties', {
      fields: ['company_id','type','nip'],
      type: 'unique',
      name: 'uniq_counterparties_company'
    });

    await queryInterface.addIndex('counterparties', ['company_id','short_name'], { 
      name: 'cp_company_short_idx' 
    });
    await queryInterface.addIndex('counterparties', ['company_id','type','status'], { 
      name: 'cp_company_type_status_idx' 
    });
    await queryInterface.addIndex('counterparties', ['company_id','nip'], { 
      name: 'cp_company_nip_idx' 
    });
    await queryInterface.addIndex('counterparties', ['company_id','regon'], { 
      name: 'cp_company_regon_idx' 
    });
  
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('counterparties','cp_company_short_idx');
    await queryInterface.removeIndex('counterparties','cp_company_type_status_idx');
    await queryInterface.removeIndex('counterparties','cp_company_nip_idx');
    await queryInterface.removeIndex('counterparties','cp_company_regon_idx');
    await queryInterface.dropTable('counterparties');

    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_counterparties_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_counterparties_status";');
  }
};
