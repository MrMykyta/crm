'use strict';

const {
  CrmDealActivity,
  Deal,
  User,
} = require('../../models');

const MANUAL_TYPES = new Set(['note', 'call', 'email', 'meeting', 'task']);
const SYSTEM_TYPES = new Set(['deal_created', 'stage_change', 'status_change', 'system']);
const ALL_TYPES = new Set([...MANUAL_TYPES, ...SYSTEM_TYPES]);

function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  return companyId;
}

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

async function assertDealInCompany(companyId, dealId) {
  if (!dealId) {
    const err = new Error('dealId is required');
    err.status = 400;
    throw err;
  }
  const deal = await Deal.findOne({
    where: { id: dealId, companyId },
    attributes: ['id', 'companyId', 'title', 'stageId', 'status'],
  });
  if (!deal) {
    const err = new Error('dealId is invalid');
    err.status = 404;
    throw err;
  }
  return deal;
}

function buildInclude() {
  return [{
    model: User,
    as: 'author',
    attributes: ['id', 'email', 'firstName', 'lastName', 'avatarUrl'],
    required: false,
  }];
}

function normalizePayload(payload = {}, { allowSystem = false } = {}) {
  const type = asText(payload.type);
  if (!ALL_TYPES.has(type)) {
    const err = new Error('type is invalid');
    err.status = 400;
    throw err;
  }
  if (!allowSystem && SYSTEM_TYPES.has(type)) {
    const err = new Error('system activity cannot be created from this endpoint');
    err.status = 400;
    throw err;
  }

  const title = asText(payload.title) || null;
  const body = asText(payload.body) || null;
  if (MANUAL_TYPES.has(type) && !title && !body) {
    const err = new Error('title or body is required');
    err.status = 400;
    throw err;
  }

  const occurredAt = payload.occurredAt ? new Date(payload.occurredAt) : new Date();
  if (Number.isNaN(occurredAt.getTime())) {
    const err = new Error('occurredAt is invalid');
    err.status = 400;
    throw err;
  }

  return {
    type,
    title,
    body,
    occurredAt,
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : null,
  };
}

module.exports.listActivities = async (companyId, dealId, filters = {}) => {
  const cid = requireCompanyId(companyId);
  await assertDealInCompany(cid, dealId);

  const where = { companyId: cid, dealId };
  if (filters.type) {
    if (!ALL_TYPES.has(String(filters.type))) {
      const err = new Error('type is invalid');
      err.status = 400;
      throw err;
    }
    where.type = filters.type;
  }

  const limit = Math.min(Math.max(Number(filters.limit || 50), 1), 100);
  return CrmDealActivity.findAll({
    where,
    include: buildInclude(),
    order: [['occurredAt', 'DESC'], ['createdAt', 'DESC']],
    limit,
  });
};

module.exports.createActivity = async (companyId, dealId, userId, payload = {}) => {
  const cid = requireCompanyId(companyId);
  await assertDealInCompany(cid, dealId);
  const normalized = normalizePayload(payload);
  return CrmDealActivity.create({
    ...normalized,
    companyId: cid,
    dealId,
    authorId: userId || null,
  });
};

module.exports.deleteActivity = async (companyId, dealId, activityId) => {
  const cid = requireCompanyId(companyId);
  await assertDealInCompany(cid, dealId);
  if (!activityId) {
    const err = new Error('activityId is required');
    err.status = 400;
    throw err;
  }
  return CrmDealActivity.destroy({
    where: { id: activityId, companyId: cid, dealId },
  });
};

module.exports.createSystemActivity = async (companyId, dealId, payload = {}) => {
  const cid = requireCompanyId(companyId);
  await assertDealInCompany(cid, dealId);
  const normalized = normalizePayload(payload, { allowSystem: true });
  return CrmDealActivity.create({
    ...normalized,
    companyId: cid,
    dealId,
    authorId: payload.authorId || null,
  });
};

module.exports.types = {
  manual: [...MANUAL_TYPES],
  system: [...SYSTEM_TYPES],
  all: [...ALL_TYPES],
};
