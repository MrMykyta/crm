const service = require('../../services/system/webhookService');

module.exports.list = async (req,res) => {
  res.json(await service.list(req.user.companyId));
};
module.exports.create = async (req,res) => {
  res.json(await service.create(req.user.companyId, req.body));
};
module.exports.update = async (req,res) => {
  res.json(await service.update(req.user.companyId, req.params.id, req.body));
};
module.exports.remove = async (req,res) => {
  await service.remove(req.user.companyId, req.params.id);
  res.json({ ok:true });
};