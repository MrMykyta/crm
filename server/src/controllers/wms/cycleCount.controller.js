'use strict';

const inventoryCountService = require('../../services/wms/inventoryCountService');
const printSvc = require('../../services/wms/warehousePrintService');

function resolveCompanyId(req) {
  return req.companyId || req.user?.companyId || null;
}

module.exports.list = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const { rows, count, page, limit } = await inventoryCountService.listCycleCounts(
      companyId,
      req.query || {}
    );
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (error) {
    next(error);
  }
};

module.exports.getById = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const row = await inventoryCountService.getCycleCountById(companyId, req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.getPrint = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const row = await printSvc.getPrintDocument(companyId, 'cycleCount', req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const row = await inventoryCountService.createCycleCount(companyId, req.body || {});
    res.status(201).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.addItems = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const row = await inventoryCountService.addCountItems(
      req.params.id,
      req.body?.items || req.body,
      { companyId }
    );
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.reconcile = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
    const result = await inventoryCountService.reconcileCycleCount(req.params.id, { companyId });
    if (!result) return res.sendStatus(404);
    res.status(200).send(result);
  } catch (error) {
    next(error);
  }
};
