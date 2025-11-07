// src/schemas/taskSchema.js
const { Joi, uuid, paging, dateISO } = require('./_common');

// Базовые enum’ы
const status = Joi.string().valid('pending', 'in_progress', 'done', 'cancelled').required();
const priority = Joi.string().valid('low', 'medium', 'high').required();

const base = {
  companyId: uuid.required(),
  userId: uuid.required(), // ← ОБЯЗАТЕЛЕН: кто создал (creatorId)
  title: Joi.string().min(1).max(256).required(),
  description: Joi.string().allow('', null).required(),
  status,
  priority,

  // всё ниже — ОПЦИОНАЛЬНО:
  assigneeId: uuid.allow(null),
  counterpartyId: uuid.allow(null),
  dealId: uuid.allow(null),

  // мягкие планировочные поля (не обязательные)
  isAllDay: Joi.boolean().optional(),
  eventDate: dateISO.allow(null),
  startAt: dateISO.allow(null),
  endAt: dateISO.allow(null),

  // орг/владение
  ownerType: Joi.string().valid('user', 'department').optional(),
  ownerId: uuid.allow(null),
  tags: Joi.array().items(Joi.string().trim()).default([]),

  // дедлайны/план
  dueDate: dateISO.allow(null),
  plannedDate: dateISO.allow(null),
};

module.exports.create = Joi.object({
  companyId: base.companyId,
  userId: base.userId,           // пишем в createdBy на сервисе
  title: base.title,
  description: base.description,
  status: base.status,
  priority: base.priority,

  assigneeId: base.assigneeId.optional(),
  counterpartyId: base.counterpartyId.optional(),
  dealId: base.dealId.optional(),

  // опционально, без жёстких требований
  isAllDay: base.isAllDay,
  eventDate: base.eventDate,
  startAt: base.startAt,
  endAt: base.endAt,

  ownerType: base.ownerType,
  ownerId: base.ownerId,
  tags: base.tags,
  dueDate: base.dueDate,
  plannedDate: base.plannedDate,
});

module.exports.update = Joi.object({
  // companyId менять нельзя (если очень нужно — убери запрет)
  title: base.title.optional(),
  description: base.description.optional(),
  status: base.status.optional(),
  priority: base.priority.optional(),

  assigneeId: base.assigneeId.optional(),
  counterpartyId: base.counterpartyId.optional(),
  dealId: base.dealId.optional(),

  isAllDay: base.isAllDay,
  eventDate: base.eventDate,
  startAt: base.startAt,
  endAt: base.endAt,

  ownerType: base.ownerType,
  ownerId: base.ownerId,
  tags: base.tags,
  dueDate: base.dueDate,
  plannedDate: base.plannedDate,
}).min(1);

module.exports.listQuery = paging.keys({
  companyId: uuid,       // можно прокинуть явно, но обычный scope возьмём из req.params/req.user
  q: Joi.string().max(200),

  status: Joi.string().valid('pending', 'in_progress', 'done', 'cancelled'),
  priority: Joi.alternatives().try(
    Joi.string().valid('low', 'medium', 'high'),
    Joi.number().integer().min(1).max(5)
  ),

  assigneeId: uuid,
  creatorId: uuid,
  counterpartyId: uuid,
  dealId: uuid,

  ownerType: Joi.string().valid('user', 'department'),
  ownerId: uuid,

  dueFrom: dateISO,
  dueTo: dateISO,

  plannedFrom: dateISO,
  plannedTo: dateISO,

  // “мягкие” события (если вдруг фильтровать)
  from: dateISO, // для календаря
  to: dateISO,
});

module.exports.calendarQuery = Joi.object({
  from: dateISO.required(),
  to: dateISO.required(),
  companyId: uuid.optional(),
  assigneeId: uuid.optional(),
  ownerType: Joi.string().valid('user', 'department').optional(),
  ownerId: uuid.optional(),
  q: Joi.string().max(200).optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(200).default(200),
});