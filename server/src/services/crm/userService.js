const bcrypt = require('bcrypt');
const {
  sequelize,
  User, Company, UserCompany, CompanyDepartment,
  ContactPoint,
  Role, Permission, RolePermission, UserRole, UserPermission
} = require('../../models');
const { addContacts } = require('./contactPointService');
const tokenService = require('../../utils/tokenService');



function toPublic(u) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName || '',
    lastName: u.lastName || '',
    avatarUrl: u.avatarUrl || null,
  };
}


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
    createdBy: null,
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
    attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lastLoginAt', 'emailVerifiedAt', 'avatarUrl', 'createdAt'],
    include: [{
      model: ContactPoint, 
      as: 'contacts'
    }]
  });

  const phoneRaw = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueRaw || null;
  const phoneNorm = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueNorm || null;
  const emailRaw = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueRaw || user.email;
  const emailNorm = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueNorm || user.email;
  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    phoneRaw,
    avatarUrl: user.avatarUrl,
    phoneNorm,
    emailRaw,
    emailNorm,
    createdBy: user.createdBy ?? 'system',
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
      attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lastLoginAt', 'createdBy', 'createdAt'],
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
      createdBy: user.createdBy ?? 'system',
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt
    };
    const membership = await UserCompany.findOne({
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
    attributes: ['id', 'email', 'firstName', 'lastName', 'isActive', 'lastLoginAt', 'emailVerifiedAt','avatarUrl', 'createdBy', 'createdAt'],
    include: [{
      model: ContactPoint, 
      as: 'contacts'
    }]
  });
  const phoneRaw = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueRaw || null;
  const phoneNorm = user.contacts.find(c => c.channel == 'phone' && c.isPublic)?.valueNorm || null;
  const emailRaw = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueRaw || user.email || null;
  const emailNorm = user.contacts.find(c => c.channel == 'email' && c.isPublic)?.valueNorm || user.email || null;
  const safeUser = {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    isActive: user.isActive,
    avatarUrl: user.avatarUrl,
    phoneRaw,
    phoneNorm,
    emailRaw,
    emailNorm,
    createdBy: user.createdBy ?? 'system',
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt
  };
  console.log(safeUser)
  return safeUser;
};

module.exports.updateMe = async (userId, companyId, data = {}) => {
  if (companyId) {
    const membership = await UserCompany.findOne({
      where: { userId, companyId },
    });
    if (!membership) {
      const err = new Error('Forbidden');
      err.status = 403;
      throw err;
    }
  }
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
    include: [
      {
        model: UserCompany,
        as: 'memberships',
        where: { userId: userId },
        attributes: ['role', 'status'],
        required: true,
      },
      { 
        model: ContactPoint, 
        as: 'contacts' 
      },
    ],
    order: [['created_at', 'DESC']],

  });
};

module.exports.findPublicByEmail = async (email) => {
  const user = await User.findOne({
    where: { email: email.toLowerCase() },
    attributes: ['id', 'email', 'firstName', 'lastName'],
  });
  if (!user) return { exists: false };
  return { exists: true, user: toPublic(user) };
};


/** =========== НОВОЕ: получить пользователя по id (с контекстом компании) =========== */
exports.getById = async (userId, companyId) => {
  if (!companyId) return null;

  // членство
  const membership = await UserCompany.findOne({
    where: { userId, companyId },
    include: [{
      model: CompanyDepartment,
      as: 'department',
      attributes: ['id','name'],
      required: false,
      where: { companyId },
    }],
  });
  if (!membership) return null;

  const user = await User.findByPk(userId, {
    attributes: ['id','email','firstName','lastName','avatarUrl','isActive','lastLoginAt','createdAt','emailVerifiedAt'],
    include: [
      {
        model: ContactPoint,
        as: 'contacts',
        required: false,
        where: { companyId },
      },
    ],
  });
  if (!user) return null;

  // роли из user_roles
  let rolesRows = companyId ? await UserRole.findAll({
    where: { userId, companyId },
    include: [{ model: Role, as: 'role', attributes: ['id','name','description'] }],
  }) : [];

  // фолбэк по membership.role
  if (!rolesRows.length && companyId && membership?.role) {
    const r = await Role.findOne({ where: { companyId, name: membership.role }, attributes: ['id','name','description'] });
    if (r) rolesRows = [{ role: r }];
  }

  const roles = rolesRows
    .map(r => r.role)
    .filter(Boolean)
    .map(r => ({ id: r.id, name: r.name, description: r.description || null }));

  // остальное (пермишены) можешь оставить как есть, либо убрать дубли здесь,
  // так как для прав мы уже даём отдельный summary-эндпоинт.

  return {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      avatarUrl: user.avatarUrl || null,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      emailVerifiedAt: user.emailVerifiedAt,
      contacts: user.contacts || [],
    },
    membership: membership ? {
      role: membership.role,
      status: membership.status,
      isLead: !!membership.isLead,
      department: membership.department ? { id: membership.department.id, name: membership.department.name } : null,
      createdAt: membership.createdAt,
    } : null,
    roles,
  };
};

/** =========== НОВОЕ: обновить пользователя по id (частичный) =========== */
exports.updateById = async (userId, companyId, payload = {}) => {
  if (!companyId) return null;
  const t = await sequelize.transaction();
  try {
    const membership = await UserCompany.findOne({
      where: { userId, companyId },
      transaction: t,
    });
    if (!membership) return null;

    const user = await User.findByPk(userId, { transaction: t });
    if (!user) return null;

    const patch = {};
    if (payload.firstName !== undefined) patch.firstName = payload.firstName;
    if (payload.lastName  !== undefined) patch.lastName  = payload.lastName;
    if (payload.isActive  !== undefined) patch.isActive  = !!payload.isActive;
    if (payload.password) patch.passwordHash = await bcrypt.hash(payload.password, 10);
    if (payload.avatarUrl !== undefined) patch.avatarUrl = payload.avatarUrl || null;

    await user.update(patch, { transaction: t });

    // контакты (создание простым путём; при необходимости расширь до upsert)
    if (companyId && Array.isArray(payload.contacts) && payload.contacts.length) {
      await addContacts({
        companyId,
        ownerType: 'user',
        ownerId: user.id,
        contacts: payload.contacts,
        userId: /* оператор */ null,
        t,
      });
    }

    await t.commit();
    return this.getById(userId, companyId); // вернём свежее состояние
  } catch (e) {
    await t.rollback();
    throw e;
  }
};
