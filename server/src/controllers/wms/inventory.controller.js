
// inventory.controller.js (generated)
const svc = require('../../services/wms/inventoryService');

module.exports.onHand = async (req,res)=> {
  const data = await svc.getOnHand(req.user.companyId || req.query.companyId, req.query);
  res.status(200).send(data);
};
module.exports.reserve = async (req,res)=> {
  const rows = await svc.reserve(req.user.companyId || req.body.companyId, req.body);
  res.status(200).send({ reserved: rows.length, rows });
};
module.exports.release = async (req,res)=> {
  const row = await svc.releaseReservation(req.user.companyId || req.body.companyId, req.params.id);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
