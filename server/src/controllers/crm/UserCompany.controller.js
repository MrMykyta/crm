// src/controllers/userCompanyController.js
const ucService = require('../../services/crm/userCompanyService');

// список участников компании
module.exports.listUsers = async (req, res) => {
    try {
      const users = await ucService.getCompanyUsers(req.user.id, req.params.companyId);
      if (!users) {
        res.status(403).send({ error: 'Нет прав' });
      }
      res.status(200).send(users);
    } catch (e) {
      res.status(500).send({ error: e.message });
    }
};

// добавить/активировать участника
module.exports.addUser = async (req, res) => {
    try {
      const { userId, role, departmentId = null, isLead = false } = req.body;
      const membership = await ucService.addUserToCompany(
        req.user.id, req.params.companyId, userId, role, { departmentId, isLead }
      );
      if (!membership) {
        res.status(403).send({ error: 'Нет прав' });
      }
      res.status(201).send(membership);
    } catch (e) {
      res.status(400).send({ error: e.message });
  }
};

// изменить роль/департамент/лида
module.exports.updateRole = async (req, res) => {
    try {
      const { role, departmentId, isLead } = req.body;
      const updated = await ucService.updateUserRole(
        req.user.id, req.params.companyId, req.params.userId, role, { departmentId, isLead }
      );
      if (!updated) {
        res.status(404).send({ error: 'Пользователь не найден или нет прав' });
      }
      res.status(200).send(updated);
    } catch (e) {
      res.status(400).send({ error: e.message });
    }
};

// удалить участника
module.exports.removeUser = async (req, res) => {
  try {
    const ok = await ucService.removeUserFromCompany(
      req.user.id, req.params.companyId, req.params.userId
    );
    if (!ok) {
      res.status(404).send({ error: 'Пользователь не найден или нет прав' });
    }
    res.status(204).send({ message: 'Удалён' });
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};
