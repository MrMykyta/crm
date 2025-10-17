const counterpartyService = require('../../services/crm/counterpartyService');

// helper: берём companyId из params, а если middleware уже положил — сверим/используем его
function pickCompanyId(req) {
  const fromParam = req.params.companyId;
  const fromAuth  = req.companyId;
  return fromParam || fromAuth;
}

module.exports.list = async (req, res) => {
  try {
    const companyId = pickCompanyId(req);
    const data = await counterpartyService.list(companyId, req.query);
    res.status(200).send(data);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports.create = async (req, res) => {
  try {
    const companyId = pickCompanyId(req);
    const row = await counterpartyService.create(req.user.id, companyId, req.body);
    res.status(201).send(row);
  } catch (e) {
    res.status(400).send({ error: e.message });
  }
};

module.exports.getOne = async (req, res) => {
  try {
    const companyId = pickCompanyId(req);
    
    const row = await counterpartyService.getOne(companyId, req.params.id);
    if (!row) return res.status(404).send({ error: 'Not found' });
    res.status(200).send(row);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports.update = async (req, res) => {
  try {
    const companyId = pickCompanyId(req);
    const row = await counterpartyService.update(req.user.id, companyId, req.params.id, req.body);
    if (!row) return res.status(404).send({ error: 'Not found' });
    res.status(200).send(row);
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

module.exports.remove = async (req, res) => {
  try {
    const companyId = pickCompanyId(req);
    const ok = await counterpartyService.remove(companyId, req.params.id);
    if (!ok) return res.status(404).send({ error: 'Not found' });
    res.status(204).end(); // 204 без тела
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};

// POST /:companyId/:id/convert-lead
module.exports.convertLead = async (req, res) => {
  try {
    const companyId = pickCompanyId(req);
    const ok = await counterpartyService.convertLead(companyId, req.params.id, req.user.id);
    if (!ok) return res.status(404).send({ error: 'Lead not found or already converted' });
    res.status(200).send({ ok: true });
  } catch (e) {
    res.status(500).send({ error: e.message });
  }
};