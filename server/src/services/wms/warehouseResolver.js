'use strict';

// warehouseResolver — resolves the company's default warehouse id (Phase 1 / T1.1).
//
// MVP: одна компания → один склад по умолчанию. Источник настройки —
// company_warehouse_document_settings.default_warehouse_id (nullable).
// Если настройка пустая/битая — fallback на первый активный склад, иначе создаётся MAIN.

const crypto = require('crypto');
const AppError = require('../../errors/AppError');
const { withTx } = require('../../utils/tx');
const { Warehouse, CompanyWarehouseDocumentSetting } = require('../../models');

const DEFAULT_MAIN_WAREHOUSE = Object.freeze({
  code: 'MAIN',
  name: 'Main Warehouse',
});

// ensureMainWarehouse: idempotently ensures a company's MAIN warehouse exists and is active.
async function ensureMainWarehouse(companyId, { transaction } = {}) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }

  return withTx(async (t) => {
    const [main] = await Warehouse.findOrCreate({
      where: { companyId, code: DEFAULT_MAIN_WAREHOUSE.code },
      defaults: {
        id: crypto.randomUUID(),
        companyId,
        code: DEFAULT_MAIN_WAREHOUSE.code,
        name: DEFAULT_MAIN_WAREHOUSE.name,
        isActive: true,
      },
      transaction: t,
    });

    if (!main.isActive) {
      await main.update({ isActive: true }, { transaction: t });
    }

    return main;
  }, transaction);
}

// resolveDefaultWarehouseId: возвращает id активного склада по умолчанию для компании,
// при необходимости создавая MAIN. Все обращения идут в переданной транзакции.
async function resolveDefaultWarehouseId(companyId, { transaction } = {}) {
  if (!companyId) {
    throw new AppError(403, 'Company context required', { code: 'COMPANY_CONTEXT_REQUIRED' });
  }

  return withTx(async (t) => {
    // 1) Сконфигурированный default из настроек компании.
    const setting = await CompanyWarehouseDocumentSetting.findOne({
      where: { companyId },
      attributes: ['id', 'companyId', 'defaultWarehouseId'],
      transaction: t,
    });
    const configuredId = setting?.defaultWarehouseId || null;
    if (configuredId) {
      const configured = await Warehouse.findOne({
        where: { id: configuredId, companyId, isActive: true },
        attributes: ['id'],
        transaction: t,
      });
      if (configured) {
        return configured.id;
      }
      // настройка указывает на удалённый/чужой/неактивный склад → идём в fallback
    }

    // 2) Fallback: первый активный склад компании.
    const firstActive = await Warehouse.findOne({
      where: { companyId, isActive: true },
      order: [['createdAt', 'ASC']],
      attributes: ['id'],
      transaction: t,
    });
    if (firstActive) {
      return firstActive.id;
    }

    // 3) No active warehouse exists: create/reactivate MAIN via UNIQUE(company_id, code).
    const main = await ensureMainWarehouse(companyId, { transaction: t });
    return main.id;
  }, transaction);
}

module.exports = {
  DEFAULT_MAIN_WAREHOUSE,
  ensureMainWarehouse,
  resolveDefaultWarehouseId,
};
