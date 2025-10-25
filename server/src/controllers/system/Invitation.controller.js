// controllers/system/Invitation.controller.js
'use strict';

const service = require('../../services/system/invitationService');
const { Company } = require('../../models');

exports.listInvitations = async (req, res) => {
  try {
    const { companyId } = req.params;
    const data = await service.list(companyId, req.query);
    res.json(data);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.createInvitation = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await Company.findByPk(companyId, { attributes: ['id', 'name'] });
    if (!company) return res.status(404).json({ error: 'Company not found' });

    const inv = await service.create(req.user, { id: company.id, name: company.name }, req.body);
    res.status(201).json(inv);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.resendInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.resend(id, req.user);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

exports.revokeInvitation = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await service.revoke(id);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// публичная проверка токена
exports.checkInvitation = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'token required' });
    const info = await service.checkByToken(token);
    res.json(info);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};

// акцепт приглашения (с авто-логином)
exports.acceptInvitation = async (req, res) => {
  try {
    const { token, password, firstName, lastName } = req.body;
    const result = await service.accept(token, password, { firstName, lastName });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
};