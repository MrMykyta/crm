const bcrypt = require('bcrypt');
const { sequelize, User, Company, UserCompany, ContactPoint } = require('../../models');
const { addContacts } = require('./contactPointService');
const tokenService = require('../../utils/tokenService');

module.exports.register = async ({ email, password, firstName, lastName }, meta={}) => {
  const exists = await User.findOne({ where: { email } });
  if (exists) {
    throw new Error('Email уже используется');
  }
  const password_hash = await bcrypt.hash(password, 10);

  const user = await User.create({
    email,
    passwordHash: password_hash,
    firstName: firstName || null,
    lastName: lastName || null,
  });

  const accessToken = tokenService.signAccessToken({ userId: user.id });
  const { token: refreshToken } = await tokenService.issueRefreshToken({
    userId: user.id,
    userAgent: meta.userAgent,
    ip: meta.ip
  });
  return { accessToken, refreshToken };
};

module.exports.login = async ({ email, password, companyId }, meta = {}) => {
  const user = await User.findOne({ where: { email } });
  if (!user) throw new Error('Неверные логин или пароль');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error('Неверные логин или пароль');

  if (user.isActive === false) throw new Error('Аккаунт деактивирован');

  await user.update({ lastLoginAt: new Date() });

  // активные членства + названия компаний
  const memberships = await UserCompany.findAll({
    where: { userId: user.id, status: 'active' },
    include: [{ model: Company, as: 'company', attributes: ['id', 'name'] }],
    order: [['createdAt', 'ASC']],
  });

  const companies = memberships.map(m => ({
    companyId: m.companyId,
    name: m.company?.name || 'Без названия',
    role: m.role,
  }));


  // если companyId пришёл — валидируем и выдаём токены
  if (companyId) {
    const chosen = memberships.find(m => m.companyId === companyId);
    if (!chosen) {
      const err = new Error('Выбранная компания недоступна');
      err.code = 'COMPANY_NOT_ALLOWED';
      throw err;
    }

    const accessToken = tokenService.signAccessToken({ userId: user.id, activeCompanyId: companyId });
    const { token: refreshToken } = await tokenService.issueRefreshToken({
      userId: user.id,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return { accessToken, refreshToken, companies };
  }

  // companyId НЕ пришёл
  if (companies.length === 0) {
    // нет компаний — можно выдать токен без companyId или вернуть ошибку
    const accessToken = tokenService.signAccessToken({ userId: user.id, activeCompanyId: null });
    const { token: refreshToken } = await tokenService.issueRefreshToken({
      userId: user.id,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return { accessToken, refreshToken, companyId: companies };
  }

  if (companies.length === 1) {
    // одна компания — авто-выбор
    const { companyId } = companies[0];
    const accessToken = tokenService.signAccessToken({ userId: user.id, activeCompanyId: companyId });
    const { token: refreshToken } = await tokenService.issueRefreshToken({
      userId: user.id,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
    return { accessToken, refreshToken, companyId};
  }

  // несколько компаний — просим выбрать (БЕЗ токенов)
  return {
    selectCompany: true,
    companies,   // [{companyId, name, role}, ...]
    message: 'Выберите компанию для продолжения',
  };
};

module.exports.getMe = async (userId) => {
  return User.findByPk(userId, {
    attributes: ['id', 'email', 'first_name', 'last_name', 'is_active', 'last_login_at', 'created_at', 'updated_at'],
    include: [{
      model: ContactPoint, as: 'contacts'
    }]
  });
};

module.exports.updateMe = async (userId, companyId, data = {}) => {
  // companyId обязателен для contact_points (FK NOT NULL)
  if (!companyId && Array.isArray(data.contacts) && data.contacts.length) {
    throw new Error('companyId is required to save contacts');
  }

  const t = await sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction: t });
    if (!user) {
      throw new Error('Пользователь не найден');
    }

    // собираем патч только из разрешённых полей
    const patch = {};
    if (data.firstName !== undefined) {
      patch.firstName = data.firstName;
    }
    if (data.lastName  !== undefined) {
      patch.lastName  = data.lastName;
    }
    if (data.password) {
      patch.passwordHash = await bcrypt.hash(data.password, 10);
    }

    await user.update(patch, { transaction: t });

    // добавление НОВЫХ контактов (create)
    await addContacts({
      companyId,
      ownerType: 'user',
      ownerId: user.id,
      contacts: data.contacts,
      userId,
      t
    });

    await t.commit();
    return user; // при желании можешь вернуть с include: contacts (после отдельного find)
  } catch (e) {
    await t.rollback();
    throw e;
  }
};

module.exports.getUserCompanies = async (userId) => {
  return Company.findAll({
    include: [{
      model: UserCompany,
      as: 'memberships',
      where: { userId: userId },
      attributes: ['role', 'status'],
      required: true,
    }],
    include: [{ 
      model: ContactPoint, 
      as: 'contacts' 
    }],
    order: [['created_at', 'DESC']],

  });
};