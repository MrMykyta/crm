'use strict';

const { Uom } = require('../../models');

const UOM_FAMILIES = Object.freeze([
  'piece',
  'weight',
  'volume',
  'length',
  'area',
  'cubic',
  'time',
  'packaging',
]);

const DEFAULT_UOMS = Object.freeze([
  // Piece
  { code: 'pcs', name: 'Штука', symbol: 'шт.', family: 'piece', baseUnitCode: 'pcs', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'szt', name: 'Sztuka', symbol: 'szt', family: 'piece', baseUnitCode: 'pcs', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'ед', name: 'Единица', symbol: 'ед.', family: 'piece', baseUnitCode: 'pcs', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'упак', name: 'Упаковка', symbol: 'упак.', family: 'piece', baseUnitCode: 'pcs', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'компл', name: 'Комплект', symbol: 'компл.', family: 'piece', baseUnitCode: 'pcs', factor: '1', precision: 0, isDefault: true, isActive: true },

  // Weight (base: g)
  { code: 'mg', name: 'Миллиграмм', symbol: 'мг', family: 'weight', baseUnitCode: 'g', factor: '0.001', precision: 0, isDefault: true, isActive: true },
  { code: 'g', name: 'Грамм', symbol: 'г', family: 'weight', baseUnitCode: 'g', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'kg', name: 'Килограмм', symbol: 'кг', family: 'weight', baseUnitCode: 'g', factor: '1000', precision: 3, isDefault: true, isActive: true },
  { code: 't', name: 'Тонна', symbol: 'т', family: 'weight', baseUnitCode: 'g', factor: '1000000', precision: 6, isDefault: true, isActive: true },

  // Volume (base: ml)
  { code: 'ml', name: 'Миллилитр', symbol: 'мл', family: 'volume', baseUnitCode: 'ml', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'l', name: 'Литр', symbol: 'л', family: 'volume', baseUnitCode: 'ml', factor: '1000', precision: 3, isDefault: true, isActive: true },

  // Length (base: mm)
  { code: 'mm', name: 'Миллиметр', symbol: 'мм', family: 'length', baseUnitCode: 'mm', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'cm', name: 'Сантиметр', symbol: 'см', family: 'length', baseUnitCode: 'mm', factor: '10', precision: 0, isDefault: true, isActive: true },
  { code: 'm', name: 'Метр', symbol: 'м', family: 'length', baseUnitCode: 'mm', factor: '1000', precision: 3, isDefault: true, isActive: true },
  { code: 'km', name: 'Километр', symbol: 'км', family: 'length', baseUnitCode: 'mm', factor: '1000000', precision: 3, isDefault: true, isActive: true },

  // Area (base: cm2)
  { code: 'cm2', name: 'Квадратный сантиметр', symbol: 'см²', family: 'area', baseUnitCode: 'cm2', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'm2', name: 'Квадратный метр', symbol: 'м²', family: 'area', baseUnitCode: 'cm2', factor: '10000', precision: 3, isDefault: true, isActive: true },

  // Cubic (base: cm3)
  { code: 'cm3', name: 'Кубический сантиметр', symbol: 'см³', family: 'cubic', baseUnitCode: 'cm3', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'm3', name: 'Кубический метр', symbol: 'м³', family: 'cubic', baseUnitCode: 'cm3', factor: '1000000', precision: 6, isDefault: true, isActive: true },

  // Time (base: sec)
  { code: 'sec', name: 'Секунда', symbol: 'с', family: 'time', baseUnitCode: 'sec', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'min', name: 'Минута', symbol: 'мин', family: 'time', baseUnitCode: 'sec', factor: '60', precision: 0, isDefault: true, isActive: true },
  { code: 'h', name: 'Час', symbol: 'ч', family: 'time', baseUnitCode: 'sec', factor: '3600', precision: 0, isDefault: true, isActive: true },
  { code: 'day', name: 'День', symbol: 'дн', family: 'time', baseUnitCode: 'sec', factor: '86400', precision: 0, isDefault: true, isActive: true },

  // Packaging
  { code: 'pair', name: 'Пара', symbol: 'пара', family: 'packaging', baseUnitCode: 'pair', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'set', name: 'Набор', symbol: 'наб.', family: 'packaging', baseUnitCode: 'set', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'box', name: 'Коробка', symbol: 'кор.', family: 'packaging', baseUnitCode: 'box', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'pack', name: 'Пачка', symbol: 'пач.', family: 'packaging', baseUnitCode: 'pack', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'roll', name: 'Рулон', symbol: 'рул.', family: 'packaging', baseUnitCode: 'roll', factor: '1', precision: 0, isDefault: true, isActive: true },
  { code: 'pallet', name: 'Паллета', symbol: 'пал.', family: 'packaging', baseUnitCode: 'pallet', factor: '1', precision: 0, isDefault: true, isActive: true },
]);

// normalizeCode: приводит значения к единому формату для сервиса.
function normalizeCode(value) {
  return String(value || '').trim().toLowerCase();
}

// valueAsString: выполняет вспомогательную бизнес-логику сервиса.
function valueAsString(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

// needsPatch: выполняет вспомогательную бизнес-логику сервиса.
function needsPatch(row, field, nextValue) {
  if (row[field] === undefined || row[field] === null || row[field] === '') return true;
  if (typeof nextValue === 'number') return Number(row[field]) !== nextValue;
  return valueAsString(row[field]) !== valueAsString(nextValue);
}

// ensureDefaultUomsForCompany: выполняет вспомогательную бизнес-логику сервиса.
async function ensureDefaultUomsForCompany(companyId, { transaction } = {}) {
  if (!companyId) return { created: 0, updated: 0, total: 0 };

  let created = 0;
  let updated = 0;

  for (const def of DEFAULT_UOMS) {
    const code = normalizeCode(def.code);
    // eslint-disable-next-line no-await-in-loop
    const [row, wasCreated] = await Uom.findOrCreate({
      where: { companyId, code },
      defaults: {
        companyId,
        ...def,
        code,
      },
      transaction,
    });

    if (wasCreated) {
      created += 1;
      continue;
    }

    const patch = {};

    if (!valueAsString(row.name)) patch.name = def.name;
    if (needsPatch(row, 'symbol', def.symbol)) patch.symbol = def.symbol;
    if (needsPatch(row, 'family', def.family)) patch.family = def.family;
    if (needsPatch(row, 'baseUnitCode', def.baseUnitCode)) patch.baseUnitCode = def.baseUnitCode;
    if (Number(row.precision) !== Number(def.precision)) patch.precision = def.precision;
    if (Number(row.factor) !== Number(def.factor)) patch.factor = def.factor;
    if (Boolean(row.isDefault) !== Boolean(def.isDefault)) patch.isDefault = def.isDefault;
    if (Boolean(row.isActive) !== Boolean(def.isActive)) patch.isActive = def.isActive;

    if (Object.keys(patch).length > 0) {
      // eslint-disable-next-line no-await-in-loop
      await row.update(patch, { transaction });
      updated += 1;
    }
  }

  const total = await Uom.count({ where: { companyId }, transaction });
  return { created, updated, total };
}

module.exports = {
  UOM_FAMILIES,
  DEFAULT_UOMS,
  ensureDefaultUomsForCompany,
};

