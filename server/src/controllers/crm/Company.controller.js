// src/controllers/companyController.js
const companyService = require('../../services/crm/companyService');
const tokenService = require('../../utils/tokenService');

exports.listForMe = async (req, res) => {
  try {
    const data = await companyService.listForUser(req.user.id);
    res.status(200).send(data);
  } catch (e) { 
    res.status(500).send({ error: e.message }); 
  }
};

exports.getOne = async (req, res) => {
  try {
    const item = await companyService.getByIdScoped(req.user.id, req.user.companyId);
    if (!item) {
      return res.status(404).send({ error: 'Компания не найдена или нет доступа' });
    }
    res.status(200).send(item);
  } catch (e) { 
    res.status(500).send({ error: e.message }); 
  }
};

exports.create = async (req, res) => {
  try {
    const company = await companyService.createWithOwner(req.user.id, req.body);
    const accessToken = tokenService.signAccessToken({ userId: req.user.id, activeCompanyId: company.id });
    const { token: refreshToken } = await tokenService.issueRefreshToken({ userId: req.user.id });
    res.status(201).send({activeCompanyId: company.id, tokens: {accessToken, refreshToken }});
  } catch (e) { 
    res.status(400).send({ error: e.message }); 
  }
};

exports.update = async (req, res) => {
  try {
    const updated = await companyService.updateCompany(req.user.id, req.user.companyId, req.body);
    if (!updated) {
      return res.status(403).send({ error: 'Нет прав или компания не найдена' });
    }
    res.status(200).send(updated);
  } catch (e) { 
    res.status(400).send({ error: e.message }); 
  }
};

exports.remove = async (req, res) => {
    try {
      const ok = await companyService.deleteCompany(req.user.id,  req.user.companyId);
      if (!ok) {
        return res.status(403).send({ error: 'Нет прав или компания не найдена' });
      }
      res.status(204).send({ message: 'Компания удалена' });
    } catch (e) { 
      res.status(400).send({ error: e.message }); 
    }
};
