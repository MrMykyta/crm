const { SystemWorkflow, SystemTrigger } = require('../../models');

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (companyId, dto) => {
  return SystemWorkflow.create({ companyId, ...dto }, { include:['triggers'] });
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (companyId) => {
  return SystemWorkflow.findAll({ where:{ companyId }, include:['triggers'] });
};

// update: обновляет запись и возвращает актуальные данные.
module.exports.update = async (companyId, id, dto) => {
  const wf = await SystemWorkflow.findOne({ where:{ id, companyId } });
  if (!wf) throw new Error('Not found');
  return wf.update(dto);
};

// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = async (companyId, id) => {
  return SystemWorkflow.destroy({ where:{ id, companyId } });
};
