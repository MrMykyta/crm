'use strict';

const userService = require('../../services/crm/userService');
const tokenService = require('../../utils/tokenService');
const authService = require('../../services/system/authService');
const { requestReset, resetPassword } = require('../../services/system/passwordResetService');
const mailer = require('../../services/system/mailer');
const AppError = require('../../errors/AppError');
const asyncHandler = require('../../middleware/asyncHandler');
const logger = require('../../lib/logger');

exports.register = asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  const { accessToken, refreshToken } = await authService.register(
    { email, password, firstName, lastName },
    { userAgent: req.headers['user-agent'], ip: req.ip }
  );

  return res.status(201).send({ ok: true, accessToken, refreshToken });
});

module.exports.verify = asyncHandler(async (req, res) => {
  try {
    const { accessToken, refreshToken } = await authService.verifyEmail(req.query.token);
    return res.status(200).send({ verified: true, tokens: { accessToken, refreshToken } });
  } catch (error) {
    throw new AppError(501, error.message);
  }
});

module.exports.resendVerification = asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  await authService.resendVerificationMail(String(email || '').trim().toLowerCase());
  return res.json({ ok: true });
});

exports.login = asyncHandler(async (req, res) => {
  try {
    const { email, password, companyId } = req.body;

    const result = await userService.login(
      { email, password, companyId },
      { userAgent: req.headers['user-agent'], ip: req.ip }
    );

    if (result.selectCompany) {
      return res.status(200).send({ data: result });
    }

    const { safeUser, accessToken, refreshToken, activeCompanyId } = result;
    return res
      .status(200)
      .send({ user: safeUser, tokens: { accessToken, refreshToken }, activeCompanyId });
  } catch (error) {
    throw new AppError(401, error.message);
  }
});

exports.loginFromCompany = asyncHandler(async (req, res) => {
  try {
    const { companyId } = req.body;
    const { safeUser, accessToken, refreshToken, activeCompanyId } =
      await userService.loginFromCompany({ userId: req.user.id, companyId });

    return res.status(200).send({ safeUser, accessToken, refreshToken, activeCompanyId });
  } catch (error) {
    throw new AppError(401, error.message);
  }
});

exports.refresh = asyncHandler(async (req, res) => {
  try {
    const ref = req.body.refreshToken;
    const companyId = req.body.companyId;
    const { accessToken, refreshToken, userId } = await tokenService.rotateRefresh(ref, companyId, {
      userAgent: req.headers['user-agent'],
      ip: req.ip,
    });

    const user = await userService.getMe(userId);
    return res.status(200).send({ accessToken, refreshToken, user });
  } catch (error) {
    throw new AppError(401, error.message);
  }
});

exports.logout = asyncHandler(async (req, res) => {
  try {
    const { refreshToken } = req.body;
    await tokenService.revokeRefresh(refreshToken);
    return res.status(200).send({ ok: true });
  } catch (error) {
    throw new AppError(400, error.message);
  }
});

exports.logoutAll = asyncHandler(async (req, res) => {
  try {
    await tokenService.revokeAllUserRefresh(req.user.id);
    return res.status(200).send({ ok: true });
  } catch (error) {
    throw new AppError(400, error.message);
  }
});

exports.forgot = asyncHandler(async (req, res) => {
  try {
    const { email } = req.body || {};
    await requestReset(email, mailer, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.json({ ok: true });
  } catch (error) {
    logger.error('[forgot] failed', { error: error.message });
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});

exports.reset = asyncHandler(async (req, res) => {
  try {
    const { token, password } = req.body || {};
    await resetPassword(token, password);
    return res.json({ ok: true });
  } catch (error) {
    if (['INVALID', 'EXPIRED', 'USED', 'BAD_REQUEST', 'NOT_FOUND'].includes(error.code)) {
      return res.status(400).json({ ok: false, message: error.message });
    }

    logger.error('[reset] failed', { error: error.message });
    return res.status(500).json({ ok: false, message: 'Server error' });
  }
});
