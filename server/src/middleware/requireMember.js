// middlewares/requireMember.js
const { UserCompany } = require('../models');
const AppError = require('../errors/AppError');

// Проверяет, что пользователь состоит в текущей компании, и сохраняет membership в req.
module.exports.requireMember = async (req, res, next) => {
  try {
    const userId = req?.user?.id;
    const companyId = req?.companyId || req?.user?.companyId || null;

    if (!userId) {
      throw new AppError(401, 'Unauthorized', { code: 'UNAUTHORIZED' });
    }

    if (!companyId) {
      throw new AppError(403, 'Company context required', {
        code: 'COMPANY_CONTEXT_REQUIRED',
      });
    }

    const membership = await UserCompany.findOne({
      where: {
        userId,
        companyId,
      },
    });

    if (!membership) {
      throw new AppError(403, 'Forbidden: user is not a member of this company', {
        code: 'FORBIDDEN_COMPANY_MEMBERSHIP_REQUIRED',
      });
    }

    // Пока роли не используем, но сохраняем в req на будущее.
    req.membership = membership;
    next();
  } catch (err) {
    next(err);
  }
};
