const { Op } = require('sequelize');
const {
  Deal,
  Counterparty,
  User,
  Task,
  UserCompany,
  Contact,
  CrmPipeline,
  CrmPipelineStage,
  CrmDealLostReason,
  CrmDealSetting,
} = require('../../models');
const dealActivityService = require('./dealActivityService');

// requireCompanyId: выполняет вспомогательную бизнес-логику сервиса.
function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  return companyId;
}

// assertCounterpartyInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertCounterpartyInCompany(counterpartyId, companyId) {
  if (!counterpartyId) return;
  const row = await Counterparty.findOne({ where: { id: counterpartyId, companyId } });
  if (!row) {
    const err = new Error('counterpartyId is invalid');
    err.status = 400;
    throw err;
  }
}

// assertMemberInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertMemberInCompany(userId, companyId) {
  if (!userId) return;
  const row = await UserCompany.findOne({
    where: { userId, companyId, status: 'active' },
    attributes: ['id'],
  });
  if (!row) {
    const err = new Error('responsibleId is invalid');
    err.status = 400;
    throw err;
  }
}

async function assertContactInCompany(contactId, companyId, counterpartyId = null) {
  if (!contactId) return null;
  const where = { id: contactId, companyId };
  if (counterpartyId) where.counterpartyId = counterpartyId;
  const row = await Contact.findOne({
    where,
    attributes: ['id', 'counterpartyId'],
  });
  if (!row) {
    const err = new Error('contactId is invalid');
    err.status = 400;
    throw err;
  }
  return row;
}

async function assertLostReasonInCompany(lostReasonId, companyId) {
  if (!lostReasonId) return null;
  const row = await CrmDealLostReason.findOne({
    where: { id: lostReasonId, companyId, archived: false },
    attributes: ['id'],
  });
  if (!row) {
    const err = new Error('lostReasonId is invalid');
    err.status = 400;
    throw err;
  }
  return row;
}

async function assertNextActionTaskInCompany(taskId, companyId) {
  if (!taskId) return null;
  const row = await Task.findOne({
    where: { id: taskId, companyId },
    attributes: ['id', 'dealId'],
  });
  if (!row) {
    const err = new Error('nextActionTaskId is invalid');
    err.status = 400;
    throw err;
  }
  return row;
}

// assertPipelineInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertPipelineInCompany(pipelineId, companyId) {
  if (!pipelineId) return;
  const row = await CrmPipeline.findOne({
    where: { id: pipelineId, companyId },
    attributes: ['id'],
  });
  if (!row) {
    const err = new Error('pipelineId is invalid');
    err.status = 400;
    throw err;
  }
}

// assertStageInCompany: выполняет вспомогательную бизнес-логику сервиса.
async function assertStageInCompany(stageId, companyId, pipelineId = null) {
  if (!stageId) return;
  const where = { id: stageId, companyId };
  if (pipelineId) where.pipelineId = pipelineId;
  const row = await CrmPipelineStage.findOne({
    where,
    attributes: ['id', 'pipelineId'],
  });
  if (!row) {
    const err = new Error('stageId is invalid');
    err.status = 400;
    throw err;
  }
  return row;
}

async function getStageInCompany(stageId, companyId, pipelineId = null) {
  if (!stageId) return null;
  const where = { id: stageId, companyId };
  if (pipelineId) where.pipelineId = pipelineId;
  const row = await CrmPipelineStage.findOne({ where });
  if (!row) {
    const err = new Error('stageId is invalid');
    err.status = 400;
    throw err;
  }
  return row;
}

function deriveStatusFromStage(stage, previousStatus = 'new') {
  if (stage?.isWon) return 'won';
  if (stage?.isLost) return 'lost';
  if (previousStatus === 'new' && stage?.isDefaultEntry) return 'new';
  return 'in_progress';
}

function getEffectiveProbability(deal = {}, stage = {}) {
  const raw = deal.probability ?? stage?.probability ?? 0;
  const num = Number(raw);
  if (!Number.isFinite(num)) return 0;
  return Math.max(0, Math.min(100, num));
}

function addCurrencyValue(bucket = {}, currency, value) {
  const cur = currency || 'PLN';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return bucket;
  bucket[cur] = Number(bucket[cur] || 0) + num;
  return bucket;
}

function addBoardTotals(target, deal, stage) {
  const value = Number(deal.value);
  if (!Number.isFinite(value) || value <= 0) return;
  const currency = deal.currency || 'PLN';
  const probability = getEffectiveProbability(deal, stage);
  addCurrencyValue(target.sum, currency, value);
  addCurrencyValue(target.weighted, currency, value * (probability / 100));
}

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday() {
  const date = startOfToday();
  date.setDate(date.getDate() + 1);
  return date;
}

function applyNextActionFilter(where, nextAction) {
  const mode = nextAction || '';
  if (!mode || mode === 'all') return where;
  const now = new Date();
  const start = startOfToday();
  const end = endOfToday();

  if (mode === 'missing') {
    where.nextActionAt = { [Op.is]: null };
  } else if (mode === 'overdue') {
    where.nextActionAt = { [Op.lt]: now };
    where.status = { [Op.notIn]: ['won', 'lost'] };
  } else if (mode === 'today') {
    where.nextActionAt = { [Op.gte]: start, [Op.lt]: end };
  } else if (mode === 'upcoming') {
    where.nextActionAt = { [Op.gte]: end };
  }
  return where;
}

function getContactName(contact = {}) {
  if (!contact) return null;
  return [contact.firstName, contact.middleName, contact.lastName].filter(Boolean).join(' ')
    || contact.displayName
    || null;
}

function getOwnerName(user = {}) {
  if (!user) return null;
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || null;
}

function getDaysInStage(deal = {}) {
  if (!deal.stageEnteredAt) return null;
  const entered = new Date(deal.stageEnteredAt).getTime();
  if (!Number.isFinite(entered)) return null;
  return Math.max(0, Math.floor((Date.now() - entered) / 86400000));
}

function mapBoardDeal(deal, stage) {
  const plain = typeof deal.toJSON === 'function' ? deal.toJSON() : deal;
  const daysInStage = getDaysInStage(plain);
  return {
    id: plain.id,
    title: plain.title,
    counterpartyId: plain.counterpartyId,
    counterpartyName: plain.counterparty?.fullName || plain.counterparty?.shortName || null,
    contactId: plain.contactId,
    contactName: getContactName(plain.contact),
    value: plain.value,
    currency: plain.currency || 'PLN',
    probability: getEffectiveProbability(plain, stage),
    healthStatus: plain.healthStatus || null,
    healthComputedAt: plain.healthComputedAt || null,
    nextActionAt: plain.nextActionAt || null,
    nextActionType: plain.nextActionType || null,
    nextActionTask: plain.nextActionTask || null,
    responsibleId: plain.responsibleId,
    ownerName: getOwnerName(plain.responsible),
    priority: plain.priority,
    pipelineId: plain.pipelineId,
    stageId: plain.stageId,
    stageEnteredAt: plain.stageEnteredAt,
    daysInStage,
    staleByRotDays: Number.isFinite(Number(stage?.rotDays)) && daysInStage !== null
      ? daysInStage > Number(stage.rotDays)
      : false,
    status: plain.status,
    updatedAt: plain.updatedAt,
    createdAt: plain.createdAt,
  };
}

function sortStages(stages = []) {
  return stages.slice().sort((left, right) => {
    const leftOrder = Number(left.order ?? left.position ?? 0);
    const rightOrder = Number(right.order ?? right.position ?? 0);
    return leftOrder - rightOrder;
  });
}

function getStageName(stage) {
  if (!stage) return null;
  return stage.name || stage.title || null;
}

function buildEmptyBoard({ pipeline = null, stages = [], reason = null } = {}) {
  return {
    pipeline,
    stages,
    totals: { count: 0, sum: {}, weighted: {} },
    reason,
  };
}

async function getDefaultPipeline(companyId) {
  const defaultPipeline = await CrmPipeline.findOne({
    where: { companyId, archived: false, isDefault: true },
    order: [['createdAt', 'ASC']],
  });
  if (defaultPipeline) return defaultPipeline;
  return CrmPipeline.findOne({
    where: { companyId, archived: false },
    order: [['order', 'ASC'], ['createdAt', 'ASC']],
  });
}

async function getTerminalStage(companyId, kind, pipelineId = null) {
  const pipeline = pipelineId
    ? await CrmPipeline.findOne({ where: { id: pipelineId, companyId, archived: false } })
    : await getDefaultPipeline(companyId);
  if (!pipeline) {
    const err = new Error('pipeline is required');
    err.status = 400;
    throw err;
  }

  const where = {
    companyId,
    pipelineId: pipeline.id,
    archived: false,
    hidden: false,
    [kind === 'won' ? 'isWon' : 'isLost']: true,
  };
  const stage = await CrmPipelineStage.findOne({
    where,
    order: [['order', 'ASC'], ['position', 'ASC'], ['createdAt', 'ASC']],
  });
  if (!stage) {
    const err = new Error(`${kind} stage is not configured`);
    err.status = 400;
    throw err;
  }
  return stage;
}

async function applyExpectedCloseDefault(payload, companyId) {
  if (Object.prototype.hasOwnProperty.call(payload, 'expectedCloseDate')) return;
  const settings = await CrmDealSetting.findOne({ where: { companyId } });
  const days = settings ? settings.defaultExpectedCloseDays : 30;
  if (days === null || days === undefined || days === '') return;
  const number = Number(days);
  if (!Number.isInteger(number) || number < 0) return;
  const date = new Date();
  date.setDate(date.getDate() + number);
  payload.expectedCloseDate = date.toISOString().slice(0, 10);
}

async function validateFoundationFields(payload, companyId, item = null) {
  const counterpartyId = payload.counterpartyId || item?.counterpartyId || null;
  if (payload.contactId) await assertContactInCompany(payload.contactId, companyId, counterpartyId);
  if (payload.lostReasonId) await assertLostReasonInCompany(payload.lostReasonId, companyId);
  if (payload.nextActionTaskId) await assertNextActionTaskInCompany(payload.nextActionTaskId, companyId);
}

function applyStageLifecycle(next, stage, previousStatus = 'new') {
  const status = deriveStatusFromStage(stage, previousStatus);
  next.pipelineId = next.pipelineId || stage.pipelineId;
  next.stageId = stage.id;
  next.stageEnteredAt = next.stageEnteredAt || new Date();
  next.status = status;

  if (status === 'won') {
    next.closedAt = next.closedAt || new Date();
    next.lostReasonId = null;
    next.lostNote = null;
  } else if (status === 'lost') {
    next.closedAt = next.closedAt || new Date();
  } else {
    next.closedAt = null;
    next.lostReasonId = null;
    next.lostNote = null;
  }
}

function stripLifecyclePayload(payload) {
  const next = { ...payload };
  delete next.companyId;
  delete next.status;
  delete next.stageId;
  delete next.stageEnteredAt;
  delete next.closedAt;
  delete next.lostReasonId;
  delete next.lostNote;
  return next;
}

// buildDefaultInclude: собирает служебную структуру для выполнения запроса.
const buildDefaultInclude = (companyId) => ([
  {
    model: Counterparty,
    as: 'counterparty',
    attributes: ['id', 'fullName'],
    where: { companyId },
    required: false,
  },
  {
    model: User,
    as: 'responsible',
    attributes: ['id', 'email', 'firstName', 'lastName'],
    required: false,
  },
  {
    model: Contact,
    as: 'contact',
    attributes: ['id', 'firstName', 'lastName', 'displayName', 'email', 'phone', 'counterpartyId'],
    required: false,
  },
  {
    model: CrmDealLostReason,
    as: 'lostReason',
    attributes: ['id', 'name', 'archived'],
    required: false,
  },
  {
    model: Task,
    as: 'nextActionTask',
    attributes: ['id', 'title', 'status', 'priority', 'startAt', 'endAt'],
    required: false,
  },
]);

// ---- helpers (внутренние) ----
const parsePaging = (query = {}) => {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

// buildOrder: собирает служебную структуру для выполнения запроса.
const buildOrder = (query = {}) => {
    // sort=createdAt:desc,status:asc
    const sort = (query.sort || '').split(',').filter(Boolean);
    if (!sort.length) return [['createdAt', 'DESC']];
    return sort.map(s => {
        const [field, dir] = s.split(':');
        return [field, (dir || 'asc').toUpperCase()];
    });
};

// buildWhere: собирает служебную структуру для выполнения запроса.
const buildWhere = (query = {}, companyId) => {
    const where = { companyId };
    if (query.status) {
        where.status = query.status;
    }
    if (query.counterpartyId) {
        where.counterpartyId = query.counterpartyId;
    }
    if (query.responsibleId) {
        where.responsibleId = query.responsibleId;
    }
    if (query.pipelineId) {
        where.pipelineId = query.pipelineId;
    }
    if (query.stageId) {
        where.stageId = query.stageId;
    }
    if (query.contactId) {
        where.contactId = query.contactId;
    }
    if (query.lostReasonId) {
        where.lostReasonId = query.lostReasonId;
    }
    if (query.healthStatus) {
        where.healthStatus = query.healthStatus;
    }
    if (Object.prototype.hasOwnProperty.call(query, 'priority')) {
        where.priority = query.priority;
    }

    // free text
    if (query.q) {
        where[Op.or] = [
        { title: { [Op.iLike]: `%${query.q}%` } },
        { description: { [Op.iLike]: `%${query.q}%` } },
        ];
    }

    // date range (createdAt)
    if (query.dateFrom || query.dateTo) {
        where.createdAt = {};
        if (query.dateFrom) {
            where.createdAt[Op.gte] = new Date(query.dateFrom);
        }
        if (query.dateTo){
            where.createdAt[Op.lte] = new Date(query.dateTo);
        }
    }

    return where;
};

function buildBoardWhere(query = {}, companyId, pipelineId, stageIds = []) {
  const where = buildWhere({
    q: query.q,
    responsibleId: query.responsibleId || query.ownerId,
    pipelineId,
    stageId: query.stageId,
    healthStatus: query.healthStatus,
  }, companyId);
  where.pipelineId = pipelineId;
  if (stageIds.length && !query.stageId) {
    where.stageId = { [Op.in]: stageIds };
  }
  applyNextActionFilter(where, query.nextAction);
  return where;
}

// ---- exports ----
module.exports.list = async ({ query = {}, user, companyId } = {}) => {
  const cid = requireCompanyId(companyId || user?.companyId);
  const { page, limit, offset } = parsePaging(query);

  if (query.counterpartyId) await assertCounterpartyInCompany(query.counterpartyId, cid);
  if (query.responsibleId) await assertMemberInCompany(query.responsibleId, cid);
  if (query.pipelineId) await assertPipelineInCompany(query.pipelineId, cid);
  if (query.stageId) await assertStageInCompany(query.stageId, cid, query.pipelineId || null);
  if (query.contactId) await assertContactInCompany(query.contactId, cid);
  if (query.lostReasonId) await assertLostReasonInCompany(query.lostReasonId, cid);

  const where = buildWhere(query, cid);
  const order = buildOrder(query);

  const { rows, count } = await Deal.findAndCountAll({
    where,
    include: buildDefaultInclude(cid),
    order,
    limit,
    offset,
  });

  return { rows, count, page, limit };
};

module.exports.board = async ({ query = {}, user, companyId } = {}) => {
  const cid = requireCompanyId(companyId || user?.companyId);
  const perStageLimit = Math.min(Math.max(Number(query.perStageLimit || 50), 1), 100);
  const selectedPipeline = query.pipelineId
    ? await CrmPipeline.findOne({
      where: { id: query.pipelineId, companyId: cid, archived: false },
    })
    : await getDefaultPipeline(cid);

  if (!selectedPipeline) {
    return buildEmptyBoard({ reason: 'pipeline_required' });
  }

  const stages = sortStages(await CrmPipelineStage.findAll({
    where: {
      companyId: cid,
      pipelineId: selectedPipeline.id,
      archived: false,
      hidden: false,
    },
    order: [['order', 'ASC'], ['position', 'ASC'], ['createdAt', 'ASC']],
  }));
  const stageIds = stages.map((stage) => stage.id);
  const stageById = new Map(stages.map((stage) => [String(stage.id), stage]));
  if (!stages.length) {
    return buildEmptyBoard({
      pipeline: selectedPipeline.toJSON(),
      reason: 'stages_required',
    });
  }

  if (query.stageId && !stageById.has(String(query.stageId))) {
    const err = new Error('stageId is invalid');
    err.status = 400;
    throw err;
  }

  const where = buildBoardWhere(query, cid, selectedPipeline.id, stageIds);
  const rows = await Deal.findAll({
    where,
    include: buildDefaultInclude(cid),
    order: [['stageEnteredAt', 'ASC'], ['updatedAt', 'DESC'], ['createdAt', 'DESC']],
  });

  const buckets = new Map(stages.map((stage) => [
    String(stage.id),
    {
      stage: stage.toJSON(),
      count: 0,
      sum: {},
      weighted: {},
      deals: [],
      nextCursor: null,
    },
  ]));
  const totals = { count: 0, sum: {}, weighted: {} };

  for (const deal of rows) {
    const plain = typeof deal.toJSON === 'function' ? deal.toJSON() : deal;
    const stage = stageById.get(String(plain.stageId || ''));
    if (!stage) continue;
    const bucket = buckets.get(String(stage.id));
    bucket.count += 1;
    totals.count += 1;
    addBoardTotals(bucket, plain, stage);
    addBoardTotals(totals, plain, stage);
    if (bucket.deals.length < perStageLimit) {
      bucket.deals.push(mapBoardDeal(plain, stage));
    } else {
      bucket.nextCursor = String(bucket.count);
    }
  }

  return {
    pipeline: selectedPipeline.toJSON(),
    stages: [...buckets.values()].map((bucket) => ({
      ...bucket.stage,
      count: bucket.count,
      sum: bucket.sum,
      weighted: bucket.weighted,
      deals: bucket.deals,
      nextCursor: bucket.nextCursor,
    })),
    totals,
  };
};

// getById: возвращает данные по входным параметрам сервиса.
module.exports.getById = async (id, opts = {}) => {
    if (!id) return null;
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId);
    return Deal.findOne({
        where: { id, companyId: cid },
        include: [
          ...buildDefaultInclude(cid),
          {
            model: Task,
            as: 'tasks',
            attributes: ['id', 'title', 'status', 'priority', 'startAt', 'endAt'],
            where: { companyId: cid },
            required: false,
          },
        ],
    });
};

// create: создаёт новую запись и возвращает результат.
module.exports.create = async (payload = {}, opts = {}) => {
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId || payload.companyId);
    const counterpartyId = payload.counterpartyId || null;

    if (!counterpartyId) throw new Error('counterpartyId is required');
    if (!payload.title) throw new Error('title is required');

    await assertCounterpartyInCompany(counterpartyId, cid);
    if (payload.responsibleId) await assertMemberInCompany(payload.responsibleId, cid);
    if (payload.pipelineId) await assertPipelineInCompany(payload.pipelineId, cid);
    await validateFoundationFields(payload, cid);
    await applyExpectedCloseDefault(payload, cid);

    const toCreate = { ...payload, companyId: cid };
    if (payload.stageId) {
      const stage = await getStageInCompany(payload.stageId, cid, payload.pipelineId || null);
      applyStageLifecycle(toCreate, stage, payload.status || 'new');
    }

    const created = await Deal.create(toCreate);
    await dealActivityService.createSystemActivity(cid, created.id, {
      type: 'deal_created',
      title: 'deal_created',
      occurredAt: created.createdAt || new Date(),
      authorId: opts.user?.id || null,
      metadata: {
        event: 'deal_created',
        dealId: created.id,
        stageId: created.stageId || null,
        pipelineId: created.pipelineId || null,
      },
    });
    return created;
};

// update: обновляет запись и возвращает актуальные данные.
module.exports.update = async (id, payload = {}, opts = {}) => {
    if (!id) throw new Error('id is required');
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId || payload.companyId);

    if (payload.counterpartyId) await assertCounterpartyInCompany(payload.counterpartyId, cid);
    if (payload.responsibleId) await assertMemberInCompany(payload.responsibleId, cid);
    const item = await Deal.findOne({ where: { id, companyId: cid } });
    if (!item) return null;

    const targetPipelineId = payload.pipelineId || item.pipelineId || null;
    if (payload.pipelineId) await assertPipelineInCompany(payload.pipelineId, cid);
    await validateFoundationFields(payload, cid, item);

    if (!payload.stageId && (payload.status === 'won' || payload.status === 'lost') && item.stageId) {
      const nonLifecycle = stripLifecyclePayload(payload);
      if (Object.keys(nonLifecycle).length) await item.update(nonLifecycle);
      if (payload.status === 'won') {
        return module.exports.markWon(id, payload, { companyId: cid, user: opts.user });
      }
      return module.exports.markLost(id, payload, { companyId: cid, user: opts.user });
    }

    if (payload.stageId) {
      const nonLifecycle = stripLifecyclePayload(payload);
      if (payload.pipelineId) nonLifecycle.pipelineId = payload.pipelineId;
      if (Object.keys(nonLifecycle).length) await item.update(nonLifecycle);
      return module.exports.moveStage(id, payload, { companyId: cid, user: opts.user });
    }

    const next = { ...payload };
    delete next.companyId;
    if (item.stageId) {
      delete next.status;
    } else if (next.status === 'won' || next.status === 'lost') {
      next.closedAt = next.closedAt || new Date();
    } else if (next.status === 'new' || next.status === 'in_progress') {
      next.closedAt = null;
      next.lostReasonId = null;
      next.lostNote = null;
    }

    await item.update(next);
    return module.exports.getById(id, { companyId: cid });
};

// remove: удаляет запись с учётом бизнес-ограничений.
module.exports.remove = async (id, opts = {}) => {
    if (!id) throw new Error('id is required');
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId);
    return Deal.destroy({ where: { id, companyId: cid } });
};

module.exports.moveStage = async (id, payload = {}, opts = {}) => {
  if (!id) throw new Error('id is required');
  const cid = requireCompanyId(opts.companyId || opts.user?.companyId);
  const stageId = payload.stageId || null;
  if (!stageId) throw new Error('stageId is required');

  const item = await Deal.findOne({ where: { id, companyId: cid } });
  if (!item) return null;
  const previousStageId = item.stageId || null;
  const previousStatus = item.status || null;
  const previousStage = previousStageId
    ? await CrmPipelineStage.findOne({
      where: { id: previousStageId, companyId: cid },
      attributes: ['id', 'name'],
    })
    : null;

  const stage = await getStageInCompany(stageId, cid, item.pipelineId || null);
  if (item.pipelineId && String(stage.pipelineId) !== String(item.pipelineId)) {
    const err = new Error('stage does not belong to deal pipeline');
    err.status = 400;
    throw err;
  }

  await validateFoundationFields(payload, cid, item);

  const next = {
    pipelineId: item.pipelineId || stage.pipelineId,
    stageEnteredAt: new Date(),
  };
  if (Object.prototype.hasOwnProperty.call(payload, 'closedAt')) next.closedAt = payload.closedAt;
  if (Object.prototype.hasOwnProperty.call(payload, 'lostReasonId')) next.lostReasonId = payload.lostReasonId;
  if (Object.prototype.hasOwnProperty.call(payload, 'lostNote')) next.lostNote = payload.lostNote;
  applyStageLifecycle(next, stage, item.status);

  await item.update(next);

  if (String(previousStageId || '') !== String(stage.id || '')) {
    await dealActivityService.createSystemActivity(cid, id, {
      type: 'stage_change',
      title: 'stage_changed',
      occurredAt: new Date(),
      authorId: opts.user?.id || null,
      metadata: {
        fromStageId: previousStageId,
        toStageId: stage.id,
        fromStageName: getStageName(previousStage),
        toStageName: getStageName(stage),
        fromStatus: previousStatus,
        toStatus: next.status,
      },
    });
  }

  if ((next.status === 'won' || next.status === 'lost') && previousStatus !== next.status) {
    await dealActivityService.createSystemActivity(cid, id, {
      type: 'status_change',
      title: next.status === 'won' ? 'deal_won' : 'deal_lost',
      occurredAt: new Date(),
      authorId: opts.user?.id || null,
      metadata: {
        status: next.status,
        stageId: stage.id,
        lostReasonId: next.status === 'lost' ? (payload.lostReasonId || null) : null,
        lostNote: next.status === 'lost' ? (payload.lostNote || null) : null,
        previousStatus,
      },
    });
  }

  return module.exports.getById(id, { companyId: cid });
};

module.exports.markWon = async (id, payload = {}, opts = {}) => {
  if (!id) throw new Error('id is required');
  const cid = requireCompanyId(opts.companyId || opts.user?.companyId);
  const item = await Deal.findOne({ where: { id, companyId: cid } });
  if (!item) return null;

  const stage = await getTerminalStage(cid, 'won', item.pipelineId || payload.pipelineId || null);
  return module.exports.moveStage(id, { ...payload, stageId: stage.id }, { companyId: cid, user: opts.user });
};

module.exports.markLost = async (id, payload = {}, opts = {}) => {
  if (!id) throw new Error('id is required');
  const cid = requireCompanyId(opts.companyId || opts.user?.companyId);
  const item = await Deal.findOne({ where: { id, companyId: cid } });
  if (!item) return null;

  const stage = await getTerminalStage(cid, 'lost', item.pipelineId || payload.pipelineId || null);
  return module.exports.moveStage(id, { ...payload, stageId: stage.id }, { companyId: cid, user: opts.user });
};
