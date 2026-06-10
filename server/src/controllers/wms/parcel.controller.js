
// Parcel.controller.js (generated)
const parcelService = require('../../services/wms/parcelService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const { rows, count, page, limit } = await parcelService.list({ query: req.query, user: req.user });
    res.status(200).send({ data: rows, meta: { count, page, limit }});
  } catch (e) { console.error('[ParcelController.list]', e); res.status(400).send({ error: e.message }); }
};
// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const item = await parcelService.getById(req.params.id, { user: req.user });
    if (!item) return res.sendStatus(404);
    res.status(200).send(item);
  } catch (e) { console.error('[ParcelController.getById]', e); res.status(400).send({ error: e.message }); }
};
// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const payload = { ...req.body };
    const created = await parcelService.create(payload, { user: req.user });
    res.status(201).send(created);
  } catch (e) { console.error('[ParcelController.create]', e); res.status(400).send({ error: e.message }); }
};
// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const updated = await parcelService.update(req.params.id, req.body, { user: req.user });
    if (!updated) return res.sendStatus(404);
    res.status(200).send(updated);
  } catch (e) { console.error('[ParcelController.update]', e); res.status(400).send({ error: e.message }); }
};
// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    const n = await parcelService.remove(req.params.id, { user: req.user });
    if (!n) return res.sendStatus(404);
    res.status(200).send({ deleted: n });
  } catch (e) { console.error('[ParcelController.remove]', e); res.status(400).send({ error: e.message }); }
};

