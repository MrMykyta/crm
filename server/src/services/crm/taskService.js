const { Op } = require('sequelize');
const { Task, Counterparty, Deal, User } = require('../../models');

// ---- helpers (внутренние) ----
const parsePaging = (query = {}) => {
    const page = Math.max(parseInt(query.page || '1', 10), 1);
    const limit = Math.min(Math.max(parseInt(query.limit || '20', 10), 1), 200);
    const offset = (page - 1) * limit;
    return { page, limit, offset };
};

const buildOrder = (query = {}) => {
    const sort = (query.sort || '').split(',').filter(Boolean);
    if (!sort.length) return [['createdAt', 'DESC']];
    return sort.map(s => {
        const [field, dir] = s.split(':');
        return [field, (dir || 'asc').toUpperCase()];
    });
};

const buildWhere = (query = {}, user) => {
    const where = {};

    // company scope
    if (query.companyId) {
        where.companyId = query.companyId;
    }
    else if (user?.companyId) {
        where.companyId = user.companyId;
    }

    if (query.status) {
        where.status = query.status;
    }
    if (query.priority) {
        where.priority = query.priority;
    }
    if (query.assigneeId) {
        where.assigneeId = query.assigneeId;
    }
    if (query.creatorId) {
        where.creatorId = query.creatorId;
    }
    if (query.counterpartyId) {
        where.counterpartyId = query.counterpartyId;
    }
    if (query.dealId){
        where.dealId = query.dealId;
    }

    // dueDate range
    if (query.dueFrom || query.dueTo) {
        where.dueDate = {};
        if (query.dueFrom) {
            where.dueDate[Op.gte] = new Date(query.dueFrom);
        }
        if (query.dueTo) {
            where.dueDate[Op.lte] = new Date(query.dueTo);
        }
    }

    // free text
    if (query.q) {
        where[Op.or] = [
        { title: { [Op.iLike]: `%${query.q}%` } },
        { description: { [Op.iLike]: `%${query.q}%` } },
        ];
    }

    return where;
};

const defaultInclude = [
  { model: Counterparty, 
    as: 'counterparty', 
    attributes: ['id', 'fullName'] 
    },
  { model: Deal, 
    as: 'deal', 
    attributes: ['id', 'title', 'status'] 
    },
  { model: User,
    as: 'assignee', 
    attributes: ['id', 'email', 'firstName', 'lastName'] 
    },
  { model: User, 
    as: 'creator', 
    attributes: ['id', 'email', 'firstName', 'lastName'] 
    },
];

// ---- exports ----
module.exports.list = async ({ query = {}, user } = {}) => {
    const { page, limit, offset } = parsePaging(query);
    const where = buildWhere(query, user);
    const order = buildOrder(query);

    const { rows, count } = await Task.findAndCountAll({
        where,
        include: defaultInclude,
        order,
        limit,
        offset,
    });

    return { rows, count, page, limit };
};

module.exports.getById = async (id) => {
    if (!id) {
        return null;
    }
    return Task.findByPk(id, { include: defaultInclude });
};

module.exports.create = async (payload = {}) => {
    if (!payload.companyId) {
        throw new Error('companyId is required');
    }
    if (!payload.title) {
        throw new Error('title is required');
    }

    // (опционально) если привязано к сделке — можно проверить совпадение companyId с deal.companyId
    const deal = payload.dealId ? await Deal.findByPk(payload.dealId) : null;
    if (deal && deal.companyId !== payload.companyId) {
        throw new Error('deal.companyId mismatch');
    }

    return Task.create(payload);
};

module.exports.update = async (id, payload = {}) => {
    if (!id) {
        throw new Error('id is required');
    }
    const item = await Task.findByPk(id);
    if (!item) {
        return null;
    }

    // (опционально) защита по companyId
    if (payload.companyId && payload.companyId !== item.companyId) {
        throw new Error('companyId mismatch');
    }

    await item.update(payload);
    return module.exports.getById(id);
};

module.exports.remove = async (id) => {
    if (!id) {
        throw new Error('id is required');
    }
    return Task.destroy({ where: { id } });
};
