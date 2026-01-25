const { Op } = require('sequelize');
const {
  Deal,
  Counterparty,
  User,
  Task,
  UserCompany,
  CrmPipeline,
  CrmPipelineStage,
} = require('../../models');

function requireCompanyId(companyId) {
  if (!companyId) {
    const err = new Error('companyId is required');
    err.status = 400;
    throw err;
  }
  return companyId;
}

async function assertCounterpartyInCompany(counterpartyId, companyId) {
  if (!counterpartyId) return;
  const row = await Counterparty.findOne({ where: { id: counterpartyId, companyId } });
  if (!row) {
    const err = new Error('counterpartyId is invalid');
    err.status = 400;
    throw err;
  }
}

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
}

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
]);

// ---- helpers (внутренние) ----
const parsePaging = (query = {}) => {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

const buildOrder = (query = {}) => {
    // sort=createdAt:desc,status:asc
    const sort = (query.sort || '').split(',').filter(Boolean);
    if (!sort.length) return [['createdAt', 'DESC']];
    return sort.map(s => {
        const [field, dir] = s.split(':');
        return [field, (dir || 'asc').toUpperCase()];
    });
};

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

// ---- exports ----
module.exports.list = async ({ query = {}, user, companyId } = {}) => {
  const cid = requireCompanyId(companyId || user?.companyId);
  const { page, limit, offset } = parsePaging(query);

  if (query.counterpartyId) await assertCounterpartyInCompany(query.counterpartyId, cid);
  if (query.responsibleId) await assertMemberInCompany(query.responsibleId, cid);
  if (query.pipelineId) await assertPipelineInCompany(query.pipelineId, cid);
  if (query.stageId) await assertStageInCompany(query.stageId, cid, query.pipelineId || null);

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

module.exports.create = async (payload = {}, opts = {}) => {
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId || payload.companyId);
    const counterpartyId = payload.counterpartyId || null;

    if (!counterpartyId) throw new Error('counterpartyId is required');
    if (!payload.title) throw new Error('title is required');

    await assertCounterpartyInCompany(counterpartyId, cid);
    if (payload.responsibleId) await assertMemberInCompany(payload.responsibleId, cid);
    if (payload.pipelineId) await assertPipelineInCompany(payload.pipelineId, cid);
    if (payload.stageId) await assertStageInCompany(payload.stageId, cid, payload.pipelineId || null);

    const toCreate = { ...payload, companyId: cid };
    delete toCreate.companyId;

    return Deal.create({ ...toCreate, companyId: cid });
};

module.exports.update = async (id, payload = {}, opts = {}) => {
    if (!id) throw new Error('id is required');
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId || payload.companyId);

    if (payload.counterpartyId) await assertCounterpartyInCompany(payload.counterpartyId, cid);
    if (payload.responsibleId) await assertMemberInCompany(payload.responsibleId, cid);
    if (payload.pipelineId) await assertPipelineInCompany(payload.pipelineId, cid);
    if (payload.stageId) await assertStageInCompany(payload.stageId, cid, payload.pipelineId || null);

    const item = await Deal.findOne({ where: { id, companyId: cid } });
    if (!item) return null;

    const next = { ...payload };
    delete next.companyId;

    await item.update(next);
    return module.exports.getById(id, { companyId: cid });
};

module.exports.remove = async (id, opts = {}) => {
    if (!id) throw new Error('id is required');
    const cid = requireCompanyId(opts.companyId || opts.user?.companyId);
    return Deal.destroy({ where: { id, companyId: cid } });
};
