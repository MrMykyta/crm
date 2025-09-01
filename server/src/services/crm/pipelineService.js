const { CrmPipeline, CrmPipelineStage } = require('../../models');
const { v4:uuid } = require('uuid');

module.exports.createPipeline = async (companyId, dto) => {
  return CrmPipeline.create({ id:uuid(), companyId, ...dto });
};
module.exports.addStage = async (companyId, pipelineId, dto) => {
  const position = dto.position ?? await CrmPipelineStage.count({ where:{ companyId, pipelineId } });
  return CrmPipelineStage.create({ id:uuid(), companyId, pipelineId, ...dto, position });
};
module.exports.list = async (companyId) => {
  return CrmPipeline.findAll({ where:{ companyId }, include:['stages'] });
};