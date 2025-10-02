'use strict';
/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('contact_points', {
      id: {
        type: Sequelize.UUID,
        allowNull:false, 
        primaryKey:true, 
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
        type: Sequelize.ENUM('counterparty','contact','user','company','department'),
        allowNull:false,
        field: 'owner_type'
      },
      ownerId: {
        type: Sequelize.UUID,
        allowNull:false,
        field: 'owner_id'
      },
      channel: {
        type: Sequelize.ENUM('phone','email','website','whatsapp','telegram','viber','facebook','linkedin','other'), 
        allowNull: false
      },
      valueRaw: {
        type: Sequelize.STRING(256), 
        allowNull:false,
        field: 'value_raw'
      },
      valueNorm: {
        type: Sequelize.STRING(256), 
        allowNull:true,
        field: 'value_norm'
      },
      label: {
        type: Sequelize.STRING(64), 
        allowNull:true
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        allowNull:false, 
        defaultValue: false,
        field: 'is_primary'
      },
      isPublic: {
        type: Sequelize.BOOLEAN,
        allowNull:false, 
        defaultValue: true,
        field: 'is_public'
      },
      verifiedAt: {
        type: Sequelize.DATE,
        allowNull:true,
        field:'verified_at'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull:true
      },
      createdBy: {
        type: Sequelize.UUID,
        allowNull:true,
        references: { 
          model: 'users', 
          key: 'id' 
        },
        onUpdate: 'CASCADE', 
        onDelete: 'SET NULL',
        field: 'created_by'
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

    await queryInterface.addIndex('contact_points', ['company_id','owner_type','owner_id'], { 
      name: 'cp_owner_idx' 
    });
    await queryInterface.addIndex('contact_points', ['company_id','channel','value_norm'], { 
      name: 'cp_search_idx' 
    });

    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX cp_primary_unique
      ON contact_points (company_id, owner_type, owner_id, channel)
      WHERE is_primary = true AND deleted_at IS NULL;
    `);

    // 2) добавить уникальность нормализованного значения на уровне компании+канала
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX cp_value_norm_unique
      ON contact_points (company_id, channel, value_norm)
      WHERE value_norm IS NOT NULL AND deleted_at IS NULL;
    `);

    // 3) (опционально для Postgres) быстрый поиск по подстроке
    await queryInterface.sequelize.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    await queryInterface.sequelize.query(`
      CREATE INDEX cp_trgm_value_norm_idx
      ON contact_points USING gin (value_norm gin_trgm_ops);
    `);

  },
  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS cp_trgm_value_norm_idx;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS cp_value_norm_unique;');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS cp_primary_unique;');

    await queryInterface.removeIndex('contact_points','cp_owner_idx');
    await queryInterface.removeIndex('contact_points','cp_search_idx');

    await queryInterface.dropTable('contact_points');

    // дроп ENUM после dropTable — норм
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_contact_points_owner_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_contact_points_channel";');
  }
};