const { Joi, uuid, paging, dateISO } = require('./_common');

const ownerType = Joi.string().valid(
  'counterparty', 'contact', 'user', 'company', 'department'
);
const channel = Joi.string().valid(
  'phone',
  'email',
  'website',
  'whatsapp',
  'telegram',
  'messenger',
  'facebook',
  'instagram',
  'linkedin',
  'youtube',
  'tiktok',
  'custom',
  'viber',
  'other'
);

const base = {
  companyId: uuid,
  ownerType,
  ownerId: uuid,
  channel,
  value: Joi.string().max(256),
  valueRaw: Joi.string().max(256),
  valueNorm: Joi.string().max(256).allow(null, ''),
  label: Joi.string().max(64).allow(null, ''),
  isPrimary: Joi.boolean(),
  isPublic: Joi.boolean(),
  verifiedAt: dateISO.allow(null),
  notes: Joi.string().max(5000).allow(null, ''),
  createdBy: uuid.allow(null),
};

module.exports.create = Joi.object({
  companyId: base.companyId.optional(),
  ownerType: base.ownerType.required(),
  ownerId: base.ownerId.required(),
  channel: base.channel.required(),
  value: base.value.optional(),
  valueRaw: base.valueRaw.optional(),
  valueNorm: base.valueNorm.optional(),
  label: base.label.optional(),
  isPrimary: base.isPrimary.optional(),
  isPublic: base.isPublic.optional(),
  verifiedAt: base.verifiedAt.optional(),
  notes: base.notes.optional(),
  createdBy: base.createdBy.optional(),
}).or('value', 'valueRaw');

module.exports.update = Joi.object({
  companyId: base.companyId.optional(),
  ownerType: base.ownerType.optional(),
  ownerId: base.ownerId.optional(),
  channel: base.channel.optional(),
  value: base.value.optional(),
  valueRaw: base.valueRaw.optional(),
  valueNorm: base.valueNorm.optional(),
  label: base.label.optional(),
  isPrimary: base.isPrimary.optional(),
  isPublic: base.isPublic.optional(),
  verifiedAt: base.verifiedAt.optional(),
  notes: base.notes.optional(),
  createdBy: base.createdBy.optional(),
}).min(1);

module.exports.listQuery = paging.keys({
  companyId: base.companyId,
  ownerType: base.ownerType,
  ownerId: base.ownerId,
  channel: base.channel,
  q: Joi.string().max(200), // поиск по valueNorm/valueRaw
});
