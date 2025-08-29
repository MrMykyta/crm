const { Joi, uuid, paging, dateISO } = require('./_common');

const status = Joi.string().valid('pending', 'in_progress', 'done', 'cancelled');
const priority = Joi.string().valid('low', 'medium', 'high');
const ownerType = Joi.string().valid('user', 'department');

const base = {
  companyId: uuid,
  counterpartyId: uuid.allow(null),
  dealId: uuid.allow(null),
  title: Joi.string().min(1).max(256),
  description: Joi.string().allow('', null),
  status,
  priority,
  dueDate: dateISO.allow(null),
  creatorId: uuid.allow(null),
  assigneeId: uuid.allow(null),
  ownerType: ownerType.default('user'),
  ownerId: uuid.allow(null),
};

module.exports.create = Joi.object({
  companyId: base.companyId.required(),
  counterpartyId: base.counterpartyId.optional(),
  dealId: base.dealId.optional(),
  title: base.title.required(),
  description: base.description.optional(),
  status: base.status.default('pending'),
  priority: base.priority.default('medium'),
  dueDate: base.dueDate.optional(),
  creatorId: base.creatorId.optional(),
  assigneeId: base.assigneeId.optional(),
  ownerType: base.ownerType.optional(),
  ownerId: base.ownerId.optional(),
});

module.exports.update = Joi.object({
  companyId: base.companyId.optional(),
  counterpartyId: base.counterpartyId.optional(),
  dealId: base.dealId.optional(),
  title: base.title.optional(),
  description: base.description.optional(),
  status: base.status.optional(),
  priority: base.priority.optional(),
  dueDate: base.dueDate.optional(),
  creatorId: base.creatorId.optional(),
  assigneeId: base.assigneeId.optional(),
  ownerType: base.ownerType.optional(),
  ownerId: base.ownerId.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  companyId: base.companyId,
  counterpartyId: base.counterpartyId,
  dealId: base.dealId,
  assigneeId: base.assigneeId,
  creatorId: base.creatorId,
  status: base.status,
  priority: base.priority,
  q: Joi.string().max(200),
  dueFrom: Joi.date().iso(),
  dueTo: Joi.date().iso(),
});
