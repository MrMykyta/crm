// middlewares/requireMember.js
const { UserCompany } = require('../models');

module.exports.requireMember = async (req, res, next) => {
    try {
      const companyId = req.companyId;
      if (!companyId) {
        throw new Error('Company ID is required');
      }

      const membership = await UserCompany.findOne({
        where: {
          userId: req.user.id,
          companyId: companyId
        }
      });
      if (!membership) {
        throw new Error('User is not a member of this company');
      }
      // Пока роли не используем, но сохраняем в req на будущее
      req.membership = membership;
      next();
    } catch (err) {
      next(err);
    }
};

