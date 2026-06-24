const { Op } = require('sequelize');
const { sequelize, CompanyDepartment, UserCompany, User } = require('../../models');

const CODE_RE = /^[a-z0-9][a-z0-9_-]{1,31}$/;

function serviceError(status, message, code = 'DEPARTMENT_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function normalizeName(value) {
  return String(value || '').trim();
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
}

function normalizeCode(value, fallbackName) {
  return String(value || slugify(fallbackName) || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function validatePayload(data = {}, { partial = false } = {}) {
  const patch = {};

  if (!partial || Object.prototype.hasOwnProperty.call(data, 'name')) {
    const name = normalizeName(data.name);
    if (!name || name.length < 2 || name.length > 100) {
      throw serviceError(400, 'Department name must be 2..100 characters.', 'VALIDATION_ERROR');
    }
    patch.name = name;
  }

  if (!partial || Object.prototype.hasOwnProperty.call(data, 'code')) {
    const code = normalizeCode(data.code, patch.name || data.name);
    if (!CODE_RE.test(code)) {
      throw serviceError(400, 'Department code must be 2..32 lowercase letters, numbers, dashes or underscores.', 'VALIDATION_ERROR');
    }
    patch.code = code;
  }

  if (Object.prototype.hasOwnProperty.call(data, 'description')) {
    const description = String(data.description || '').trim();
    patch.description = description || null;
  } else if (!partial) {
    patch.description = null;
  }

  return patch;
}

async function ensureUnique({ companyId, code, name, excludeId = null, transaction }) {
  const baseWhere = { companyId };
  if (excludeId) baseWhere.id = { [Op.ne]: excludeId };

  const existingCode = await CompanyDepartment.findOne({
    where: { ...baseWhere, code },
    paranoid: false,
    transaction,
  });
  if (existingCode) {
    throw serviceError(409, 'Department code already exists.', 'DEPARTMENT_CODE_EXISTS');
  }

  const existingName = await CompanyDepartment.findOne({
    where: { ...baseWhere, name },
    paranoid: false,
    transaction,
  });
  if (existingName) {
    throw serviceError(409, 'Department name already exists.', 'DEPARTMENT_ALREADY_EXISTS');
  }
}

function normalizeDbError(error) {
  if (error?.name === 'SequelizeUniqueConstraintError') {
    return serviceError(409, 'Department code already exists.', 'DEPARTMENT_CODE_EXISTS');
  }
  return error;
}

function toDto(department, members = []) {
  if (!department) return null;
  const plain = typeof department.get === 'function' ? department.get({ plain: true }) : department;
  const memberRows = Array.isArray(members) ? members : plain.members || [];
  const normalizedMembers = memberRows.map((row) => {
    const item = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    const user = item.user || {};
    return {
      userId: item.userId,
      email: user.email || null,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.avatarUrl || null,
      role: item.role,
      status: item.status,
      departmentId: item.departmentId || null,
      isLead: !!item.isLead,
    };
  });

  return {
    id: plain.id,
    companyId: plain.companyId,
    name: plain.name,
    code: plain.code,
    description: plain.description || null,
    isActive: plain.isActive !== false,
    deletedAt: plain.deletedAt || null,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
    memberCount: normalizedMembers.length,
    leadCount: normalizedMembers.filter((member) => member.isLead).length,
    members: normalizedMembers,
  };
}

async function getMembers(companyId, departmentId, transaction) {
  return UserCompany.findAll({
    where: { companyId, departmentId, status: 'active' },
    include: [{
      model: User,
      as: 'user',
      attributes: ['id', 'email', 'firstName', 'lastName', 'avatarUrl'],
      required: true,
    }],
    order: [['isLead', 'DESC'], ['createdAt', 'ASC']],
    transaction,
  });
}

module.exports.list = async (companyId, query = {}) => {
  const includeArchived = String(query.includeArchived || '') === 'true';
  const where = { companyId };
  if (!includeArchived) where.isActive = true;
  if (query.search) {
    const like = `%${String(query.search).trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: like } },
      { code: { [Op.iLike]: like } },
    ];
  }

  const departments = await CompanyDepartment.findAll({
    where,
    paranoid: !includeArchived,
    order: [['isActive', 'DESC'], ['name', 'ASC']],
  });
  const members = await UserCompany.findAll({
    where: { companyId, departmentId: { [Op.in]: departments.map((department) => department.id) }, status: 'active' },
    attributes: ['departmentId', 'isLead'],
  });
  const counts = members.reduce((acc, row) => {
    const key = String(row.departmentId);
    const item = acc.get(key) || { memberCount: 0, leadCount: 0 };
    item.memberCount += 1;
    if (row.isLead) item.leadCount += 1;
    acc.set(key, item);
    return acc;
  }, new Map());

  return departments.map((department) => ({
    ...toDto(department, []),
    ...(counts.get(String(department.id)) || { memberCount: 0, leadCount: 0 }),
    members: undefined,
  }));
};

module.exports.getById = async (companyId, id, { includeArchived = true } = {}) => {
  const department = await CompanyDepartment.findOne({
    where: { id, companyId },
    paranoid: !includeArchived,
  });
  if (!department) return null;
  const members = await getMembers(companyId, id);
  return toDto(department, members);
};

module.exports.create = async (companyId, userId = null, data = {}) => {
  const patch = validatePayload(data);
  try {
    return await sequelize.transaction(async (transaction) => {
      await ensureUnique({ companyId, code: patch.code, name: patch.name, transaction });
      const department = await CompanyDepartment.create(
        { companyId, ...patch, isActive: true },
        { transaction }
      );
      return toDto(department, []);
    });
  } catch (error) {
    throw normalizeDbError(error);
  }
};

module.exports.update = async (companyId, userId = null, id, data = {}) => {
  const patch = validatePayload(data, { partial: true });
  try {
    return await sequelize.transaction(async (transaction) => {
      const department = await CompanyDepartment.findOne({
        where: { id, companyId },
        paranoid: false,
        transaction,
      });
      if (!department) return null;

      await ensureUnique({
        companyId,
        code: patch.code ?? department.code,
        name: patch.name ?? department.name,
        excludeId: id,
        transaction,
      });

      await department.update(patch, { transaction });
      const members = await getMembers(companyId, id, transaction);
      return toDto(department, members);
    });
  } catch (error) {
    throw normalizeDbError(error);
  }
};

module.exports.archive = async (companyId, id) => {
  return sequelize.transaction(async (transaction) => {
    const department = await CompanyDepartment.findOne({ where: { id, companyId }, transaction });
    if (!department) return null;
    await department.update({ isActive: false }, { transaction });
    await department.destroy({ transaction });
    return true;
  });
};

module.exports.restore = async (companyId, id) => {
  return sequelize.transaction(async (transaction) => {
    const department = await CompanyDepartment.findOne({
      where: { id, companyId },
      paranoid: false,
      transaction,
    });
    if (!department) return null;
    if (department.deletedAt) await department.restore({ transaction });
    await department.update({ isActive: true }, { transaction });
    const members = await getMembers(companyId, id, transaction);
    return toDto(department, members);
  });
};

module.exports.assertActiveDepartment = async (companyId, departmentId, transaction) => {
  if (!departmentId) return null;
  const department = await CompanyDepartment.findOne({
    where: { id: departmentId, companyId, isActive: true },
    transaction,
  });
  if (!department) {
    throw serviceError(400, 'departmentId is invalid', 'DEPARTMENT_INVALID');
  }
  return department;
};
