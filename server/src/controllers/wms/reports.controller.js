'use strict';

const stockValuationReportService = require('../../services/wms/stockValuationReportService');
const stockTurnoverReportService = require('../../services/wms/stockTurnoverReportService');
const stockAsOfReportService = require('../../services/wms/stockAsOfReportService');
const inventoryLedgerReportService = require('../../services/wms/inventoryLedgerReportService');

exports.getStockValuation = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const result = await stockValuationReportService.listStockValuation(companyId, req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getStockTurnover = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const result = await stockTurnoverReportService.listStockTurnover(companyId, req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getStockAsOf = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const result = await stockAsOfReportService.listStockAsOf(companyId, req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

exports.getInventoryLedger = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const result = await inventoryLedgerReportService.listInventoryLedger(companyId, req.query || {});
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
