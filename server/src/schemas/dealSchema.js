const { Joi, uuid, paging } = require('./_common');

const status = Joi.string().valid('new', 'in_progress', 'won', 'lost');
const currency = Joi.string().max(8);
const healthStatus = Joi.string().max(40).allow('', null);
const activityType = Joi.string().valid(
  'note',
  'call',
  'email',
  'meeting',
  'task',
  'deal_created',
  'stage_change',
  'status_change',
  'system'
);

const base = {
  companyId: uuid,
  counterpartyId: uuid,
  title: Joi.string().min(1).max(256),
  description: Joi.string().allow('', null),
  status,
  value: Joi.number().precision(2).min(0).allow(null),
  currency,
  responsibleId: uuid.allow(null),
  pipelineId: uuid.allow(null),
  stageId: uuid.allow(null),
  contactId: uuid.allow(null),
  expectedCloseDate: Joi.date().iso().allow(null),
  closedAt: Joi.date().iso().allow(null),
  lostReasonId: uuid.allow(null),
  lostNote: Joi.string().allow('', null),
  priority: Joi.number().integer().min(0).max(100).allow(null),
  source: Joi.string().max(80).allow('', null),
  probability: Joi.number().integer().min(0).max(100).allow(null),
  nextActionAt: Joi.date().iso().allow(null),
  nextActionType: Joi.string().max(40).allow('', null),
  nextActionTaskId: uuid.allow(null),
  healthStatus,
  healthComputedAt: Joi.date().iso().allow(null),
};

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId.required(),
  title: base.title.required(),
  description: base.description.optional(),
  status: base.status.default('new'),
  value: base.value.optional(),
  currency: base.currency.default('PLN'),
  responsibleId: base.responsibleId.optional(),
  pipelineId: base.pipelineId.optional(),
  stageId: base.stageId.optional(),
  contactId: base.contactId.optional(),
  expectedCloseDate: base.expectedCloseDate.optional(),
  closedAt: base.closedAt.optional(),
  lostReasonId: base.lostReasonId.optional(),
  lostNote: base.lostNote.optional(),
  priority: base.priority.optional(),
  source: base.source.optional(),
  probability: base.probability.optional(),
  nextActionAt: base.nextActionAt.optional(),
  nextActionType: base.nextActionType.optional(),
  nextActionTaskId: base.nextActionTaskId.optional(),
  healthStatus: base.healthStatus.optional(),
  healthComputedAt: base.healthComputedAt.optional(),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId.optional(),
  title: base.title.optional(),
  description: base.description.optional(),
  status: base.status.optional(),
  value: base.value.optional(),
  currency: base.currency.optional(),
  responsibleId: base.responsibleId.optional(),
  pipelineId: base.pipelineId.optional(),
  stageId: base.stageId.optional(),
  contactId: base.contactId.optional(),
  expectedCloseDate: base.expectedCloseDate.optional(),
  closedAt: base.closedAt.optional(),
  lostReasonId: base.lostReasonId.optional(),
  lostNote: base.lostNote.optional(),
  priority: base.priority.optional(),
  source: base.source.optional(),
  probability: base.probability.optional(),
  nextActionAt: base.nextActionAt.optional(),
  nextActionType: base.nextActionType.optional(),
  nextActionTaskId: base.nextActionTaskId.optional(),
  healthStatus: base.healthStatus.optional(),
  healthComputedAt: base.healthComputedAt.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  companyId: Joi.forbidden(),
  counterpartyId: base.counterpartyId,
  responsibleId: base.responsibleId,
  pipelineId: base.pipelineId,
  stageId: base.stageId,
  contactId: base.contactId,
  lostReasonId: base.lostReasonId,
  healthStatus: base.healthStatus,
  priority: base.priority,
  status: base.status,
  q: Joi.string().max(200),
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso(),
});

module.exports.boardQuery = Joi.object({
  companyId: Joi.forbidden(),
  pipelineId: base.pipelineId,
  responsibleId: base.responsibleId,
  ownerId: base.responsibleId,
  stageId: base.stageId,
  healthStatus: base.healthStatus,
  nextAction: Joi.string().valid('', 'all', 'missing', 'overdue', 'today', 'upcoming').allow('', null),
  q: Joi.string().max(200).allow('', null),
  perStageLimit: Joi.number().integer().min(1).max(100).default(50),
});

module.exports.stageMove = Joi.object({
  companyId: Joi.forbidden(),
  stageId: base.stageId.required(),
  closedAt: base.closedAt.optional(),
  lostReasonId: base.lostReasonId.optional(),
  lostNote: base.lostNote.optional(),
});

module.exports.markWon = Joi.object({
  companyId: Joi.forbidden(),
  closedAt: base.closedAt.optional(),
});

module.exports.markLost = Joi.object({
  companyId: Joi.forbidden(),
  closedAt: base.closedAt.optional(),
  lostReasonId: base.lostReasonId.optional(),
  lostNote: base.lostNote.optional(),
});

module.exports.activityListQuery = Joi.object({
  companyId: Joi.forbidden(),
  type: activityType.optional(),
  limit: Joi.number().integer().min(1).max(100).default(50),
});

module.exports.createActivity = Joi.object({
  companyId: Joi.forbidden(),
  type: activityType.valid('note', 'call', 'email', 'meeting', 'task').required(),
  title: Joi.string().max(255).allow('', null),
  body: Joi.string().allow('', null),
  occurredAt: Joi.date().iso().optional(),
  metadata: Joi.object().unknown(true).allow(null),
}).or('title', 'body');
