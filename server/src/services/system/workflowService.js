const { SystemWorkflow, SystemTrigger } = require('../../models');

module.exports.create = async (companyId, dto) => {
  return SystemWorkflow.create({ companyId, ...dto }, { include:['triggers'] });
};

module.exports.list = async (companyId) => {
  return SystemWorkflow.findAll({ where:{ companyId }, include:['triggers'] });
};

module.exports.update = async (companyId, id, dto) => {
  const wf = await SystemWorkflow.findOne({ where:{ id, companyId } });
  if (!wf) throw new Error('Not found');
  return wf.update(dto);
};

module.exports.remove = async (companyId, id) => {
  return SystemWorkflow.destroy({ where:{ id, companyId } });
};