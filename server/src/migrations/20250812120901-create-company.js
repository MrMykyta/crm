'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('companies', {
      id: {
        allowNull: false,
        primaryKey: true,
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4
      },
      name: {
        type: Sequelize.STRING(200),
        allowNull: false
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
      website: {
        type: Sequelize.STRING(2048),
        allowNull: true
      },
      street: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      postalCode: {
        type: Sequelize.STRING(6),
        allowNull: true,
        field: 'postal_code'
      },
      city: {
        type: Sequelize.STRING(128),
        allowNull: true
      },
      country: {
        type: Sequelize.STRING(2),
        allowNull: true
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      ownerUserId: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        field: 'owner_user_id'
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'created_at',
        defaultValue: Sequelize.NOW
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE,
        field: 'updated_at',
        defaultValue: Sequelize.NOW
      },
      deletedAt: {
        type: Sequelize.DATE,
        field: 'deleted_at',
        allowNull: true
      }
    });

    await queryInterface.addIndex('companies', ['nip'], {
      unique: true,
      name: 'companies_nip_unique',
      where: { nip: { [Sequelize.Op.ne]: null } }
    });

    await queryInterface.addIndex('companies', ['krs'], {
      unique: true,
      name: 'companies_krs_unique',
      where: { krs: { [Sequelize.Op.ne]: null } }
    });

    await queryInterface.addIndex('companies', ['regon'], {
      unique: true,
      name: 'companies_regon_unique',
      where: { regon: { [Sequelize.Op.ne]: null } }
    });

    await queryInterface.addIndex('companies', ['created_at'], {
      name: 'companies_created_at_idx'
    });

    await queryInterface.addIndex('companies', ['owner_user_id'], {
       name: 'companies_owner_idx' 
    });


  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('companies', 'companies_nip_unique');
    await queryInterface.removeIndex('companies', 'companies_krs_unique');
    await queryInterface.removeIndex('companies', 'companies_regon_unique');
    await queryInterface.removeIndex('companies', 'companies_created_at_idx');
    await queryInterface.removeIndex('companies', 'companies_owner_idx');
    await queryInterface.dropTable('companies');
  }
};