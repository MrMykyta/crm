
// receipt.controller.js (generated)
const svc = require('../../services/wms/receiptService');

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
