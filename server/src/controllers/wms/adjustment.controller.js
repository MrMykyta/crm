
// adjustment.controller.js (generated)
const svc = require('../../services/wms/adjustmentService');

module.exports.create = async (req,res)=> {
  const payload = { ...req.body };
  const row = await svc.create(req.user.companyId || payload.companyId, payload);
  res.status(201).send(row);
};
