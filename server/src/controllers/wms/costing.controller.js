'use strict';

const openingBalanceService = require('../../services/wms/costingOpeningBalanceService');

function getCompanyId(req) {
  return req.companyId || req.user?.companyId || null;
}

function normalizePayload(body = {}) {
  const rawUnitCost = body.unitCostFallback;
  const unitCostFallback = rawUnitCost === '' || rawUnitCost === undefined ? null : rawUnitCost;
  return {
    unitCostFallback,
    force: Boolean(body.force),
  };
}

exports.getOpeningBalanceStatus = async (req, res, next) => {
  try {
    const data = await openingBalanceService.getInitializationStatus(getCompanyId(req));
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

exports.dryRunOpeningBalance = async (req, res, next) => {
  try {
    const { unitCostFallback } = normalizePayload(req.body || {});
    const data = await openingBalanceService.initializeForCompany(getCompanyId(req), {
      dryRun: true,
      unitCostFallback,
      force: false,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

exports.initializeOpeningBalance = async (req, res, next) => {
  try {
    const { unitCostFallback, force } = normalizePayload(req.body || {});
    const data = await openingBalanceService.initializeForCompany(getCompanyId(req), {
      dryRun: false,
      unitCostFallback,
      force,
    });
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};
