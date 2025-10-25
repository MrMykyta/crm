const userService = require('../../services/crm/userService');
const tokenService = require('../../utils/tokenService');
const authService = require('../../services/system/authService');
const { requestReset, resetPassword } = require('../../services/system/passwordResetService');
const mailer = require('../../services/system/mailer'); // у тебя уже есть sendMail

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    const { accessToken, refreshToken } = await authService.register(
      { email, password, firstName, lastName }, 
      { userAgent: req.headers['user-agent'], ip: req.ip });
      
    res.status(201).send({ ok: true, accessToken, refreshToken });
  } catch (e) { 
    res.status(400).send({ error: e.message }); 
}};

module.exports.verify = async (req, res) => {
  try {
    const {accessToken, refreshToken} = await authService.verifyEmail(req.query.token);
  // редирект на фронт (страница «подтверждено»)
    res.status(200).send({ verified: true, tokens: {accessToken, refreshToken} });
  } catch (e) {
    res.status(501).send({ error: e.message }); 
  }
};

module.exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body || {};
    await authService.resendVerificationMail(String(email || '').trim().toLowerCase());
    return res.json({ ok: true });
  } catch (e) {
    console.error('[resendVerify]', e);
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    const result = await userService.login(
      { email, password, companyId }, 
      { userAgent: req.headers['user-agent'], ip: req.ip }
    );
    // если требуется выбор компании — шлём список без токенов
    if (result.selectCompany) {
      return res.status(200).send({data: result}); // { selectCompany, companies, message }
    }

    // обычный путь — токены есть
    const { safeUser, accessToken, refreshToken, activeCompanyId } = result;
    const user = safeUser;
    return res.status(200).send({ user, tokens: {accessToken, refreshToken}, activeCompanyId });
  } catch (e) {
    return res.status(401).send({ error: e.message });
  }
};

exports.loginFromCompany = async (req, res) => {
  try {
    const { companyId } = req.body;
    const { safeUser, accessToken, refreshToken, activeCompanyId } = await userService.loginFromCompany({ userId: req.user.id, companyId });
    res.status(200).send({ safeUser, accessToken, refreshToken, activeCompanyId });
  } catch (e) {
    console.error('[loginFromCompany]', e);
    res.status(401).send({ error: e.message });
  }
}

module.exports.switchCompany = async ({ userId, companyId }) => {
  const membership = await UserCompany.findOne({
    where: { userId, companyId, status: 'active' },
  });
  if (!membership) {
    const err = new Error('Компания недоступна');
    err.code = 'COMPANY_NOT_ALLOWED';
    throw err;
  }
  const accessToken = tokenService.signAccessToken({ userId, companyId });
  const { token: refreshToken } = await tokenService.issueRefreshToken({
      userId: userId,
      userAgent: meta.userAgent,
      ip: meta.ip,
    });
  return { accessToken, refreshToken };
};


exports.refresh = async (req, res) => {
  try {
    const ref = req.body.refreshToken;
    const companyId = req.body.companyId;
    const { accessToken, refreshToken } = await tokenService.rotateRefresh(ref, companyId, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    res.status(200).send({accessToken, refreshToken}); // { accessToken, refreshToken, expiresAt }
  } catch (e) { 
    res.status(401).send({ error: e.message }); 
}};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await tokenService.revokeRefresh(refreshToken);
    res.status(200).send({ ok: true });
  } catch (e) { 
    res.status(400).json({ error: e.message }); 
}};

exports.logoutAll = async (req, res) => {
  try {
    await tokenService.revokeAllUserRefresh(req.user.id);
    res.status(200).send({ ok: true });
  } catch (e) { 
    res.status(400).send({ error: e.message }); 
}};

exports.forgot = async (req, res) => {
  try {
    const { email } = req.body || {};
    await requestReset(email, mailer, { ip: req.ip, userAgent: req.headers['user-agent'] });
    // всегда 200
    res.json({ ok: true });
  } catch (e) {
    console.error('[forgot]', e);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};

exports.reset = async (req, res) => {
  try {
    const { token, password } = req.body || {};
    await resetPassword(token, password);
    res.json({ ok: true });
  } catch (e) {
    if (['INVALID','EXPIRED','USED','BAD_REQUEST','NOT_FOUND'].includes(e.code)) {
      return res.status(400).json({ ok: false, message: e.message });
    }
    console.error('[reset]', e);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
};