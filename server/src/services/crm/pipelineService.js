const { CrmPipeline, CrmPipelineStage } = require('../../models');
const { v4:uuid } = require('uuid');

// createPipeline: создаёт новую запись и возвращает результат.
module.exports.createPipeline = async (companyId, dto) => {
  return CrmPipeline.create({ id:uuid(), companyId, ...dto });
};
// addStage: добавляет этап в воронку продаж и рассчитывает позицию.
module.exports.addStage = async (companyId, pipelineId, dto) => {
  const position = dto.position ?? await CrmPipelineStage.count({ where:{ companyId, pipelineId } });
  return CrmPipelineStage.create({ id:uuid(), companyId, pipelineId, ...dto, position });
};
// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (companyId) => {
  return CrmPipeline.findAll({ where:{ companyId }, include:['stages'] });
};
