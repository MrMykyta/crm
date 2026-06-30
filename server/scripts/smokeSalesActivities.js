'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Counterparty,
  CrmDealActivity,
  CrmPipeline,
  CrmPipelineStage,
  Deal,
  User,
  UserCompany,
} = require('../src/models');
const pipelineService = require('../src/services/crm/pipelineService');
const dealService = require('../src/services/crm/dealService');
const dealActivityService = require('../src/services/crm/dealActivityService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

async function expectReject(name, fn, expectedText = '') {
  try {
    await fn();
    check(name, false, 'did not reject');
  } catch (error) {
    const message = String(error?.message || '');
    check(name, expectedText ? message.includes(expectedText) : true, message);
  }
}

function userCtx(user, companyId) {
  return { id: user.id, companyId };
}

async function createCompanyWithOwner(label, suffix) {
  const owner = await User.create({
    id: uuidv4(),
    email: `sales-activities-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
  const company = await Company.create({
    id: uuidv4(),
    name: `Sales Activities ${label} ${suffix}`,
    ownerUserId: owner.id,
  });
  await UserCompany.create({
    id: uuidv4(),
    userId: owner.id,
    companyId: company.id,
    role: 'owner',
    status: 'active',
  });
  return { owner, company };
}

async function createCounterparty(companyId, label, suffix) {
  return Counterparty.create({
    id: uuidv4(),
    companyId,
    shortName: `${label}-${suffix}`.slice(0, 80),
    fullName: `${label} ${suffix} Sp. z o.o.`,
    type: 'client',
    status: 'active',
    isCompany: true,
  });
}

(async () => {
  const created = { companyIds: [], userIds: [] };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const primary = await createCompanyWithOwner('primary', suffix);
    const secondary = await createCompanyWithOwner('secondary', suffix);
    created.companyIds.push(primary.company.id, secondary.company.id);
    created.userIds.push(primary.owner.id, secondary.owner.id);

    const pipeline = await pipelineService.createPipeline(primary.company.id, {
      name: `Activity pipeline ${suffix}`,
      isDefault: true,
    });
    const entry = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Qualification',
      isDefaultEntry: true,
      probability: 10,
    });
    const proposal = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Proposal',
      probability: 50,
    });
    const won = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Won',
      probability: 100,
      isWon: true,
    });
    const lost = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Lost',
      probability: 0,
      isLost: true,
    });
    const counterparty = await createCounterparty(primary.company.id, 'Activity CP', suffix);

    const deal = await dealService.create({
      counterpartyId: counterparty.id,
      title: `Activity smoke deal ${suffix}`,
      pipelineId: pipeline.id,
      stageId: entry.id,
      value: 1000,
      currency: 'PLN',
    }, { companyId: primary.company.id, user: userCtx(primary.owner, primary.company.id) });

    let activities = await dealActivityService.listActivities(primary.company.id, deal.id);
    check('create deal creates deal_created activity', activities.some((item) => item.type === 'deal_created' && item.title === 'deal_created'));

    const note = await dealActivityService.createActivity(primary.company.id, deal.id, primary.owner.id, {
      type: 'note',
      body: 'Smoke note',
    });
    check('create note activity', note.type === 'note' && note.body === 'Smoke note');

    for (const type of ['call', 'email', 'meeting', 'task']) {
      const row = await dealActivityService.createActivity(primary.company.id, deal.id, primary.owner.id, {
        type,
        title: `Smoke ${type}`,
        body: `Smoke ${type} body`,
      });
      check(`create ${type} activity`, row.type === type);
    }

    activities = await dealActivityService.listActivities(primary.company.id, deal.id);
    check('list activities returns manual and system events', activities.length >= 6);

    await dealService.moveStage(deal.id, { stageId: proposal.id }, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    activities = await dealActivityService.listActivities(primary.company.id, deal.id);
    check(
      'move stage creates stage_change activity',
      activities.some((item) => (
        item.type === 'stage_change'
        && item.metadata?.fromStageId === entry.id
        && item.metadata?.toStageId === proposal.id
      ))
    );

    await dealService.markWon(deal.id, {}, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    activities = await dealActivityService.listActivities(primary.company.id, deal.id);
    check('mark won creates status_change activity', activities.some((item) => item.type === 'status_change' && item.metadata?.status === 'won'));

    await dealService.moveStage(deal.id, { stageId: proposal.id }, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    await dealService.markLost(deal.id, { lostNote: 'Smoke lost' }, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    activities = await dealActivityService.listActivities(primary.company.id, deal.id);
    check('mark lost creates status_change activity', activities.some((item) => item.type === 'status_change' && item.metadata?.status === 'lost'));

    const beforeDelete = await dealActivityService.listActivities(primary.company.id, deal.id);
    const deleteTarget = beforeDelete.find((item) => item.type === 'note');
    const deleted = await dealActivityService.deleteActivity(primary.company.id, deal.id, deleteTarget.id);
    const afterDelete = await dealActivityService.listActivities(primary.company.id, deal.id);
    check('delete activity removes from list', deleted === 1 && !afterDelete.some((item) => item.id === deleteTarget.id));

    await expectReject(
      'manual endpoint rejects system activity',
      () => dealActivityService.createActivity(primary.company.id, deal.id, primary.owner.id, {
        type: 'system',
        title: 'bad',
      }),
      'system activity'
    );

    await expectReject(
      'company scope enforced on list',
      () => dealActivityService.listActivities(secondary.company.id, deal.id),
      'dealId is invalid'
    );

    const failed = results.filter((item) => !item.ok);
    // eslint-disable-next-line no-console
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    if (failed.length) {
      // eslint-disable-next-line no-console
      console.error('FAILED:', failed.map((item) => item.name).join('; '));
      process.exitCode = 1;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('smokeSalesActivities crashed', err);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await CrmDealActivity.destroy({ where: { companyId: created.companyIds }, force: true });
        await Deal.destroy({ where: { companyId: created.companyIds }, force: true });
        await CrmPipelineStage.destroy({ where: { companyId: created.companyIds }, force: true });
        await CrmPipeline.destroy({ where: { companyId: created.companyIds }, force: true });
        await Counterparty.destroy({ where: { companyId: created.companyIds }, force: true });
        await UserCompany.destroy({ where: { companyId: created.companyIds }, force: true });
        await Company.destroy({ where: { id: created.companyIds }, force: true });
      }
      if (created.userIds.length) {
        await User.destroy({ where: { id: created.userIds }, force: true });
      }
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.error('smokeSalesActivities cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
