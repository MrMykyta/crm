// src/controllers/crm/counterpartyController.js
const counterpartyService = require('../../services/crm/counterpartyService');
const { broadcast } = require('../../routes/system/sseRouter'); // путь подправь под свой

module.exports.list = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await counterpartyService.list(companyId, req.query);
    res.status(200).send(data);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports.create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const row = await counterpartyService.create(req.user.id, companyId, req.body);

    // 🔊 realtime: новый контрагент
    broadcast({ type: 'counterparty.created', ids: [row.id], companyId });

    res.status(201).send(row);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};

module.exports.getOne = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const row = await counterpartyService.getOne(companyId, req.params.id);
    if (!row) return res.status(404).send({ error: 'Not found' });
    res.status(200).send(row);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports.update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const row = await counterpartyService.update(req.user.id, companyId, req.params.id, req.body);
    if (!row) return res.status(404).send({ error: 'Not found' });

    // 🔊 realtime: обновлён контрагент
    broadcast({ type: 'counterparty.updated', ids: [row.id], companyId });

    res.status(200).send(row);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports.remove = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { id } = req.params;
    const ok = await counterpartyService.remove(companyId, id);
    if (!ok) return res.status(404).send({ error: 'Not found' });

    // 🔊 realtime: удалён контрагент
    broadcast({ type: 'counterparty.removed', ids: [id], companyId });

    res.status(204).end(); // 204 без тела
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

// POST /:id/convert-lead
module.exports.convertLead = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await counterpartyService.convertLead(companyId, req.params.id, req.user.id);
    if (!ok) return res.status(404).send({ error: 'Lead not found or already converted' });

    // 🔊 realtime: изменение статуса лида → контрагент
    broadcast({ type: 'counterparty.converted', ids: [req.params.id], companyId });

    res.status(200).send({ ok: true });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};
