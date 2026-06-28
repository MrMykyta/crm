'use strict';

const { Op } = require('sequelize');
const { CrmDealSetting, CrmDealLostReason, sequelize } = require('../../models');
const { v4: uuid } = require('uuid');

const PROBABILITY_MODES = new Set(['manual', 'automatic', 'hybrid']);
const VISIBILITY_MODES = new Set(['company', 'team', 'owner']);
const DEFAULT_SETTINGS = {
  probabilityMode: 'automatic',
  defaultCurrency: 'PLN',
  defaultExpectedCloseDays: 30,
  visibility: 'company',
  dealNumberingEnabled: false,
  dealNumberPrefix: 'DL',
};

function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireCompanyId(companyId) {
  if (!companyId) throw badRequest('companyId is required');
  return companyId;
}

function cleanSettingsPayload(payload = {}, current = DEFAULT_SETTINGS) {
  const next = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'probabilityMode')) {
    const value = String(payload.probabilityMode || '').trim();
    if (!PROBABILITY_MODES.has(value)) throw badRequest('probabilityMode is invalid');
    next.probabilityMode = value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'defaultCurrency')) {
    const value = String(payload.defaultCurrency || '').trim().toUpperCase();
    if (!/^[A-Z]{3,8}$/.test(value)) throw badRequest('defaultCurrency is invalid');
    next.defaultCurrency = value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'defaultExpectedCloseDays')) {
    const value = payload.defaultExpectedCloseDays;
    if (value === '' || value === null || value === undefined) {
      next.defaultExpectedCloseDays = null;
    } else {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0 || number > 3650) {
        throw badRequest('defaultExpectedCloseDays is invalid');
      }
      next.defaultExpectedCloseDays = number;
    }
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'visibility')) {
    const value = String(payload.visibility || '').trim();
    if (!VISIBILITY_MODES.has(value)) throw badRequest('visibility is invalid');
    next.visibility = value;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'dealNumberingEnabled')) {
    next.dealNumberingEnabled = payload.dealNumberingEnabled === true;
  }

  if (Object.prototype.hasOwnProperty.call(payload, 'dealNumberPrefix')) {
    const value = String(payload.dealNumberPrefix || '').trim().toUpperCase();
    if (value && !/^[A-Z0-9_-]{1,16}$/.test(value)) throw badRequest('dealNumberPrefix is invalid');
    next.dealNumberPrefix = value || current.dealNumberPrefix || DEFAULT_SETTINGS.dealNumberPrefix;
  }

  return next;
}

function cleanLostReasonPayload(payload = {}) {
  const next = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'name')) {
    const name = String(payload.name || '').trim();
    if (!name) throw badRequest('name is required');
    if (name.length > 160) throw badRequest('name is too long');
    next.name = name;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'archived')) {
    next.archived = payload.archived === true;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'order')) {
    const order = Number(payload.order);
    if (!Number.isFinite(order)) throw badRequest('order is invalid');
    next.order = order;
  }
  return next;
}

async function getOrCreateSettings(companyId, options = {}) {
  const cid = requireCompanyId(companyId);
  const [settings] = await CrmDealSetting.findOrCreate({
    where: { companyId: cid },
    defaults: {
      id: uuid(),
      companyId: cid,
      ...DEFAULT_SETTINGS,
    },
    transaction: options.transaction,
  });
  return settings;
}

async function nextLostReasonOrder(companyId, options = {}) {
  const max = await CrmDealLostReason.max('order', {
    where: { companyId },
    transaction: options.transaction,
  });
  return Number.isFinite(Number(max)) ? Number(max) + 1 : 0;
}

async function getLostReasonOrThrow(companyId, lostReasonId, options = {}) {
  const row = await CrmDealLostReason.findOne({
    where: { id: lostReasonId, companyId },
    transaction: options.transaction,
  });
  if (!row) throw badRequest('lostReasonId is invalid', 404);
  return row;
}

module.exports.getSettings = async (companyId) => {
  return getOrCreateSettings(companyId);
};

module.exports.updateSettings = async (companyId, payload = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const settings = await getOrCreateSettings(cid, { transaction });
    const next = cleanSettingsPayload(payload, settings);
    await settings.update(next, { transaction });
    return settings.reload({ transaction });
  });
};

module.exports.listLostReasons = async (companyId) => {
  const cid = requireCompanyId(companyId);
  return CrmDealLostReason.findAll({
    where: { companyId: cid },
    order: [['order', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
  });
};

module.exports.createLostReason = async (companyId, payload = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const next = cleanLostReasonPayload(payload);
    if (!next.name) throw badRequest('name is required');
    if (next.order == null) next.order = await nextLostReasonOrder(cid, { transaction });
    next.archived = next.archived === true;

    return CrmDealLostReason.create({
      id: uuid(),
      companyId: cid,
      ...next,
    }, { transaction });
  });
};

module.exports.updateLostReason = async (companyId, lostReasonId, payload = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const row = await getLostReasonOrThrow(cid, lostReasonId, { transaction });
    const next = cleanLostReasonPayload(payload);
    await row.update(next, { transaction });
    return row.reload({ transaction });
  });
};

module.exports.deleteLostReason = async (companyId, lostReasonId) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const row = await getLostReasonOrThrow(cid, lostReasonId, { transaction });
    await row.destroy({ transaction });
    return { deleted: true };
  });
};

module.exports.reorderLostReasons = async (companyId, orderedLostReasonIds = []) => {
  const cid = requireCompanyId(companyId);
  if (!Array.isArray(orderedLostReasonIds) || !orderedLostReasonIds.length) {
    throw badRequest('ordered lost reason ids are required');
  }

  return sequelize.transaction(async (transaction) => {
    const rows = await CrmDealLostReason.findAll({
      where: { companyId: cid },
      transaction,
    });
    const known = new Set(rows.map((row) => String(row.id)));
    const incoming = orderedLostReasonIds.map(String);

    if (known.size !== incoming.length || incoming.some((id) => !known.has(id))) {
      throw badRequest('lost reason order must include every lost reason in this company');
    }

    for (let index = 0; index < incoming.length; index += 1) {
      await CrmDealLostReason.update(
        { order: index },
        { where: { id: incoming[index], companyId: cid }, transaction }
      );
    }

    return CrmDealLostReason.findAll({
      where: { companyId: cid, id: { [Op.in]: incoming } },
      order: [['order', 'ASC'], ['id', 'ASC']],
      transaction,
    });
  });
};

module.exports.DEFAULT_SETTINGS = DEFAULT_SETTINGS;
