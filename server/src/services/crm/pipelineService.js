const { Op } = require('sequelize');
const { CrmPipeline, CrmPipelineStage, Deal, sequelize } = require('../../models');
const { v4: uuid } = require('uuid');

function badRequest(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function requireCompanyId(companyId) {
  if (!companyId) throw badRequest('companyId is required');
  return companyId;
}

function cleanPipelinePayload(dto = {}) {
  const out = {};
  for (const key of ['name', 'color', 'description', 'isDefault', 'archived', 'order']) {
    if (Object.prototype.hasOwnProperty.call(dto, key)) out[key] = dto[key];
  }
  if (out.name != null) out.name = String(out.name).trim();
  if (out.name === '') throw badRequest('name is required');
  return out;
}

function cleanStagePayload(dto = {}) {
  const out = {};
  for (const key of [
    'name',
    'probability',
    'color',
    'position',
    'order',
    'isWon',
    'isLost',
    'isDefaultEntry',
    'hidden',
    'archived',
    'wipLimit',
  ]) {
    if (Object.prototype.hasOwnProperty.call(dto, key)) out[key] = dto[key];
  }
  if (out.name != null) out.name = String(out.name).trim();
  if (out.name === '') throw badRequest('name is required');

  if (out.probability != null) {
    out.probability = Math.max(0, Math.min(100, Number(out.probability)));
  }
  if (out.wipLimit != null && out.wipLimit !== '') {
    out.wipLimit = Math.max(0, Number(out.wipLimit));
  } else if (out.wipLimit === '') {
    out.wipLimit = null;
  }
  if (out.order != null) out.order = Number(out.order);
  if (out.position != null) out.position = Number(out.position);

  if (out.isWon === true) out.isLost = false;
  if (out.isLost === true) out.isWon = false;
  if (out.isWon === true || out.isLost === true) out.isDefaultEntry = false;
  return out;
}

async function getPipelineOrThrow(companyId, pipelineId, options = {}) {
  const pipeline = await CrmPipeline.findOne({
    where: { id: pipelineId, companyId },
    transaction: options.transaction,
  });
  if (!pipeline) throw badRequest('pipelineId is invalid', 404);
  return pipeline;
}

async function getStageOrThrow(companyId, pipelineId, stageId, options = {}) {
  const stage = await CrmPipelineStage.findOne({
    where: { id: stageId, companyId, pipelineId },
    transaction: options.transaction,
  });
  if (!stage) throw badRequest('stageId is invalid', 404);
  return stage;
}

async function nextPipelineOrder(companyId, options = {}) {
  const max = await CrmPipeline.max('order', {
    where: { companyId },
    transaction: options.transaction,
  });
  return Number.isFinite(Number(max)) ? Number(max) + 1 : 0;
}

async function nextStageOrder(companyId, pipelineId, options = {}) {
  const max = await CrmPipelineStage.max('order', {
    where: { companyId, pipelineId },
    transaction: options.transaction,
  });
  return Number.isFinite(Number(max)) ? Number(max) + 1 : 0;
}

async function activePipelineCount(companyId, options = {}) {
  return CrmPipeline.count({
    where: { companyId, archived: false },
    transaction: options.transaction,
  });
}

async function ensureDefaultPipeline(companyId, options = {}) {
  const currentDefault = await CrmPipeline.findOne({
    where: { companyId, isDefault: true, archived: false },
    transaction: options.transaction,
  });
  if (currentDefault) return currentDefault;

  const firstActive = await CrmPipeline.findOne({
    where: { companyId, archived: false },
    order: [['order', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    transaction: options.transaction,
  });
  if (firstActive) await firstActive.update({ isDefault: true }, { transaction: options.transaction });
  return firstActive;
}

async function reorderStagesContiguous(companyId, pipelineId, options = {}) {
  const stages = await CrmPipelineStage.findAll({
    where: { companyId, pipelineId },
    order: [['order', 'ASC'], ['position', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    transaction: options.transaction,
  });

  for (let index = 0; index < stages.length; index += 1) {
    const stage = stages[index];
    if (stage.order !== index || stage.position !== index) {
      await stage.update({ order: index, position: index }, { transaction: options.transaction });
    }
  }
}

async function ensureDefaultEntry(companyId, pipelineId, options = {}) {
  const current = await CrmPipelineStage.findOne({
    where: {
      companyId,
      pipelineId,
      archived: false,
      isDefaultEntry: true,
      isWon: false,
      isLost: false,
    },
    transaction: options.transaction,
  });
  if (current) return current;

  const firstOpen = await CrmPipelineStage.findOne({
    where: {
      companyId,
      pipelineId,
      archived: false,
      isWon: false,
      isLost: false,
    },
    order: [['order', 'ASC'], ['createdAt', 'ASC'], ['id', 'ASC']],
    transaction: options.transaction,
  });
  if (firstOpen) await firstOpen.update({ isDefaultEntry: true }, { transaction: options.transaction });
  return firstOpen;
}

async function unsetDefaultEntry(companyId, pipelineId, exceptStageId = null, options = {}) {
  const where = { companyId, pipelineId, isDefaultEntry: true };
  if (exceptStageId) where.id = { [Op.ne]: exceptStageId };
  await CrmPipelineStage.update(
    { isDefaultEntry: false },
    { where, transaction: options.transaction }
  );
}

async function unsetTerminalStage(companyId, pipelineId, terminalKey, exceptStageId = null, options = {}) {
  const where = { companyId, pipelineId, [terminalKey]: true };
  if (exceptStageId) where.id = { [Op.ne]: exceptStageId };
  await CrmPipelineStage.update(
    { [terminalKey]: false },
    { where, transaction: options.transaction }
  );
}

async function assertCanArchivePipeline(companyId, pipelineId, options = {}) {
  const count = await activePipelineCount(companyId, options);
  const pipeline = await getPipelineOrThrow(companyId, pipelineId, options);
  if (!pipeline.archived && count <= 1) {
    throw badRequest('cannot archive last active pipeline');
  }
  return pipeline;
}

async function getDealCountForPipeline(companyId, pipelineId, options = {}) {
  return Deal.count({ where: { companyId, pipelineId }, transaction: options.transaction });
}

async function getDealCountForStage(companyId, stageId, options = {}) {
  return Deal.count({ where: { companyId, stageId }, transaction: options.transaction });
}

async function serializePipeline(pipeline, options = {}) {
  if (!pipeline) return pipeline;
  const plain = typeof pipeline.toJSON === 'function' ? pipeline.toJSON() : { ...pipeline };
  plain.dealsCount = await getDealCountForPipeline(plain.companyId, plain.id, options);
  if (Array.isArray(plain.stages)) {
    plain.stages = await Promise.all(plain.stages.map(async (stage) => ({
      ...stage,
      dealsCount: await getDealCountForStage(stage.companyId || plain.companyId, stage.id, options),
    })));
  }
  return plain;
}

module.exports.list = async (companyId) => {
  const cid = requireCompanyId(companyId);
  const pipelines = await CrmPipeline.findAll({
    where: { companyId: cid },
    include: [{
      model: CrmPipelineStage,
      as: 'stages',
      required: false,
    }],
    order: [
      ['order', 'ASC'],
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
      [{ model: CrmPipelineStage, as: 'stages' }, 'order', 'ASC'],
      [{ model: CrmPipelineStage, as: 'stages' }, 'position', 'ASC'],
      [{ model: CrmPipelineStage, as: 'stages' }, 'createdAt', 'ASC'],
      [{ model: CrmPipelineStage, as: 'stages' }, 'id', 'ASC'],
    ],
  });
  return Promise.all(pipelines.map((pipeline) => serializePipeline(pipeline)));
};

module.exports.createPipeline = async (companyId, dto = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const payload = cleanPipelinePayload(dto);
    if (!payload.name) throw badRequest('name is required');
    if (payload.order == null) payload.order = await nextPipelineOrder(cid, { transaction });
    payload.archived = payload.archived === true;
    const activeCountBeforeCreate = await activePipelineCount(cid, { transaction });
    if (payload.archived && activeCountBeforeCreate === 0) {
      throw badRequest('cannot create first pipeline as archived');
    }

    if (payload.isDefault === true) {
      await CrmPipeline.update(
        { isDefault: false },
        { where: { companyId: cid }, transaction }
      );
    } else {
      if (activeCountBeforeCreate === 0 && payload.archived !== true) payload.isDefault = true;
    }

    const pipeline = await CrmPipeline.create({ id: uuid(), companyId: cid, ...payload }, { transaction });
    await ensureDefaultPipeline(cid, { transaction });
    return serializePipeline(pipeline);
  });
};

module.exports.updatePipeline = async (companyId, pipelineId, dto = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const pipeline = await getPipelineOrThrow(cid, pipelineId, { transaction });
    const payload = cleanPipelinePayload(dto);

    if (payload.archived === true && !pipeline.archived) {
      await assertCanArchivePipeline(cid, pipelineId, { transaction });
    }

    if (payload.isDefault === true) {
      if (payload.archived === true) throw badRequest('archived pipeline cannot be default');
      await CrmPipeline.update(
        { isDefault: false },
        { where: { companyId: cid, id: { [Op.ne]: pipelineId } }, transaction }
      );
    }

    if (payload.archived === true) payload.isDefault = false;
    await pipeline.update(payload, { transaction });
    await ensureDefaultPipeline(cid, { transaction });
    return serializePipeline(await pipeline.reload({ transaction }), { transaction });
  });
};

module.exports.reorderPipelines = async (companyId, orderedPipelineIds = []) => {
  const cid = requireCompanyId(companyId);
  if (!Array.isArray(orderedPipelineIds) || !orderedPipelineIds.length) {
    throw badRequest('ordered pipeline ids are required');
  }

  return sequelize.transaction(async (transaction) => {
    const pipelines = await CrmPipeline.findAll({
      where: { companyId: cid },
      transaction,
    });
    const known = new Set(pipelines.map((pipeline) => String(pipeline.id)));
    const incoming = orderedPipelineIds.map(String);

    if (known.size !== incoming.length || incoming.some((id) => !known.has(id))) {
      throw badRequest('pipeline order must include every pipeline in this company');
    }

    for (let index = 0; index < incoming.length; index += 1) {
      await CrmPipeline.update(
        { order: index },
        { where: { id: incoming[index], companyId: cid }, transaction }
      );
    }

    const ordered = await CrmPipeline.findAll({
      where: { companyId: cid },
      include: [{
        model: CrmPipelineStage,
        as: 'stages',
        required: false,
      }],
      order: [
        ['order', 'ASC'],
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
        [{ model: CrmPipelineStage, as: 'stages' }, 'order', 'ASC'],
        [{ model: CrmPipelineStage, as: 'stages' }, 'position', 'ASC'],
        [{ model: CrmPipelineStage, as: 'stages' }, 'id', 'ASC'],
      ],
      transaction,
    });

    return Promise.all(ordered.map((pipeline) => serializePipeline(pipeline, { transaction })));
  });
};

module.exports.deletePipeline = async (companyId, pipelineId) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    const pipeline = await assertCanArchivePipeline(cid, pipelineId, { transaction });
    const dealCount = await getDealCountForPipeline(cid, pipelineId, { transaction });

    if (dealCount > 0) {
      await pipeline.update({ archived: true, isDefault: false }, { transaction });
      await ensureDefaultPipeline(cid, { transaction });
      return { archived: true, deleted: false };
    }

    await pipeline.destroy({ transaction });
    await ensureDefaultPipeline(cid, { transaction });
    return { archived: false, deleted: true };
  });
};

module.exports.addStage = async (companyId, pipelineId, dto = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    await getPipelineOrThrow(cid, pipelineId, { transaction });
    const payload = cleanStagePayload(dto);
    if (!payload.name) throw badRequest('name is required');
    if (payload.order == null) payload.order = await nextStageOrder(cid, pipelineId, { transaction });
    payload.position = payload.order;
    payload.hidden = payload.hidden === true;
    payload.archived = payload.archived === true;
    payload.isWon = payload.isWon === true;
    payload.isLost = payload.isLost === true;
    payload.isDefaultEntry = payload.isDefaultEntry === true && !payload.isWon && !payload.isLost;

    if (payload.isDefaultEntry) {
      await unsetDefaultEntry(cid, pipelineId, null, { transaction });
    }
    if (payload.isWon) await unsetTerminalStage(cid, pipelineId, 'isWon', null, { transaction });
    if (payload.isLost) await unsetTerminalStage(cid, pipelineId, 'isLost', null, { transaction });

    const stage = await CrmPipelineStage.create({
      id: uuid(),
      companyId: cid,
      pipelineId,
      probability: 0,
      ...payload,
    }, { transaction });

    await ensureDefaultEntry(cid, pipelineId, { transaction });
    await reorderStagesContiguous(cid, pipelineId, { transaction });
    return stage.reload({ transaction });
  });
};

module.exports.updateStage = async (companyId, pipelineId, stageId, dto = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    await getPipelineOrThrow(cid, pipelineId, { transaction });
    const stage = await getStageOrThrow(cid, pipelineId, stageId, { transaction });
    const payload = cleanStagePayload(dto);

    if (payload.isDefaultEntry === true) {
      if (payload.isWon === true || payload.isLost === true || stage.isWon || stage.isLost) {
        throw badRequest('terminal stage cannot be default entry');
      }
      await unsetDefaultEntry(cid, pipelineId, stageId, { transaction });
    }

    if (payload.isWon === true) await unsetTerminalStage(cid, pipelineId, 'isWon', stageId, { transaction });
    if (payload.isLost === true) await unsetTerminalStage(cid, pipelineId, 'isLost', stageId, { transaction });

    if (payload.isWon === true || payload.isLost === true || payload.archived === true) {
      payload.isDefaultEntry = false;
    }

    await stage.update(payload, { transaction });
    await ensureDefaultEntry(cid, pipelineId, { transaction });
    await reorderStagesContiguous(cid, pipelineId, { transaction });
    return stage.reload({ transaction });
  });
};

module.exports.reorderStages = async (companyId, pipelineId, orderedStageIds = []) => {
  const cid = requireCompanyId(companyId);
  if (!Array.isArray(orderedStageIds) || !orderedStageIds.length) {
    throw badRequest('ordered stage ids are required');
  }

  return sequelize.transaction(async (transaction) => {
    await getPipelineOrThrow(cid, pipelineId, { transaction });
    const stages = await CrmPipelineStage.findAll({
      where: { companyId: cid, pipelineId },
      transaction,
    });
    const known = new Set(stages.map((stage) => String(stage.id)));
    const incoming = orderedStageIds.map(String);

    if (known.size !== incoming.length || incoming.some((id) => !known.has(id))) {
      throw badRequest('stage order must include every stage in this pipeline');
    }

    for (let index = 0; index < incoming.length; index += 1) {
      await CrmPipelineStage.update(
        { order: index, position: index },
        { where: { id: incoming[index], companyId: cid, pipelineId }, transaction }
      );
    }

    return CrmPipelineStage.findAll({
      where: { companyId: cid, pipelineId },
      order: [['order', 'ASC'], ['id', 'ASC']],
      transaction,
    });
  });
};

module.exports.deleteStage = async (companyId, pipelineId, stageId, options = {}) => {
  const cid = requireCompanyId(companyId);
  return sequelize.transaction(async (transaction) => {
    await getPipelineOrThrow(cid, pipelineId, { transaction });
    const stage = await getStageOrThrow(cid, pipelineId, stageId, { transaction });
    const replacementStageId = options.replacementStageId || null;
    const dealCount = await getDealCountForStage(cid, stageId, { transaction });

    if (dealCount > 0 && !replacementStageId) {
      throw badRequest('replacementStageId is required when stage has deals');
    }

    let replacementStage = null;
    if (replacementStageId) {
      if (replacementStageId === stageId) throw badRequest('replacementStageId must differ from stageId');
      replacementStage = await getStageOrThrow(cid, pipelineId, replacementStageId, { transaction });
    }

    if (!stage.isWon && !stage.isLost && !stage.archived) {
      const remainingOpen = await CrmPipelineStage.count({
        where: {
          companyId: cid,
          pipelineId,
          id: { [Op.ne]: stageId },
          archived: false,
          isWon: false,
          isLost: false,
        },
        transaction,
      });
      if (remainingOpen <= 0) {
        throw badRequest('cannot remove last active open stage');
      }
    }

    if (dealCount > 0 && replacementStage) {
      const nextStatus = replacementStage.isWon
        ? 'won'
        : replacementStage.isLost
          ? 'lost'
          : 'in_progress';
      await Deal.update(
        { stageId: replacementStage.id, pipelineId, status: nextStatus, stageEnteredAt: new Date() },
        { where: { companyId: cid, stageId }, transaction }
      );
    }

    await stage.destroy({ transaction });
    await ensureDefaultEntry(cid, pipelineId, { transaction });
    await reorderStagesContiguous(cid, pipelineId, { transaction });
    return { deleted: true, movedDeals: dealCount };
  });
};
