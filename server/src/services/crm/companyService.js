// src/services/companyService.js
const { sequelize, Company, UserCompany} = require('../../models');
const ApplicationError = require('../../errors/ApplicationError');
const { bootstrapCompanyAcl } = require('../system/aclBootstrap');
const { addContacts } = require('./contactPointService');

const UUID_RE = /^[0-9a-fA-F-]{32,36}$/;
const isFileApiUrl = (v) => typeof v === 'string' && v.includes('/api/files/');
const isHttpUrl = (v) => /^https?:\/\/.+/i.test(v);
const validateFileIdField = (field, value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApplicationError(`VALIDATION_ERROR: ${field} must be uuid or null`, 400);
  }
  if (isFileApiUrl(value)) {
    throw new ApplicationError(`VALIDATION_ERROR: ${field} must be fileId, not URL`, 400);
  }
  if (!UUID_RE.test(value)) {
    throw new ApplicationError(`VALIDATION_ERROR: ${field} must be uuid`, 400);
  }
  return value;
};

const validateAvatarField = (field, value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new ApplicationError(`VALIDATION_ERROR: ${field} must be uuid or url or null`, 400);
  }
  if (isFileApiUrl(value)) {
    throw new ApplicationError(`VALIDATION_ERROR: ${field} must be fileId or external URL`, 400);
  }
  if (UUID_RE.test(value)) return value;
  if (isHttpUrl(value)) return value;
  throw new ApplicationError(`VALIDATION_ERROR: ${field} must be uuid or url`, 400);
};

/** утилита: роль пользователя в компании */
async function getUserRole(userId, companyId) {
  const membership = await UserCompany.findOne({
    where: { userId: userId, 
      companyId: companyId 
    },
    attributes: ['role', 'status'],
  });
  return membership ? membership.role : null;
}

module.exports.listForUser = async (userId) => {
  return await Company.findAll({
    include: [{
      model: UserCompany,
      as: 'memberships',
      where: { userId: userId },
      attributes: ['role', 'status'],
    }],
    order: [['created_at', 'DESC']],
  });
};

module.exports.getByIdScoped = async (userId, companyId) => {
  // видит только если состоит в компании
  return await Company.findOne({
    where: { id: companyId },
    include: [{
      model: UserCompany,
      as: 'memberships',
      where: { user_id: userId },
      attributes: ['role', 'status'],
      required: true,
    }],
  });
};

module.exports.createWithOwner = async (ownerUserId, data = {}) => {
  const t = await sequelize.transaction();
  try {
    // разрешённый патч
    const allowed = (({
      name, nip, regon, krs, bdo, website, street, postalCode, city, country, description
    }) => ({ name, nip, regon, krs, bdo, website, street, postalCode, city, country, description }))(data);

    // 1) компания
    const company = await Company.create(
      { ...allowed, ownerUserId },
      { transaction: t }
    );

    // 2) членство владельца
    await UserCompany.create({
      userId: ownerUserId,
      companyId: company.id,
      role: 'owner',
      status: 'active',
    }, { transaction: t });

    // 3) контакт‑поинты компании (опционально)
    await addContacts({
      companyId: company.id,
      ownerType: 'company',
      ownerId: company.id,
      contacts: data.contacts,
      actorUserId: ownerUserId,
      t
    });

    // 4) bootstrap ACL (создаст owner/admin/manager/employee и назначит владельца)
    await bootstrapCompanyAcl({ companyId: company.id, ownerUserId, transaction: t });


    await t.commit();
    return company;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

module.exports.updateCompany = async (requesterId, companyId, payload = {}) => {
  // проверка роли до начала транзакции
  const role = await getUserRole(requesterId, companyId);
  if (!role || !['owner', 'admin'].includes(role)) return null;

  const t = await sequelize.transaction();
  try {
    const company = await Company.findByPk(companyId, { transaction: t });
    if (!company) {
      await t.rollback();
      return null;
    }

    // разрешённые поля к обновлению
    const allowed = (({
      name, nip, regon, krs, bdo, website, street, postalCode, city, country, description, ownerUserId, avatarUrl
    }) => ({ name, nip, regon, krs, bdo, website, street, postalCode, city, country, description, ownerUserId, avatarUrl }))(payload);

    if (allowed.avatarUrl !== undefined) {
      allowed.avatarUrl = validateAvatarField('avatarUrl', allowed.avatarUrl);
    }

    await company.update(allowed, { transaction: t });

    // добавление НОВЫХ контактов (апдейт/удаление — отдельными эндпоинтами)
    await addContacts({
      companyId,
      ownerType: 'company',
      ownerId: companyId,
      contacts: payload.contacts,
      actorUserId: requesterId,
      t
    });

    await t.commit();
    return company;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};


module.exports.deleteCompany = async (requesterId, companyId) => {
  // удалять компанию — только owner
  const role = await getUserRole(requesterId, companyId);
  if (role !== 'owner') return false;

  const company = await Company.findByPk(companyId);
  if (!company) return false;

  await company.destroy(); // paranoid: true — soft delete
  return true;
};
