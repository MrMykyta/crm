'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = 'orders';
    const table = await queryInterface.describeTable(tableName);

    const addColumnIfMissing = async (columnName, definition) => {
      if (!table[columnName]) {
        await queryInterface.addColumn(tableName, columnName, definition);
      }
    };

    await addColumnIfMissing('number', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await addColumnIfMissing('contact_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'contacts', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('owner_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('notes', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('payment_terms', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('delivery_terms', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
    await addColumnIfMissing('lead_time', {
      type: Sequelize.STRING(128),
      allowNull: true,
    });
    await addColumnIfMissing('source_type', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });
    await addColumnIfMissing('source_id', {
      type: Sequelize.UUID,
      allowNull: true,
    });
    await addColumnIfMissing('source_offer_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'offers', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('created_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await addColumnIfMissing('updated_by', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    const indexes = await queryInterface.showIndex(tableName);
    const hasIndex = (name) => indexes.some((idx) => idx.name === name);

    if (!hasIndex('orders_company_number_uniq')) {
      await queryInterface.addIndex(tableName, ['company_id', 'number'], {
        name: 'orders_company_number_uniq',
        unique: true,
      });
    }
    if (!hasIndex('orders_company_source_offer_idx')) {
      await queryInterface.addIndex(tableName, ['company_id', 'source_offer_id'], {
        name: 'orders_company_source_offer_idx',
      });
    }
  },

  async down(queryInterface) {
    const tableName = 'orders';
    const indexesToDrop = ['orders_company_number_uniq', 'orders_company_source_offer_idx'];
    for (const indexName of indexesToDrop) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.removeIndex(tableName, indexName);
      } catch (_error) {
        // noop
      }
    }
  },
};

