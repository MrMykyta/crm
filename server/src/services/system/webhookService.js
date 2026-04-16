const { SystemWebhook } = require('../../models');

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (companyId, dto) => {
  return SystemWebhook.create({ companyId, ...dto });
};

// list: возвращает список записей с фильтрами, сортировкой и пагинацией.
module.exports.list = async (companyId) => {
  return SystemWebhook.findAll({ where:{ companyId } });
};

// update: обновляет запись и возвращает актуальные данные.
module.exports.update = async (companyId, id, dto) => {
  const wh = await SystemWebhook.findOne({ where:{ id, companyId } });
  if (!wh) throw new Error('Not found');
  return wh.update(dto);
};

// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = async (companyId, id) => {
  return SystemWebhook.destroy({ where:{ id, companyId } });
};
