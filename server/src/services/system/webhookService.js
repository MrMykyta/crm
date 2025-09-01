const { SystemWebhook } = require('../../models');

module.exports.create = async (companyId, dto) => {
  return SystemWebhook.create({ companyId, ...dto });
};

module.exports.list = async (companyId) => {
  return SystemWebhook.findAll({ where:{ companyId } });
};

module.exports.update = async (companyId, id, dto) => {
  const wh = await SystemWebhook.findOne({ where:{ id, companyId } });
  if (!wh) throw new Error('Not found');
  return wh.update(dto);
};

module.exports.remove = async (companyId, id) => {
  return SystemWebhook.destroy({ where:{ id, companyId } });
};