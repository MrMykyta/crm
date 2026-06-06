'use strict';

const svc = require('../../services/wms/shipmentService');
const printSvc = require('../../services/wms/warehousePrintService');

// create: создаёт WZ-документ.
module.exports.create = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const payload = { ...req.body, companyId };
    const row = await svc.create(companyId, payload);
    res.status(201).send(row);
  } catch (error) {
    next(error);
  }
};

// shipItem: проводит отгрузку строки WZ.
module.exports.shipItem = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const row = await svc.shipItem(companyId, req.params.itemId, req.body || {});
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

// list: возвращает список WZ-документов.
module.exports.list = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const { rows, count, page, limit } = await svc.list(companyId, req.query || {});
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (error) {
    next(error);
  }
};

// getById: возвращает детальную карточку WZ-документа.
module.exports.getById = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const row = await svc.getById(companyId, req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

module.exports.getPrint = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const row = await printSvc.getPrintDocument(companyId, 'shipment', req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (error) {
    next(error);
  }
};

// listStockMoves: возвращает историю stock_moves по WZ-документу.
module.exports.listStockMoves = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const result = await svc.listStockMoves(companyId, req.params.id, req.query || {});
    if (!result) return res.sendStatus(404);
    res.status(200).send({ data: result.rows, meta: { count: result.count, page: result.page, limit: result.limit } });
  } catch (error) {
    next(error);
  }
};

// K1.3 — Posts a WZ correction (WZ_KOREKTA).
module.exports.createCorrection = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const row = await svc.createShipmentCorrection(companyId, req.params.id, req.body || {});
    if (!row) return res.sendStatus(404);
    res.status(201).send(row);
  } catch (error) {
    next(error);
  }
};

// listItemStockMoves: возвращает историю stock_moves по строке WZ (refItemId).
module.exports.listItemStockMoves = async (req, res, next) => {
  try {
    const companyId = req.user?.companyId;
    const result = await svc.listItemStockMoves(companyId, req.params.itemId, req.query || {});
    if (!result) return res.sendStatus(404);
    res.status(200).send({ data: result.rows, meta: { count: result.count, page: result.page, limit: result.limit } });
  } catch (error) {
    next(error);
  }
};
