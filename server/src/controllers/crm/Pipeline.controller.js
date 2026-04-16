const service = require('../../services/crm/pipelineService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res) => {
  res.json(await service.list(req.user.companyId));
};
// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res) => {
  res.json(await service.createPipeline(req.user.companyId, req.body));
};
// Добавляет новый этап в воронку продаж.
module.exports.addStage = async (req,res) => {
  res.json(await service.addStage(req.user.companyId, req.params.pipelineId, req.body));
};
