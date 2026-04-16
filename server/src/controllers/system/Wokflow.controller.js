const service = require('../../services/system/workflowService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req,res) => {
  res.json(await service.list(req.user.companyId));
};
// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req,res) => {
  res.json(await service.create(req.user.companyId, req.body));
};
// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req,res) => {
  res.json(await service.update(req.user.companyId, req.params.id, req.body));
};
// Удаляет сущность по идентификатору.
module.exports.remove = async (req,res) => {
  await service.remove(req.user.companyId, req.params.id);
  res.json({ ok:true });
};
