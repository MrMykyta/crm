'use strict';

const { Joi, uuid } = require('./_common');

const STATUS_VALUES = ['todo', 'in_progress', 'done', 'blocked', 'canceled'];
const MODE_VALUES = ['none', 'all', 'lists'];
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

const isoOrDateOnly = Joi.alternatives().try(
  Joi.date().iso(),
  Joi.string().trim().pattern(DATE_ONLY_RE)
);

const nullableDateInput = isoOrDateOnly.allow(null, '');

const base = {
  title: Joi.string().trim().min(1).max(300),
  category: Joi.string().trim().max(64).allow('', null),
  description: Joi.string().trim().max(10000).allow('', null),
  status: Joi.string().valid(...STATUS_VALUES),
  priority: Joi.number().integer().min(0).max(100),

  startAt: nullableDateInput,
  endAt: nullableDateInput,
  plannedStartAt: nullableDateInput,
  plannedEndAt: nullableDateInput,
  actualStartAt: nullableDateInput,
  actualEndAt: nullableDateInput,

  plannedStartHasTime: Joi.boolean(),
  plannedEndHasTime: Joi.boolean(),
  actualStartHasTime: Joi.boolean(),
  actualEndHasTime: Joi.boolean(),
  startAtHasTime: Joi.boolean(),
  endAtHasTime: Joi.boolean(),

  timezone: Joi.string().trim().max(64).allow('', null),

  participantMode: Joi.string().valid(...MODE_VALUES),
  watcherMode: Joi.string().valid(...MODE_VALUES),
  statusAggregate: Joi.boolean(),

  counterpartyId: uuid.allow(null, ''),
  dealId: uuid.allow(null, ''),
  assigneeIds: Joi.array().items(uuid).unique(),
  watcherIds: Joi.array().items(uuid).unique(),
  departmentIds: Joi.array().items(uuid).unique(),
  contactIds: Joi.array().items(uuid).unique(),
  memberStatuses: Joi.array().items(
    Joi.object({
      userId: uuid.required(),
      memberStatus: Joi.string()
        .valid(...STATUS_VALUES)
        .required(),
    })
  ),
};

module.exports.create = Joi.object({
  companyId: Joi.forbidden(),
  createdBy: Joi.forbidden(),
  userId: Joi.forbidden(),

  title: base.title.required(),
  category: base.category,
  description: base.description,
  status: base.status.default('todo'),
  priority: base.priority.default(50),

  startAt: base.startAt,
  endAt: base.endAt,
  plannedStartAt: base.plannedStartAt,
  plannedEndAt: base.plannedEndAt,
  actualStartAt: base.actualStartAt,
  actualEndAt: base.actualEndAt,

  plannedStartHasTime: base.plannedStartHasTime,
  plannedEndHasTime: base.plannedEndHasTime,
  actualStartHasTime: base.actualStartHasTime,
  actualEndHasTime: base.actualEndHasTime,
  startAtHasTime: base.startAtHasTime,
  endAtHasTime: base.endAtHasTime,

  timezone: base.timezone,
  participantMode: base.participantMode,
  watcherMode: base.watcherMode,
  statusAggregate: base.statusAggregate,

  counterpartyId: base.counterpartyId,
  dealId: base.dealId,
  assigneeIds: base.assigneeIds.default([]),
  watcherIds: base.watcherIds.default([]),
  departmentIds: base.departmentIds.default([]),
  contactIds: base.contactIds.default([]),
  memberStatuses: base.memberStatuses.default([]),
});

module.exports.update = Joi.object({
  companyId: Joi.forbidden(),
  createdBy: Joi.forbidden(),
  userId: Joi.forbidden(),

  title: base.title,
  category: base.category,
  description: base.description,
  status: base.status,
  priority: base.priority,

  startAt: base.startAt,
  endAt: base.endAt,
  plannedStartAt: base.plannedStartAt,
  plannedEndAt: base.plannedEndAt,
  actualStartAt: base.actualStartAt,
  actualEndAt: base.actualEndAt,

  plannedStartHasTime: base.plannedStartHasTime,
  plannedEndHasTime: base.plannedEndHasTime,
  actualStartHasTime: base.actualStartHasTime,
  actualEndHasTime: base.actualEndHasTime,
  startAtHasTime: base.startAtHasTime,
  endAtHasTime: base.endAtHasTime,

  timezone: base.timezone,
  participantMode: base.participantMode,
  watcherMode: base.watcherMode,
  statusAggregate: base.statusAggregate,

  counterpartyId: base.counterpartyId,
  dealId: base.dealId,
  assigneeIds: base.assigneeIds,
  watcherIds: base.watcherIds,
  departmentIds: base.departmentIds,
  contactIds: base.contactIds,
  memberStatuses: base.memberStatuses,
}).min(1);

module.exports.listQuery = Joi.object({
  companyId: Joi.forbidden(),
  q: Joi.string().trim().max(200).allow('', null),
  search: Joi.string().trim().max(200).allow('', null),

  status: Joi.string().valid(...STATUS_VALUES),
  category: Joi.string().trim().max(64),
  counterpartyId: uuid,
  dealId: uuid,

  date: isoOrDateOnly,
  from: isoOrDateOnly,
  to: isoOrDateOnly,

  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(20),
  sort: Joi.string()
    .valid('createdAt', 'updatedAt', 'title', 'status', 'priority', 'startAt', 'endAt')
    .default('createdAt'),
  dir: Joi.string().valid('ASC', 'DESC', 'asc', 'desc').default('DESC'),
});

module.exports.calendarQuery = Joi.object({
  companyId: Joi.forbidden(),
  from: isoOrDateOnly.required(),
  to: isoOrDateOnly.required(),
});

