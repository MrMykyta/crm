
// InventoryItem.controller.js (generated)
const inventoryItemService = require('../../services/wms/inventoryItemService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await inventoryItemService.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[InventoryItemController.list]', e); res.status(400).send({ error: e.message }); }
};
// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const item = await inventoryItemService.getById(req.params.id);
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[InventoryItemController.getById]', e); res.status(400).send({ error: e.message }); }
};
// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    if (req.user?.companyId && !payload.companyId) payload.companyId = req.user.companyId;
    const created = await inventoryItemService.create(payload);
    res.status(201).send(created);
  } catch (e) { console.error('[InventoryItemController.create]', e); res.status(400).send({ error: e.message }); }
};
// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const updated = await inventoryItemService.update(req.params.id, req.body);
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[InventoryItemController.update]', e); res.status(400).send({ error: e.message }); }
};
// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    const n = await inventoryItemService.remove(req.params.id);
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[InventoryItemController.remove]', e); res.status(400).send({ error: e.message }); }
};

