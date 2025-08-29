const { Op } = require('sequelize');
const { Deal, Counterparty, User, Task } = require('../../models');

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
    if (query.counterpartyId) {
        where.counterpartyId = query.counterpartyId;
    }
    if (query.responsibleId) {
        where.responsibleId = query.responsibleId;
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

const defaultInclude = [
    { model: Counterparty, 
        as: 'counterparty', 
        attributes: ['id', 'fullName'] 
    },
    { model: User, 
        as: 'responsible', 
        attributes: ['id', 'email', 'firstName', 'lastName'] 
    },
];

// ---- exports ----
module.exports.list = async ({ query = {}, user } = {}) => {
  const { page, limit, offset } = parsePaging(query);
  const where = buildWhere(query, user);
  const order = buildOrder(query);

  const { rows, count } = await Deal.findAndCountAll({
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
    return Deal.findByPk(id, {
        include: [
        ...defaultInclude,
        { model: Task, 
            as: 'tasks', 
            attributes: ['id', 'title', 'status', 'priority', 'dueDate'] 
        },
        ],
    });
};

module.exports.create = async (payload = {}) => {
    if (!payload.companyId) {
        throw new Error('companyId is required');
    }
    if (!payload.counterpartyId) {
        throw new Error('counterpartyId is required');
    }
    if (!payload.title) {
        throw new Error('title is required');
    }
    return Deal.create(payload);
};

module.exports.update = async (id, payload = {}) => {
    if (!id) {
        throw new Error('id is required');
    }
    const item = await Deal.findByPk(id);
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
    return Deal.destroy({ where: { id } });
};
