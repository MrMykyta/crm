const uomService = require('../../services/pim/uomService');

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  const r = await uomService.list({ query: req.query, user: req.user });
  res.json({ data: r.rows, meta: { count: r.count, page: r.page, limit: r.limit } });
};

// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  const r = await uomService.getById(req.params.id, { companyId: req.user?.companyId });
  if (!r) return res.sendStatus(404);
  res.json({ data: r });
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  const r = await uomService.create({
    payload: req.body || {},
    user: req.user,
  });
  res.status(201).json({ data: r });
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  const r = await uomService.update({
    id: req.params.id,
    payload: req.body || {},
    user: req.user,
  });
  if (!r) return res.sendStatus(404);
  res.json({ data: r });
};

// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  const n = await uomService.remove({ id: req.params.id, user: req.user });
  if (!n) return res.sendStatus(404);
  res.json({ deleted: n });
};

