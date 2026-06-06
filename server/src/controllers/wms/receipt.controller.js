
// receipt.controller.js (generated)
const svc = require('../../services/wms/receiptService');
const printSvc = require('../../services/wms/warehousePrintService');

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const payload = { ...req.body, companyId };
    const row = await svc.create(companyId, payload);
    res.status(201).send(row);
  } catch (e) {
    next(e);
  }
};

// Проводит приёмку отдельной строки в документе поступления.
module.exports.receiveLine = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const row = await svc.receiveLine(companyId, req.params.itemId, req.body);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (e) {
    next(e);
  }
};

// Возвращает список PZ-документов.
module.exports.list = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const { rows, count, page, limit } = await svc.list(companyId, req.query);
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    next(e);
  }
};

// Возвращает детальную карточку PZ-документа с позициями.
module.exports.getById = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const row = await svc.getById(companyId, req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (e) {
    next(e);
  }
};

module.exports.getPrint = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const row = await printSvc.getPrintDocument(companyId, 'receipt', req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (e) {
    next(e);
  }
};

// Возвращает историю stock_moves по PZ-документу.
module.exports.listStockMoves = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const result = await svc.listStockMoves(companyId, req.params.id, req.query);
    if (!result) return res.sendStatus(404);
    res.status(200).send({ data: result.rows, meta: { count: result.count, page: result.page, limit: result.limit } });
  } catch (e) {
    next(e);
  }
};

// K1.3 — Posts a PZ correction (PZ_KOREKTA).
module.exports.createCorrection = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const row = await svc.createReceiptCorrection(companyId, req.params.id, req.body || {});
    if (!row) return res.sendStatus(404);
    res.status(201).send(row);
  } catch (e) {
    next(e);
  }
};

// Возвращает историю stock_moves по строке PZ (refItemId).
module.exports.listItemStockMoves = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const result = await svc.listItemStockMoves(companyId, req.params.itemId, req.query);
    if (!result) return res.sendStatus(404);
    res.status(200).send({ data: result.rows, meta: { count: result.count, page: result.page, limit: result.limit } });
  } catch (e) {
    next(e);
  }
};
