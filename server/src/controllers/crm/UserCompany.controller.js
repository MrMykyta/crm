'use strict';

const ucService = require('../../services/crm/userCompanyService');

// Возвращает список участников компании с пагинацией, поиском и фильтрами.
module.exports.listUsers = async (req, res) => {
  try {
    const data = await ucService.listUsers(req.user.id, req.user.companyId, req.query);
    if (!data) return res.status(403).send({ error: 'Нет прав' });
    return res.status(200).send(data); // { items, total, page, limit }
  } catch (e) {
    return res.status(500).send({ error: e.message });
  }
};

// Добавляет пользователя в компанию или активирует существующее членство.
module.exports.addUser = async (req, res) => {
  try {
    const { userId, role, departmentId = null, isLead = false } = req.body;
    const membership = await ucService.addUserToCompany(
      req.user.id, req.user.companyId, userId, role, { departmentId, isLead }
    );
    if (!membership) return res.status(403).send({ error: 'Нет прав' });
    return res.status(201).send(membership);
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
};

// Обновляет параметры членства пользователя (роль, статус, департамент, признак лида).
exports.updateMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const payload = {};
    ['role', 'status', 'departmentId', 'isLead'].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        payload[key] = req.body[key];
      }
    });
    const row = await ucService.updateUserMembership(req.user.id, req.user.companyId, userId, payload);
    if (!row) return res.status(403).json({ error: 'forbidden' });
    res.json(row);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};


// Удаляет участника из компании.
module.exports.removeUser = async (req, res) => {
  try {
    const ok = await ucService.removeUserFromCompany(
      req.user.id, req.user.companyId, req.params.userId
    );
    if (!ok) return res.status(404).send({ error: 'Пользователь не найден или нет прав' });
    // Возвращаем 200 с телом, чтобы фронту было проще обрабатывать ответ.
    return res.status(200).send({ ok: true });
  } catch (e) {
    return res.status(400).send({ error: e.message });
  }
};
