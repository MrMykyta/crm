const { sequelize, CompanyDepartment } = require('../../models');
const { addContacts } = require('./contactPointService');

module.exports.list = async (companyId) => {
    return CompanyDepartment.findAll({ 
        where: { 
            companyId: companyId 
        }, 
        order: [['created_at','DESC']] 
    });
};

module.exports.create = async (companyId, userId = null, data = {}) => {
  const t = await sequelize.transaction();
  console.log('Creating department:', data);

  try {
    const department = await CompanyDepartment.create(
      { companyId, name: data.name, description: data.description ?? null },
      { transaction: t }
    );

    // Контакты отдела (опционально)
    await addContacts({
      companyId,
      ownerType: 'department',
      ownerId: department.id,
      contacts: data.contacts,
      userId,
      t
    });

    await t.commit();
    return department;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

module.exports.update = async (companyId, userId = null, id, data = {}) => {
  const t = await sequelize.transaction();
  try {
    const department = await CompanyDepartment.findOne({
      where: { id, companyId },
      transaction: t
    });
    console.log(department)
    if (!department) {
      await t.rollback();
      return null;
    }

    // апдейт полей отдела
    await department.update(
      { name: data.name ?? department.name, description: data.description ?? department.description },
      { transaction: t }
    );
    console.log('Updated department:', department);

    // добавление НОВЫХ контакт‑поинтов
    await addContacts({
      companyId,
      ownerType: 'department',
      ownerId: department.id,
      contacts: data.contacts,
      userId,
      t
    });

    await t.commit();
    return department;
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

module.exports.remove = async (companyId, id) => {
    const row = await CompanyDepartment.findOne({ where: { 
        id, 
        companyId: companyId 
        } 
    });
    if (!row) {
        return false;
    }
    await row.destroy();
    return true;
};
