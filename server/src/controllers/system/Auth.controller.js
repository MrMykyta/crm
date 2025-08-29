const userService = require('../../services/crm/userService');
const tokenService = require('../../utils/tokenService');

exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const { accessToken, refreshToken } = await userService.register(
      { email, password, firstName, lastName },
      { userAgent: req.headers['user-agent'], ip: req.ip }
    );
    res.status(201).send({ accessToken, refreshToken });
  } catch (e) { 
    res.status(400).send({ error: e.message }); 
}};

exports.login = async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    const result = await userService.login(
      { email, password, companyId }, 
      { userAgent: req.headers['user-agent'], ip: req.ip }
    );
    // если требуется выбор компании — шлём список без токенов
    if (result.selectCompany) {
      return res.status(200).send(result); // { selectCompany, companies, message }
    }

    // обычный путь — токены есть
    const { accessToken, refreshToken, companyId: cid } = result;
    return res.status(200).send({ accessToken, refreshToken, companyId: cid });
  } catch (e) {
    return res.status(401).send({ error: e.message });
  }
};

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
    const { refreshToken } = req.body;
    const rotated = await tokenService.rotateRefresh(refreshToken, {
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
    res.status(200).send(rotated); // { accessToken, refreshToken, expiresAt }
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
