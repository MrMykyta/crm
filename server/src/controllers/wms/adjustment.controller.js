'use strict';

const svc = require('../../services/wms/adjustmentService');
const printSvc = require('../../services/wms/warehousePrintService');

module.exports.list = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const { rows, count, page, limit } = await svc.list(companyId, req.query || {});
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (error) {
    next(error);
  }
};

module.exports.getById = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const row = await svc.getById(companyId, req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.getPrint = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const row = await printSvc.getPrintDocument(companyId, 'adjustment', req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const payload = { ...req.body };
    const row = await svc.create(companyId, payload);
    res.status(201).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.post = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const row = await svc.post(companyId, req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.listStockMoves = async (req, res, next) => {
  try {
    const companyId = req.companyId || req.user?.companyId;
    const result = await svc.listStockMoves(companyId, req.params.id, req.query || {});
    if (!result) return res.sendStatus(404);
    res.status(200).send({ data: result.rows, meta: { count: result.count, page: result.page, limit: result.limit } });
  } catch (error) {
    next(error);
  }
};
