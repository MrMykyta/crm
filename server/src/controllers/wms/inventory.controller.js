
// inventory.controller.js (generated)
const svc = require('../../services/wms/inventoryService');

module.exports.onHand = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.getOnHand(companyId, req.query);
    res.status(200).send(data);
  } catch (e) {
    next(e);
  }
};

module.exports.reserve = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const rows = await svc.reserve(companyId, req.body);
    res.status(200).send({ reserved: rows.length, rows });
  } catch (e) {
    next(e);
  }
};

module.exports.release = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const row = await svc.releaseReservation(companyId, req.params.id);
    if (!row) return res.sendStatus(404);
    res.status(200).send(row);
  } catch (e) {
    next(e);
  }
};
