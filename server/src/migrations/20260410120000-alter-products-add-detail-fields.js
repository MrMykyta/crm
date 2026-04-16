'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('products', 'subcategory_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'categories', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('products', 'supplier_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'counterparties', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('products', 'sale_start_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'sale_end_date', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'ean', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'pkwiu', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'cn', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'gtu', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('products', 'stock_quantity', {
      type: Sequelize.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('products', 'reserved_quantity', {
      type: Sequelize.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('products', 'ordered_quantity', {
      type: Sequelize.DECIMAL(14, 3),
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.addColumn('products', 'is_sellable', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    });

    await queryInterface.addIndex('products', ['subcategory_id'], {
      name: 'idx_products_subcategory_id',
    });
    await queryInterface.addIndex('products', ['supplier_id'], {
      name: 'idx_products_supplier_id',
    });
    await queryInterface.addIndex('products', ['sale_start_date'], {
      name: 'idx_products_sale_start_date',
    });
    await queryInterface.addIndex('products', ['sale_end_date'], {
      name: 'idx_products_sale_end_date',
    });
  },

    // Откатывает изменения, внесённые в up().
async down(queryInterface) {
    await queryInterface.removeIndex('products', 'idx_products_sale_end_date');
    await queryInterface.removeIndex('products', 'idx_products_sale_start_date');
    await queryInterface.removeIndex('products', 'idx_products_supplier_id');
    await queryInterface.removeIndex('products', 'idx_products_subcategory_id');

    await queryInterface.removeColumn('products', 'is_sellable');
    await queryInterface.removeColumn('products', 'ordered_quantity');
    await queryInterface.removeColumn('products', 'reserved_quantity');
    await queryInterface.removeColumn('products', 'stock_quantity');
    await queryInterface.removeColumn('products', 'gtu');
    await queryInterface.removeColumn('products', 'cn');
    await queryInterface.removeColumn('products', 'pkwiu');
    await queryInterface.removeColumn('products', 'ean');
    await queryInterface.removeColumn('products', 'sale_end_date');
    await queryInterface.removeColumn('products', 'sale_start_date');
    await queryInterface.removeColumn('products', 'supplier_id');
    await queryInterface.removeColumn('products', 'subcategory_id');
  },
};

