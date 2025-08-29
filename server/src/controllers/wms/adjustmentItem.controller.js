
// AdjustmentItem.controller.js (generated)
const adjustmentItemService = require('../../services/wms/adjustmentItemService');

module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await adjustmentItemService.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[AdjustmentItemController.list]', e); res.status(400).send({ error: e.message }); }
};
module.exports.getById = async (req, res) => {
  try {
    const item = await adjustmentItemService.getById(req.params.id);
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[AdjustmentItemController.getById]', e); res.status(400).send({ error: e.message }); }
};
module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
    const created = await adjustmentItemService.create(payload);
    res.status(201).send(created);
  } catch (e) { console.error('[AdjustmentItemController.create]', e); res.status(400).send({ error: e.message }); }
};
module.exports.update = async (req, res) => {
  try {
    const updated = await adjustmentItemService.update(req.params.id, req.body);
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[AdjustmentItemController.update]', e); res.status(400).send({ error: e.message }); }
};
module.exports.remove = async (req, res) => {
  try {
    const n = await adjustmentItemService.remove(req.params.id);
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[AdjustmentItemController.remove]', e); res.status(400).send({ error: e.message }); }
};
