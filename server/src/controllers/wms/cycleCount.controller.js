
// CycleCount.controller.js (generated)
const cycleCountService = require('../../services/wms/cycleCountService');

module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await cycleCountService.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[CycleCountController.list]', e); res.status(400).send({ error: e.message }); }
};
module.exports.getById = async (req, res) => {
  try {
    const item = await cycleCountService.getById(req.params.id);
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[CycleCountController.getById]', e); res.status(400).send({ error: e.message }); }
};
module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
    const created = await cycleCountService.create(payload);
    res.status(201).send(created);
  } catch (e) { console.error('[CycleCountController.create]', e); res.status(400).send({ error: e.message }); }
};
module.exports.update = async (req, res) => {
  try {
    const updated = await cycleCountService.update(req.params.id, req.body);
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[CycleCountController.update]', e); res.status(400).send({ error: e.message }); }
};
module.exports.remove = async (req, res) => {
  try {
    const n = await cycleCountService.remove(req.params.id);
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[CycleCountController.remove]', e); res.status(400).send({ error: e.message }); }
};
