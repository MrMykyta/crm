const dealService = require('../../services/crm/dealService');

module.exports.list = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { rows, count, page, limit } = await dealService.list({
      query: req.query,
      user: req.user,
      companyId,
    });
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[DealController.list]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.getById = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const item = await dealService.getById(req.params.id, { companyId, user: req.user });
    if (!item) {
        return res.sendStatus(404);
    }
    res.status(200).send(item);
  } catch (e) {
    console.error('[DealController.getById]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const payload = { ...req.body };
    delete payload.companyId;
    const created = await dealService.create(payload, { companyId, user: req.user });
    res.status(201).send(created);
  } catch (e) {
    console.error('[DealController.create]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const payload = { ...req.body };
    delete payload.companyId;
    const updated = await dealService.update(req.params.id, payload, { companyId, user: req.user });
    if (!updated) {
        return res.sendStatus(404);
    }
    res.status(200).send(updated);
  } catch (e) {
    console.error('[DealController.update]', e);
    res.status(400).send({ error: e.message });
  }
};

module.exports.remove = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const n = await dealService.remove(req.params.id, { companyId, user: req.user });
    if (!n) {
        return res.sendStatus(404);
    }
    res.status(200).send({ deleted: n });
  } catch (e) {
    console.error('[DealController.remove]', e);
    res.status(400).send({ error: e.message });
  }
};
