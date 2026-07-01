'use strict';

const { Op } = require('sequelize');
const {
  sequelize,
  EntityTimelineEvent,
  EntityTimelineLink,
} = require('../../models');

const SECRET_FIELD_PATTERN = /(password|token|secret|key|credential|refresh|access)/i;
const DEFAULT_VISIBILITY = 'company';
const DEFAULT_SEVERITY = 'info';
const DEFAULT_CATEGORY = 'system';

function asText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeType(value) {
  return asText(value).toLowerCase();
}

function normalizeEntityId(value) {
  return asText(value);
}

function normalizeComparable(value) {
  if (value === undefined || value === null) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function compactValue(value) {
  if (value === undefined) return null;
  if (value === null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value.length > 500) {
    return { changed: true, length: value.length };
  }
  if (typeof value === 'object') {
    const json = JSON.stringify(value);
    if (json.length > 1000) return { changed: true, length: json.length };
    return value;
  }
  return value;
}

function sanitizeChanges(changes = []) {
  const rows = Array.isArray(changes)
    ? changes
    : Object.entries(changes || {}).map(([field, value]) => ({
      field,
      oldValue: value?.oldValue ?? value?.old ?? null,
      newValue: value?.newValue ?? value?.new ?? value,
      label: value?.label,
      labelKey: value?.labelKey,
    }));

  return rows
    .filter((row) => row && row.field && !SECRET_FIELD_PATTERN.test(String(row.field)))
    .map((row) => ({
      field: String(row.field),
      labelKey: row.labelKey || null,
      label: row.label || null,
      oldValue: compactValue(row.oldValue),
      newValue: compactValue(row.newValue),
    }))
    .filter((row) => normalizeComparable(row.oldValue) !== normalizeComparable(row.newValue));
}

function normalizeLinks({ companyId, entityType, entityId, relatedEntities = [] }) {
  const seen = new Set();
  const links = [];
  const push = ({ type, id, role }) => {
    const normalizedType = normalizeType(type);
    const normalizedId = normalizeEntityId(id);
    if (!normalizedType || !normalizedId) return;
    const key = `${normalizedType}:${normalizedId}:${role}`;
    if (seen.has(key)) return;
    seen.add(key);
    links.push({
      companyId,
      entityType: normalizedType,
      entityId: normalizedId,
      role,
    });
  };

  push({ type: entityType, id: entityId, role: 'primary' });
  relatedEntities.forEach((entity) => {
    push({
      type: entity.entityType || entity.type,
      id: entity.entityId || entity.id,
      role: entity.role || 'related',
    });
  });
  return links;
}

function isUpdatedNoop(eventType, eventCategory, changes) {
  const type = String(eventType || '');
  const category = String(eventCategory || '');
  return !changes.length && (category === 'updated' || type.endsWith('.updated'));
}

async function record(params = {}) {
  const {
    companyId,
    entityType,
    entityId,
    eventType,
    eventCategory = DEFAULT_CATEGORY,
    title,
    summary = null,
    actorUserId = null,
    actorNameSnapshot = null,
    sourceModule = null,
    sourceEntityType = null,
    sourceEntityId = null,
    relatedEntities = [],
    changes = [],
    payload = null,
    visibility = DEFAULT_VISIBILITY,
    severity = DEFAULT_SEVERITY,
    parentEventId = null,
    correlationId = null,
    requestId = null,
    transaction = null,
  } = params;

  const normalizedEntityType = normalizeType(entityType);
  const normalizedEntityId = normalizeEntityId(entityId);
  const normalizedEventType = asText(eventType);
  const normalizedTitle = asText(title);
  if (!companyId || !normalizedEntityType || !normalizedEntityId || !normalizedEventType || !normalizedTitle) {
    const err = new Error('timeline record requires companyId, entityType, entityId, eventType and title');
    err.status = 400;
    throw err;
  }

  const sanitizedChanges = sanitizeChanges(changes);
  if (isUpdatedNoop(normalizedEventType, eventCategory, sanitizedChanges)) {
    return null;
  }

  const run = async (t) => {
    const links = normalizeLinks({
      companyId,
      entityType: normalizedEntityType,
      entityId: normalizedEntityId,
      relatedEntities,
    });
    if (!links.some((link) => link.role === 'primary')) {
      const err = new Error('timeline primary link is required');
      err.status = 400;
      throw err;
    }

    const related = links.find((link) => link.role !== 'primary');
    const event = await EntityTimelineEvent.create({
      companyId,
      entityType: normalizedEntityType,
      entityId: normalizedEntityId,
      eventType: normalizedEventType,
      eventCategory: eventCategory || DEFAULT_CATEGORY,
      title: normalizedTitle,
      summary,
      actorUserId,
      actorNameSnapshot,
      sourceModule,
      sourceEntityType: sourceEntityType ? normalizeType(sourceEntityType) : null,
      sourceEntityId: sourceEntityId ? normalizeEntityId(sourceEntityId) : null,
      relatedEntityType: related?.entityType || null,
      relatedEntityId: related?.entityId || null,
      parentEventId,
      correlationId,
      requestId,
      changes: sanitizedChanges,
      payload,
      visibility,
      severity,
    }, { transaction: t });

    await EntityTimelineLink.bulkCreate(
      links.map((link) => ({
        ...link,
        timelineEventId: event.id,
      })),
      { transaction: t }
    );

    return event;
  };

  if (transaction) return run(transaction);
  return sequelize.transaction(run);
}

async function list(companyId, query = {}) {
  const entityType = normalizeType(query.entityType);
  const entityId = normalizeEntityId(query.entityId);
  if (!companyId || !entityType || !entityId) {
    const err = new Error('entityType and entityId are required');
    err.status = 400;
    throw err;
  }

  const limit = Math.min(Math.max(Number(query.limit) || 25, 1), 100);
  const eventWhere = { companyId };
  if (query.category) eventWhere.eventCategory = String(query.category);
  if (query.type) eventWhere.eventType = String(query.type);
  if (query.cursor) {
    const cursorDate = new Date(query.cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      eventWhere.createdAt = { [Op.lt]: cursorDate };
    }
  }

  const primaryLinks = await EntityTimelineLink.findAll({
    where: { companyId, entityType, entityId },
    include: [{
      model: EntityTimelineEvent,
      as: 'event',
      where: eventWhere,
      required: true,
    }],
    order: [[{ model: EntityTimelineEvent, as: 'event' }, 'createdAt', 'DESC']],
    limit: limit + 1,
  });

  const pageLinks = primaryLinks.slice(0, limit);
  const eventIds = pageLinks.map((link) => link.timelineEventId);
  const allLinks = eventIds.length
    ? await EntityTimelineLink.findAll({
      where: { companyId, timelineEventId: { [Op.in]: eventIds } },
      order: [['role', 'ASC'], ['createdAt', 'ASC']],
    })
    : [];
  const linksByEventId = allLinks.reduce((acc, link) => {
    const key = String(link.timelineEventId);
    if (!acc[key]) acc[key] = [];
    acc[key].push(link.toJSON());
    return acc;
  }, {});

  const items = pageLinks
    .map((link) => link.event)
    .filter(Boolean)
    .map((event) => ({
      ...event.toJSON(),
      links: linksByEventId[String(event.id)] || [],
    }));

  const last = items[items.length - 1];
  return {
    items,
    nextCursor: primaryLinks.length > limit && last?.createdAt ? new Date(last.createdAt).toISOString() : null,
  };
}

module.exports = {
  record,
  list,
  sanitizeChanges,
};
