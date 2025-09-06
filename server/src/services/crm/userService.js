const bcrypt = require('bcrypt');
const { sequelize, User, Company, UserCompany, ContactPoint } = require('../../models');
const { addContacts } = require('./contactPointService');
const tokenService = require('../../utils/tokenService');

module.exports.register = async ({ email, password, firstName, lastName, verificationToken, expiresAt}, meta={}) => {
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
    verificationToken: verificationToken,
    verificationExpiresAt: expiresAt,
    emailVerifiedAt: null
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
  let user = await User.findOne({ where: { email } });
  if (!user) throw new Error('errors.loginFailed');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new Error('errors.loginFailed');

  if (user.isActive === false) throw new Error('errors.accountNotActive');

  await user.update({ lastLoginAt: new Date() });

  user = await User.findByPk(user.id, {
    attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lastLoginAt', 'emailVerifiedAt', 'createdAt'],
    include: [{
      model: ContactPoint, 
      as: 'contacts'
    }]
  });

  const phoneRaw = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueRaw || null;
  const phoneNorm = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueNorm || null;
  const emailRaw = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueRaw || null;
  const emailNorm = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueNorm || null;
  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    phoneRaw,
    phoneNorm,
    emailRaw,
    emailNorm,
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt
  };

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

    return { safeUser, accessToken, refreshToken, activeCompanyId: companyId };
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
    return { safeUser, accessToken, refreshToken, undefined };
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
    return { safeUser, accessToken, refreshToken, activeCompanyId: companyId};
  }

  // несколько компаний — просим выбрать (БЕЗ токенов)
  return {
    selectCompany: true,
    companies,   // [{companyId, name, role}, ...]
    message: 'Выберите компанию для продолжения',
  };
};

module.exports.loginFromCompany = async ({userId, companyId}) => {
  try{
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lastLoginAt', 'createdAt'],
      include: [{
        model: ContactPoint, 
        as: 'contacts'
      }]
    });
    
    if (user.isActive === false) throw new Error('errors.accountNotActive');

    await user.update({ lastLoginAt: new Date() });
    const phoneRaw = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueRaw || null;
    const phoneNorm = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueNorm || null;
    const emailRaw = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueRaw || null;
    const emailNorm = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueNorm || null;
    const safeUser = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
      phoneRaw,
      phoneNorm,
      emailRaw,
      emailNorm,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt
    };
    const membership = await UserCompany.findAll({
      where: { userId: userId, companyId:companyId, status: 'active' }
    });

    if (!membership) {
      throw new Error('Выбранная компания недоступна');
    }
    
    const accessToken = tokenService.signAccessToken({ userId, activeCompanyId: companyId });
    const { token: refreshToken } = await tokenService.issueRefreshToken({
      userId
    });

    return { safeUser, accessToken, refreshToken, activeCompanyId: companyId };
  }catch(e){
    console.log(e);
  }
  
}

module.exports.getMe = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lastLoginAt', 'emailVerifiedAt', 'createdAt'],
    include: [{
      model: ContactPoint, 
      as: 'contacts'
    }]
  });
  console.log(user.contacts[0])
  const phoneRaw = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueRaw || null;
  const phoneNorm = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueNorm || null;
  const emailRaw = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueRaw || null;
  const emailNorm = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueNorm || null;
  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    phoneRaw,
    phoneNorm,
    emailRaw,
    emailNorm,
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt
  };
  return safeUser;
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
    console.log('User updated:', data.contacts);
    // добавление НОВЫХ контактов (create)
    await addContacts({
      companyId,
      ownerType: 'user',
      ownerId: user.id,
      contacts: [data.contacts],
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