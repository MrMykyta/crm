const service = require('../../services/crm/pipelineService');

module.exports.list = async (req,res) => {
  res.json(await service.list(req.user.companyId));
};
module.exports.create = async (req,res) => {
  res.json(await service.createPipeline(req.user.companyId, req.body));
};
module.exports.addStage = async (req,res) => {
  res.json(await service.addStage(req.user.companyId, req.params.pipelineId, req.body));
};