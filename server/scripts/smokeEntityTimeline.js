'use strict';

const crypto = require('crypto');
const {
  sequelize,
  Company,
  User,
  UserCompany,
  Counterparty,
  ContactPoint,
  Notification,
  EntityTimelineEvent,
  EntityTimelineLink,
} = require('../src/models');
const counterpartyService = require('../src/services/crm/counterpartyService');
const timelineService = require('../src/services/system/timelineService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function getChange(event, field) {
  const changes = Array.isArray(event?.changes) ? event.changes : [];
  return changes.find((change) => change.field === field);
}

async function cleanup(ids) {
  if (!ids.companyId) return;
  await EntityTimelineLink.destroy({ where: { companyId: ids.companyId }, force: true });
  await EntityTimelineEvent.destroy({ where: { companyId: ids.companyId }, force: true });
  await Notification.destroy({ where: { companyId: ids.companyId }, force: true });
  await ContactPoint.destroy({ where: { companyId: ids.companyId }, force: true });
  await Counterparty.destroy({ where: { companyId: ids.companyId }, force: true });
  await UserCompany.destroy({ where: { companyId: ids.companyId }, force: true });
  await Company.destroy({ where: { id: ids.companyId }, force: true });
  if (ids.userId) {
    await User.destroy({ where: { id: ids.userId }, force: true });
  }
}

(async () => {
  const ids = {};

  try {
    await sequelize.authenticate();

    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const owner = await User.create({
      id: crypto.randomUUID(),
      email: `timeline-smoke-${suffix}@example.test`,
      passwordHash: 'smoke',
      firstName: 'Timeline',
      lastName: 'Smoke',
      emailVerifiedAt: new Date(),
    });
    ids.userId = owner.id;

    const company = await Company.create({
      id: crypto.randomUUID(),
      name: `Timeline Smoke ${suffix}`,
      ownerUserId: owner.id,
    });
    ids.companyId = company.id;

    await UserCompany.create({
      id: crypto.randomUUID(),
      userId: owner.id,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    });

    const counterparty = await counterpartyService.create(owner.id, company.id, {
      shortName: `Timeline Customer ${suffix}`.slice(0, 120),
      fullName: `Timeline Customer ${suffix} Sp. z o.o.`,
      type: 'client',
      status: 'active',
      isCompany: true,
      postalCode: '10-100',
      city: 'Warszawa',
    });

    const createdEvent = await EntityTimelineEvent.findOne({
      where: {
        companyId: company.id,
        entityType: 'counterparty',
        entityId: counterparty.id,
        eventType: 'counterparty.created',
      },
    });
    check('Create counterparty records timeline event', Boolean(createdEvent), createdEvent?.id || '');

    const primaryLink = await EntityTimelineLink.findOne({
      where: {
        companyId: company.id,
        timelineEventId: createdEvent?.id || null,
        entityType: 'counterparty',
        entityId: counterparty.id,
        role: 'primary',
      },
    });
    check('Timeline event creates primary link', Boolean(primaryLink), primaryLink?.id || '');

    await counterpartyService.update(owner.id, company.id, counterparty.id, {
      postalCode: '10-200',
    });

    const updatedEvents = await EntityTimelineEvent.findAll({
      where: {
        companyId: company.id,
        entityType: 'counterparty',
        entityId: counterparty.id,
        eventType: 'counterparty.updated',
      },
      order: [['createdAt', 'DESC']],
    });
    const postalChange = getChange(updatedEvents[0], 'postalCode');
    check('Update counterparty records timeline event', updatedEvents.length === 1, `count=${updatedEvents.length}`);
    check(
      'Timeline change includes old/new postalCode',
      postalChange?.oldValue === '10-100' && postalChange?.newValue === '10-200',
      `${postalChange?.oldValue || 'null'} -> ${postalChange?.newValue || 'null'}`
    );

    await counterpartyService.update(owner.id, company.id, counterparty.id, {
      postalCode: '10-200',
    });
    const noOpUpdateCount = await EntityTimelineEvent.count({
      where: {
        companyId: company.id,
        entityType: 'counterparty',
        entityId: counterparty.id,
        eventType: 'counterparty.updated',
      },
    });
    check('No-op update does not create timeline event', noOpUpdateCount === 1, `count=${noOpUpdateCount}`);

    const relatedEntityId = crypto.randomUUID();
    const relatedEvent = await timelineService.record({
      companyId: company.id,
      entityType: 'counterparty',
      entityId: counterparty.id,
      eventType: 'counterparty.related_smoke',
      eventCategory: 'system',
      title: 'Related timeline smoke',
      summary: 'Smoke related entity link',
      actorUserId: owner.id,
      actorNameSnapshot: 'Timeline Smoke',
      sourceModule: 'crm',
      relatedEntities: [
        { entityType: 'deal', entityId: relatedEntityId, role: 'related' },
      ],
      changes: [
        { field: 'status', oldValue: 'draft', newValue: 'linked' },
      ],
    });
    check('Related timeline event is recorded', Boolean(relatedEvent?.id), relatedEvent?.id || '');

    const relatedTimeline = await timelineService.list(company.id, {
      entityType: 'deal',
      entityId: relatedEntityId,
      limit: 10,
    });
    check(
      'Related link surfaces event on second entity',
      relatedTimeline.items.some((event) => event.id === relatedEvent.id),
      `items=${relatedTimeline.items.length}`
    );

    const counterpartyTimeline = await timelineService.list(company.id, {
      entityType: 'counterparty',
      entityId: counterparty.id,
      limit: 10,
    });
    check(
      'GET timeline service returns counterparty events without notifications',
      counterpartyTimeline.items.length >= 3,
      `items=${counterpartyTimeline.items.length}`
    );

    await cleanup(ids);

    const failed = results.filter((result) => !result.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((result) => result.name).join('; '));
      process.exitCode = 1;
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('smoke:entity-timeline failed:', error);
    process.exitCode = 1;
  } finally {
    try {
      await cleanup(ids);
    } catch (cleanupError) {
      // eslint-disable-next-line no-console
      console.error('cleanup failed:', cleanupError);
      process.exitCode = 1;
    }
    await sequelize.close();
  }
})();
