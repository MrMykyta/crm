'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    // Применяет изменения схемы/данных для этой миграции.
async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('uoms', 'symbol', {
      type: Sequelize.STRING(32),
      allowNull: true,
    });

    await queryInterface.addColumn('uoms', 'family', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'piece',
    });

    await queryInterface.addColumn('uoms', 'base_unit_code', {
      type: Sequelize.STRING(32),
      allowNull: false,
      defaultValue: 'pcs',
    });

    await queryInterface.addColumn('uoms', 'factor', {
      type: Sequelize.DECIMAL(20, 8),
      allowNull: false,
      defaultValue: 1,
    });

    await queryInterface.addColumn('uoms', 'is_default', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await queryInterface.sequelize.query(`
      UPDATE uoms
      SET
        family = CASE
          WHEN lower(code) IN ('mg', 'g', 'kg', 't') THEN 'weight'
          WHEN lower(code) IN ('ml', 'l') THEN 'volume'
          WHEN lower(code) IN ('mm', 'cm', 'm', 'km') THEN 'length'
          WHEN lower(code) IN ('cm2', 'm2') THEN 'area'
          WHEN lower(code) IN ('cm3', 'm3') THEN 'cubic'
          WHEN lower(code) IN ('sec', 'min', 'h', 'day') THEN 'time'
          WHEN lower(code) IN ('pair', 'set', 'box', 'pack', 'roll', 'pallet') THEN 'packaging'
          ELSE 'piece'
        END,
        base_unit_code = CASE
          WHEN lower(code) IN ('mg', 'g', 'kg', 't') THEN 'g'
          WHEN lower(code) IN ('ml', 'l') THEN 'ml'
          WHEN lower(code) IN ('mm', 'cm', 'm', 'km') THEN 'mm'
          WHEN lower(code) IN ('cm2', 'm2') THEN 'cm2'
          WHEN lower(code) IN ('cm3', 'm3') THEN 'cm3'
          WHEN lower(code) IN ('sec', 'min', 'h', 'day') THEN 'sec'
          ELSE lower(code)
        END,
        factor = CASE
          WHEN lower(code) = 'mg' THEN 0.001
          WHEN lower(code) = 'g' THEN 1
          WHEN lower(code) = 'kg' THEN 1000
          WHEN lower(code) = 't' THEN 1000000
          WHEN lower(code) = 'ml' THEN 1
          WHEN lower(code) = 'l' THEN 1000
          WHEN lower(code) = 'mm' THEN 1
          WHEN lower(code) = 'cm' THEN 10
          WHEN lower(code) = 'm' THEN 1000
          WHEN lower(code) = 'km' THEN 1000000
          WHEN lower(code) = 'cm2' THEN 1
          WHEN lower(code) = 'm2' THEN 10000
          WHEN lower(code) = 'cm3' THEN 1
          WHEN lower(code) = 'm3' THEN 1000000
          WHEN lower(code) = 'sec' THEN 1
          WHEN lower(code) = 'min' THEN 60
          WHEN lower(code) = 'h' THEN 3600
          WHEN lower(code) = 'day' THEN 86400
          ELSE 1
        END,
        precision = CASE
          WHEN lower(code) IN ('kg', 'l', 'm', 'm2') THEN 3
          WHEN lower(code) IN ('t', 'm3') THEN 6
          ELSE 0
        END,
        symbol = CASE
          WHEN lower(code) = 'mg' THEN 'мг'
          WHEN lower(code) = 'g' THEN 'г'
          WHEN lower(code) = 'kg' THEN 'кг'
          WHEN lower(code) = 't' THEN 'т'
          WHEN lower(code) = 'ml' THEN 'мл'
          WHEN lower(code) = 'l' THEN 'л'
          WHEN lower(code) = 'mm' THEN 'мм'
          WHEN lower(code) = 'cm' THEN 'см'
          WHEN lower(code) = 'm' THEN 'м'
          WHEN lower(code) = 'km' THEN 'км'
          WHEN lower(code) = 'cm2' THEN 'см²'
          WHEN lower(code) = 'm2' THEN 'м²'
          WHEN lower(code) = 'cm3' THEN 'см³'
          WHEN lower(code) = 'm3' THEN 'м³'
          WHEN lower(code) = 'sec' THEN 'с'
          WHEN lower(code) = 'min' THEN 'мин'
          WHEN lower(code) = 'h' THEN 'ч'
          WHEN lower(code) = 'day' THEN 'дн'
          WHEN lower(code) = 'pcs' THEN 'шт.'
          ELSE code
        END,
        is_default = true
    `);

    await queryInterface.sequelize.query('ALTER TABLE uoms DROP CONSTRAINT IF EXISTS uoms_code_key');

    await queryInterface.addIndex('uoms', ['company_id', 'family'], {
      name: 'idx_uoms_company_family',
    });
    await queryInterface.addIndex('uoms', ['company_id', 'is_active'], {
      name: 'idx_uoms_company_is_active',
    });
  },

    // Откатывает изменения, внесённые в up().
async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('uoms', 'idx_uoms_company_is_active');
    await queryInterface.removeIndex('uoms', 'idx_uoms_company_family');

    await queryInterface.removeColumn('uoms', 'is_default');
    await queryInterface.removeColumn('uoms', 'factor');
    await queryInterface.removeColumn('uoms', 'base_unit_code');
    await queryInterface.removeColumn('uoms', 'family');
    await queryInterface.removeColumn('uoms', 'symbol');

    await queryInterface.addConstraint('uoms', {
      fields: ['code'],
      type: 'unique',
      name: 'uoms_code_key',
    });
  },
};

