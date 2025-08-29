const Joi = require('joi');

const createUserCompanySchema = Joi.object({
  userId: Joi.string().uuid().required(),
  companyId: Joi.string().uuid().required(),
  role: Joi.string().valid('owner', 'admin', 'member').required(),
  status: Joi.string().valid('active', 'invited', 'blocked').default('active'),

  // 🔹 новые поля
  departmentId: Joi.string().uuid().allow(null),
  isLead: Joi.boolean().default(false)
});

const updateUserCompanySchema = Joi.object({
  role: Joi.string().valid('owner', 'admin', 'member'),
  status: Joi.string().valid('active', 'invited', 'blocked'),

  // 🔹 новые поля
  departmentId: Joi.string().uuid().allow(null),
  isLead: Joi.boolean()
});

module.exports = {
  createUserCompanySchema,
  updateUserCompanySchema
};
