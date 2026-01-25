// src/controllers/crm/User.controller.js
const userService = require('../../services/crm/userService');

exports.me = async (req, res) => {
  try {
    const me = await userService.getMe(req.user.id);
    res.status(200).send(me);
  } catch (e) { res.status(500).send({ error: e.message }); }
};

exports.updateMe = async (req, res) => {
  try {
    const updated = await userService.updateMe(req.user.id, req.user.companyId, req.body);
    res.status(200).send(updated);
  } catch (e) { res.status(400).send({ error: e.message }); }
};

exports.myCompanies = async (req, res) => {
  try {
    const items = await userService.getUserCompanies(req.user.id);
    res.status(200).send(items);
  } catch (e) { res.status(500).send({ error: e.message }); }
};

exports.lookupByEmail = async (req, res) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email) return res.status(400).json({ error: 'email required' });
    res.json(await userService.findPublicByEmail(email));
  } catch (e) { res.status(400).json({ error: e.message }); }
};

// ====== НОВОЕ: пользователи по id (для страницы entity)
exports.getById = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const data = await userService.getById(userId, req.user.companyId);
    if (!data) return res.sendStatus(404);
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
};

exports.updateById = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const data = await userService.updateById(userId, req.user.companyId, req.body);
    if (!data) return res.sendStatus(404);
    res.json(data);
  } catch (e) { res.status(400).json({ error: e.message }); }
};
