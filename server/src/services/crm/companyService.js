// src/services/companyService.js
const { sequelize, Company, UserCompany} = require('../../models');
const { bootstrapCompanyAcl } = require('../system/aclBootstrap');
const { addContacts } = require('./contactPointService');

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
  return Company.findAll({
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
  return Company.findOne({
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
      name, nip, regon, krs, bdo, website, street, postalCode, city, country, description, ownerUserId
    }) => ({ name, nip, regon, krs, bdo, website, street, postalCode, city, country, description, ownerUserId }))(payload);

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
