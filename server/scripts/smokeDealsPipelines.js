'use strict';

const { v4: uuidv4 } = require('uuid');
const {
  sequelize,
  Company,
  Counterparty,
  CrmPipeline,
  CrmPipelineStage,
  Deal,
  User,
  UserCompany,
} = require('../src/models');
const pipelineService = require('../src/services/crm/pipelineService');
const dealService = require('../src/services/crm/dealService');

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

async function createUser(label, suffix) {
  return User.create({
    id: uuidv4(),
    email: `deals-pipelines-${label}-${suffix}@example.test`,
    passwordHash: 'smoke',
    emailVerifiedAt: new Date(),
  });
}

async function createCompanyWithOwner(label, suffix) {
  const owner = await createUser(label, suffix);
  const company = await Company.create({
    id: uuidv4(),
    name: `Deals Pipelines ${label} ${suffix}`,
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
  const created = {
    companyIds: [],
    userIds: [],
  };

  try {
    const suffix = `${Date.now()}-${uuidv4().slice(0, 8)}`;
    const primary = await createCompanyWithOwner('primary', suffix);
    const secondary = await createCompanyWithOwner('secondary', suffix);
    created.companyIds.push(primary.company.id, secondary.company.id);
    created.userIds.push(primary.owner.id, secondary.owner.id);

    const pipeline = await pipelineService.createPipeline(primary.company.id, {
      name: `Sales ${suffix}`,
      color: '#2563eb',
      description: 'DEALS-1 smoke primary pipeline',
      isDefault: true,
    });
    check('create pipeline stores rich attrs', pipeline.name.includes('Sales') && pipeline.color === '#2563eb' && pipeline.isDefault === true);

    const entry = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Qualification',
      probability: 10,
      color: '#94a3b8',
      isDefaultEntry: true,
      rotDays: 7,
    });
    const proposal = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Proposal',
      probability: 50,
      color: '#f59e0b',
      wipLimit: 5,
    });
    const won = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Won',
      probability: 100,
      color: '#22c55e',
      isWon: true,
      isLost: true,
    });
    const lost = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Lost',
      probability: 0,
      color: '#ef4444',
      isLost: true,
    });
    check('create stages with order/default/won/lost/rotDays', entry.isDefaultEntry && Number(entry.rotDays) === 7 && won.isWon && !won.isLost && lost.isLost);

    const listed = await pipelineService.list(primary.company.id);
    const listedPipeline = listed.find((item) => item.id === pipeline.id);
    const listedStageIds = (listedPipeline?.stages || []).map((stage) => stage.id);
    check('list returns stages ordered', listedStageIds[0] === entry.id && listedStageIds[1] === proposal.id);

    const secondPipeline = await pipelineService.createPipeline(primary.company.id, {
      name: `Expansion ${suffix}`,
    });
    const updatedSecondPipeline = await pipelineService.updatePipeline(primary.company.id, secondPipeline.id, {
      isDefault: true,
    });
    const reloadedFirst = await CrmPipeline.findByPk(pipeline.id);
    check('update pipeline default unsets previous default', updatedSecondPipeline.isDefault === true && reloadedFirst.isDefault === false);

    const updatedTerminal = await pipelineService.updateStage(primary.company.id, pipeline.id, lost.id, {
      isWon: true,
      isLost: true,
    });
    check('update stage isWon clears isLost', updatedTerminal.isWon === true && updatedTerminal.isLost === false);
    await pipelineService.updateStage(primary.company.id, pipeline.id, lost.id, { isWon: false, isLost: true });
    await pipelineService.updateStage(primary.company.id, pipeline.id, won.id, { isWon: true });

    const reorderResult = await pipelineService.reorderStages(primary.company.id, pipeline.id, [
      lost.id,
      entry.id,
      proposal.id,
      won.id,
    ]);
    check(
      'reorder stages persists contiguous order',
      reorderResult.map((stage) => stage.order).join(',') === '0,1,2,3'
        && reorderResult[0].id === lost.id
    );

    const counterparty = await createCounterparty(primary.company.id, 'Deal CP', suffix);
    const deal = await dealService.create({
      counterpartyId: counterparty.id,
      title: `Pipeline smoke deal ${suffix}`,
      pipelineId: pipeline.id,
      stageId: entry.id,
      value: 1000,
      currency: 'PLN',
    }, { companyId: primary.company.id, user: userCtx(primary.owner, primary.company.id) });
    check('create deal in pipeline/stage', deal.pipelineId === pipeline.id && deal.stageId === entry.id);

    const movedNormal = await dealService.moveStage(deal.id, { stageId: proposal.id }, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    check('move deal to normal stage updates stageEnteredAt/status', movedNormal.stageId === proposal.id && movedNormal.status === 'in_progress' && Boolean(movedNormal.stageEnteredAt));

    const movedWon = await dealService.moveStage(deal.id, { stageId: won.id }, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    check('move deal to won stage sets status won', movedWon.status === 'won' && movedWon.stageId === won.id);

    const movedLost = await dealService.moveStage(deal.id, { stageId: lost.id }, {
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    check('move deal to lost stage sets status lost', movedLost.status === 'lost' && movedLost.stageId === lost.id);

    const board = await dealService.board({
      query: { pipelineId: pipeline.id, perStageLimit: 20 },
      companyId: primary.company.id,
      user: userCtx(primary.owner, primary.company.id),
    });
    const lostColumn = board.stages.find((stage) => stage.id === lost.id);
    check(
      'server board returns pipeline stages counts totals forecast',
      board.pipeline?.id === pipeline.id
        && board.totals.count === 1
        && lostColumn?.count === 1
        && Number(lostColumn?.sum?.PLN || 0) === 1000
        && Number(lostColumn?.weighted?.PLN || 0) === 0
    );

    const foreignPipeline = await pipelineService.createPipeline(secondary.company.id, {
      name: `Foreign ${suffix}`,
      isDefault: true,
    });
    const foreignStage = await pipelineService.addStage(secondary.company.id, foreignPipeline.id, {
      name: 'Foreign stage',
      isDefaultEntry: true,
    });
    await expectReject(
      'cross-company stage move rejected',
      () => dealService.moveStage(deal.id, { stageId: foreignStage.id }, {
        companyId: primary.company.id,
        user: userCtx(primary.owner, primary.company.id),
      }),
      'stageId is invalid'
    );

    await pipelineService.updatePipeline(primary.company.id, secondPipeline.id, { archived: true });
    await expectReject(
      'cannot archive/delete last active pipeline',
      () => pipelineService.deletePipeline(primary.company.id, pipeline.id),
      'last active pipeline'
    );

    await expectReject(
      'cannot delete stage with deals without replacement',
      () => pipelineService.deleteStage(primary.company.id, pipeline.id, lost.id),
      'replacementStageId is required'
    );

    const replacement = await pipelineService.addStage(primary.company.id, pipeline.id, {
      name: 'Replacement',
      probability: 25,
    });
    const deleteWithReplacement = await pipelineService.deleteStage(primary.company.id, pipeline.id, lost.id, {
      replacementStageId: replacement.id,
    });
    const movedAfterReplacement = await Deal.findByPk(deal.id);
    check('delete stage with replacement moves deals', deleteWithReplacement.movedDeals === 1 && movedAfterReplacement.stageId === replacement.id);

    const crudCounterparty = await createCounterparty(primary.company.id, 'Deal CRUD CP', suffix);
    const crudDeal = await dealService.create({
      counterpartyId: crudCounterparty.id,
      title: `CRUD smoke deal ${suffix}`,
      value: 500,
      currency: 'PLN',
    }, { companyId: primary.company.id, user: userCtx(primary.owner, primary.company.id) });
    const crudDetail = await dealService.getById(crudDeal.id, { companyId: primary.company.id });
    const crudUpdated = await dealService.update(crudDeal.id, { status: 'won' }, { companyId: primary.company.id });
    const crudDeleted = await dealService.remove(crudDeal.id, { companyId: primary.company.id });
    check('existing deal CRUD smoke still passes', crudDetail?.id === crudDeal.id && crudUpdated?.status === 'won' && crudDeleted === 1);

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
    console.error('smokeDealsPipelines crashed', err);
    process.exitCode = 1;
  } finally {
    try {
      if (created.companyIds.length) {
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
      console.error('smokeDealsPipelines cleanup failed', cleanupErr);
      process.exitCode = 1;
    }
    await sequelize.close().catch(() => {});
    process.exit(process.exitCode || 0);
  }
})();
