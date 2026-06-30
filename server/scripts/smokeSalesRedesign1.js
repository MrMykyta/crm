'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Counterparty,
  Contact,
  CrmDealLostReason,
  CrmDealSetting,
  CrmPipeline,
  CrmPipelineStage,
  Deal,
  Task,
  User,
  UserCompany,
} = require('../src/models');
const pipelineService = require('../src/services/crm/pipelineService');
const dealService = require('../src/services/crm/dealService');
const dealSettingsService = require('../src/services/crm/dealSettingsService');

const results = [];

function check(name, condition, extra = '') {
  const ok = Boolean(condition);
  results.push({ name, ok });
  // eslint-disable-next-line no-console
  console.log(`${ok ? 'PASS' : 'FAIL'} - ${name}${extra ? ` :: ${extra}` : ''}`);
}

function userCtx(user, companyId) {
  return { id: user.id, companyId };
}

async function createCompanyWithOwner(suffix) {
  const owner = await User.create({
    id: uuidv4(),
    email: `sales-redesign-1-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
  const company = await Company.create({
    id: uuidv4(),
    name: `Sales Redesign 1 ${suffix}`,
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

async function createContact(companyId, counterpartyId, suffix) {
  return Contact.create({
    id: uuidv4(),
    companyId,
    counterpartyId,
    firstName: 'Alex',
    lastName: `Buyer ${suffix}`.slice(0, 100),
    email: `alex.buyer.${suffix}@example.test`,
    phone: '+48123456789',
    status: 'active',
    isPrimary: true,
  });
}

async function createTask(companyId, userId, suffix) {
  const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return Task.create({
    id: uuidv4(),
    companyId,
    createdBy: userId,
    title: `Next action ${suffix}`,
    status: 'todo',
    priority: 70,
    visibility: 'company',
    startAt: start,
    endAt: end,
  });
}

(async () => {
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const { owner, company } = await createCompanyWithOwner(suffix);
    created.companyIds.push(company.id);
    created.userIds.push(owner.id);
    const user = userCtx(owner, company.id);

    await dealSettingsService.updateSettings(company.id, {
      defaultExpectedCloseDays: 14,
      probabilityMode: 'hybrid',
      defaultCurrency: 'PLN',
    });

    const pipeline = await pipelineService.createPipeline(company.id, {
      name: `Lifecycle ${suffix}`,
      color: '#2563eb',
      isDefault: true,
    });
    const entry = await pipelineService.addStage(company.id, pipeline.id, {
      name: 'Qualification',
      color: '#64748b',
      probability: 15,
      isDefaultEntry: true,
    });
    const proposal = await pipelineService.addStage(company.id, pipeline.id, {
      name: 'Proposal',
      color: '#f59e0b',
      probability: 55,
    });
    const won = await pipelineService.addStage(company.id, pipeline.id, {
      name: 'Won',
      color: '#22c55e',
      probability: 100,
      isWon: true,
    });
    const lost = await pipelineService.addStage(company.id, pipeline.id, {
      name: 'Lost',
      color: '#ef4444',
      probability: 0,
      isLost: true,
    });

    const counterparty = await createCounterparty(company.id, 'Foundation CP', suffix);
    const contact = await createContact(company.id, counterparty.id, suffix);
    const nextActionTask = await createTask(company.id, owner.id, suffix);
    const lostReason = await dealSettingsService.createLostReason(company.id, {
      name: `Budget lost ${suffix}`,
    });

    const explicitCloseDate = '2030-01-15';
    const nextActionAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    const healthComputedAt = new Date();
    const deal = await dealService.create({
      counterpartyId: counterparty.id,
      contactId: contact.id,
      title: `Foundation deal ${suffix}`,
      pipelineId: pipeline.id,
      stageId: entry.id,
      value: 1200,
      currency: 'PLN',
      expectedCloseDate: explicitCloseDate,
      nextActionAt,
      nextActionType: 'call',
      nextActionTaskId: nextActionTask.id,
      probability: 42,
      priority: 80,
      source: 'web',
      healthStatus: 'waiting',
      healthComputedAt,
    }, { companyId: company.id, user });

    check(
      'create stores foundation fields',
      deal.contactId === contact.id
        && String(deal.expectedCloseDate).slice(0, 10) === explicitCloseDate
        && deal.nextActionTaskId === nextActionTask.id
        && deal.nextActionType === 'call'
        && Number(deal.probability) === 42
        && Number(deal.priority) === 80
        && deal.healthStatus === 'waiting'
    );
    check('create derives status from default entry stage', deal.status === 'new' && deal.stageId === entry.id);

    const updated = await dealService.update(deal.id, {
      probability: 55,
      priority: 60,
      nextActionType: 'meeting',
      healthStatus: 'at_risk',
    }, { companyId: company.id, user });
    check(
      'update preserves model-only foundation fields',
      Number(updated.probability) === 55
        && Number(updated.priority) === 60
        && updated.nextActionType === 'meeting'
        && updated.healthStatus === 'at_risk'
    );

    const moved = await dealService.moveStage(deal.id, { stageId: proposal.id }, { companyId: company.id, user });
    check(
      'moveStage derives in-progress status',
      moved.stageId === proposal.id
        && moved.status === 'in_progress'
        && Boolean(moved.stageEnteredAt)
        && !moved.closedAt
    );

    const wonDeal = await dealService.markWon(deal.id, {}, { companyId: company.id, user });
    check(
      'markWon delegates to terminal won stage',
      wonDeal.stageId === won.id
        && wonDeal.status === 'won'
        && Boolean(wonDeal.closedAt)
        && !wonDeal.lostReasonId
    );

    const lostDeal = await dealService.markLost(deal.id, {
      lostReasonId: lostReason.id,
      lostNote: 'Customer selected competitor',
    }, { companyId: company.id, user });
    check(
      'markLost persists lost reason and note',
      lostDeal.stageId === lost.id
        && lostDeal.status === 'lost'
        && lostDeal.lostReasonId === lostReason.id
        && lostDeal.lostNote === 'Customer selected competitor'
        && Boolean(lostDeal.closedAt)
    );

    const rawStatusCounterparty = await createCounterparty(company.id, 'Raw Status CP', suffix);
    const rawStatusDeal = await dealService.create({
      counterpartyId: rawStatusCounterparty.id,
      title: `Raw status compatibility ${suffix}`,
      pipelineId: pipeline.id,
      stageId: entry.id,
    }, { companyId: company.id, user });
    const rawWon = await dealService.update(rawStatusDeal.id, { status: 'won' }, { companyId: company.id, user });
    check('legacy status=won update moves through won stage', rawWon.status === 'won' && rawWon.stageId === won.id);

    const defaultCounterparty = await createCounterparty(company.id, 'Default Close CP', suffix);
    const defaultDeal = await dealService.create({
      counterpartyId: defaultCounterparty.id,
      title: `Default expected close ${suffix}`,
      pipelineId: pipeline.id,
      stageId: entry.id,
    }, { companyId: company.id, user });
    check('settings defaultExpectedCloseDays applies on create', Boolean(defaultDeal.expectedCloseDate));

    const removed = await dealService.remove(deal.id, { companyId: company.id, user });
    const hidden = await dealService.getById(deal.id, { companyId: company.id, user });
    const deletedRow = await Deal.findOne({
      where: { id: deal.id, companyId: company.id },
      paranoid: false,
    });
    check('remove soft deletes deal', removed === 1 && !hidden && Boolean(deletedRow?.deletedAt));

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
    console.error('smokeSalesRedesign1 crashed', err);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
        await Deal.destroy({ where: { companyId: created.companyIds }, force: true });
        await Task.destroy({ where: { companyId: created.companyIds }, force: true });
        await Contact.destroy({ where: { companyId: created.companyIds }, force: true });
        await CrmDealLostReason.destroy({ where: { companyId: created.companyIds }, force: true });
        await CrmDealSetting.destroy({ where: { companyId: created.companyIds }, force: true });
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
      console.error('smokeSalesRedesign1 cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
