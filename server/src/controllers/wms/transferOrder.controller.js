
// TransferOrder.controller.js (generated)
const transferOrderService = require('../../services/wms/transferOrderService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await transferOrderService.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[TransferOrderController.list]', e); res.status(400).send({ error: e.message }); }
};
// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const item = await transferOrderService.getById(req.params.id, req.user?.companyId || null);
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[TransferOrderController.getById]', e); res.status(400).send({ error: e.message }); }
};
// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
    const created = await transferOrderService.create(payload);
    res.status(201).send(created);
  } catch (e) { console.error('[TransferOrderController.create]', e); res.status(400).send({ error: e.message }); }
};
// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const updated = await transferOrderService.update(req.params.id, req.body, req.user?.companyId || null);
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[TransferOrderController.update]', e); res.status(400).send({ error: e.message }); }
};
// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    const n = await transferOrderService.remove(req.params.id, req.user?.companyId || null);
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[TransferOrderController.remove]', e); res.status(400).send({ error: e.message }); }
};
