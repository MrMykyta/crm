const userService = require('../../services/crm/userService');

exports.me = async (req, res, next) => {
  try {
    const me = await userService.getMe(req.user.id);
    res.status(200).send(me);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

exports.updateMe = async (req, res, next) => {
  try {
    const updated = await userService.updateMe(req.user.id, req.companyId, req.body);
    res.status(200).send(updated);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};

exports.myCompanies = async (req, res, next) => {
  try {
    const items = await userService.getUserCompanies(req.user.id);
    res.status(200).send(items);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

exports.lookupByEmail = async (req, res, next) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    console.log('lookupByEmail', email);
    if (!email) return res.status(400).json({ error: 'email required' });

    const out = await userService.findPublicByEmail(email);
    // Ответ стандартизируем:
    // { exists: boolean, user?: { id, email, firstName, lastName, avatarUrl } }
    res.json(out);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};