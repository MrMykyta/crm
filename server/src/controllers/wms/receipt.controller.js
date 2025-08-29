
// receipt.controller.js (generated)
const svc = require('../../services/wms/receiptService');

module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
  const row = await svc.create(payload.companyId, payload);
  res.status(201).send(row);
};
module.exports.receiveLine = async (req,res)=> {
  const row = await svc.receiveLine(req.user.companyId || req.body.companyId, req.params.itemId, req.body);
  if (!row) return res.sendStatus(404);
  res.status(200).send(row);
};
