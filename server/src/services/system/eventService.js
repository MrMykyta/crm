const { SystemEvent } = require('../../models');

module.exports.create = async (companyId, type, payload = {}, entity = {}) => {
  return SystemEvent.create({
    companyId,
    type,
    payload,
    entityType: entity.type || null,
    entityId: entity.id || null
  });
};

module.exports.list = async (companyId, query = {}) => {
  const where = { companyId };
  if (query.type) where.type = query.type;
  return SystemEvent.findAll({ where, order:[['created_at','DESC']], limit:100 });
};