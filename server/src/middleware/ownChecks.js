const { Member, Task, Deal, ContactPoint } = require('../models');

// пользователь запрашивает самого себя
module.exports.isSelfUser = (req) => req.params.id === req.user.id;

// membership (user_companies) — проверяем, что запись относится к текущему юзеру
module.exports.isSelfMember = async (req) => {
  const m = await Member.findByPk(req.params.id, { attributes: ['userId','companyId'] });
  if (!m) return false;
  if (m.companyId !== req.user.companyId) return false;
  return m.userId === req.user.id;
};

// владелец сделки — ответственный
module.exports.isOwnDeal = async (req) => {
  const d = await Deal.findByPk(req.params.id, { attributes: ['companyId','responsibleId'] });
  if (!d) return false;
  if (d.companyId !== req.user.companyId) return false;
  return d.responsibleId === req.user.id;
};

// владелец задачи — назначенный
module.exports.isOwnTask = async (req) => {
  const t = await Task.findByPk(req.params.id, { attributes: ['companyId','assigneeId'] });
  if (!t) return false;
  if (t.companyId !== req.user.companyId) return false;
  return t.assigneeId === req.user.id;
};

// свои contact points только когда owner_type='user'
module.exports.isOwnUserContactPoint = async (req) => {
  const cp = await ContactPoint.findByPk(req.params.id, { attributes: ['companyId','ownerType','ownerId'] });
  if (!cp) return false;
  if (cp.companyId !== req.user.companyId) return false;
  return cp.ownerType === 'user' && cp.ownerId === req.user.id;
};
