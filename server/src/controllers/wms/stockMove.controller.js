
// StockMove.controller.js (generated)
const stockMoveService = require('../../services/wms/stockMoveService');

module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await stockMoveService.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[StockMoveController.list]', e); res.status(400).send({ error: e.message }); }
};
module.exports.getById = async (req, res) => {
  try {
    const item = await stockMoveService.getById(req.params.id);
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[StockMoveController.getById]', e); res.status(400).send({ error: e.message }); }
};
module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
    const created = await stockMoveService.create(payload);
    res.status(201).send(created);
  } catch (e) { console.error('[StockMoveController.create]', e); res.status(400).send({ error: e.message }); }
};
module.exports.update = async (req, res) => {
  try {
    const updated = await stockMoveService.update(req.params.id, req.body);
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[StockMoveController.update]', e); res.status(400).send({ error: e.message }); }
};
module.exports.remove = async (req, res) => {
  try {
    const n = await stockMoveService.remove(req.params.id);
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[StockMoveController.remove]', e); res.status(400).send({ error: e.message }); }
};
