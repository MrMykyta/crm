'use strict';

const brandService = require('../../services/pim/brandService');

// Формирует унифицированный HTTP-ответ с ошибкой.
function sendError(res, e, fallback = 'Request failed') {
  const status = Number(e?.statusCode || e?.status || 400);
  const httpStatus = status >= 400 && status <= 599 ? status : 400;
  return res.status(httpStatus).send({ error: e?.message || fallback });
}

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const query = req.validatedQuery || req.query;
    const result = await brandService.list({ query, user: req.user });
    res.status(200).send({ data: result.rows, meta: { count: result.count, page: result.page, limit: result.limit } });
  } catch (e) {
    console.error('[BrandController.list]', e);
    sendError(res, e, 'Failed to list brands');
  }
};

// Возвращает одну сущность по её идентификатору.
module.exports.getById = async (req, res) => {
  try {
    const row = await brandService.getById(req.params.id, req.user);
    if (!row) return res.status(404).send({ error: 'Brand not found' });
    res.status(200).send({ data: row });
  } catch (e) {
    console.error('[BrandController.getById]', e);
    sendError(res, e, 'Failed to get brand');
  }
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const result = await brandService.create(req.body || {}, req.user);
    res.status(result.created ? 201 : 200).send({
      data: result.row,
      meta: { created: result.created },
    });
  } catch (e) {
    console.error('[BrandController.create]', e);
    sendError(res, e, 'Failed to create brand');
  }
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const result = await brandService.update(req.params.id, req.body || {}, req.user);
    if (!result) return res.status(404).send({ error: 'Brand not found' });
    res.status(200).send({
      data: result.row,
      meta: { created: false, replaced: Boolean(result.replaced) },
    });
  } catch (e) {
    console.error('[BrandController.update]', e);
    sendError(res, e, 'Failed to update brand');
  }
};

// Удаляет сущность по идентификатору.
module.exports.remove = async (req, res) => {
  try {
    const options = req.validatedBody || req.body || {};
    const deleted = await brandService.remove(req.params.id, { ...req.user, ...options });
    if (!deleted) return res.status(404).send({ error: 'Brand not found' });
    res.status(200).send({ deleted });
  } catch (e) {
    console.error('[BrandController.remove]', e);
    sendError(res, e, 'Failed to remove brand');
  }
};

// Возвращает информацию об использовании сущности в связанных данных.
module.exports.usage = async (req, res) => {
  try {
    const result = await brandService.getUsage(req.params.id, req.user);
    if (!result) return res.status(404).send({ error: 'Brand not found' });
    res.status(200).send({ data: result });
  } catch (e) {
    console.error('[BrandController.usage]', e);
    sendError(res, e, 'Failed to get brand usage');
  }
};

// Объединяет сущности и переносит связи на целевую запись.
module.exports.merge = async (req, res) => {
  try {
    const payload = req.validatedBody || req.body || {};
    const result = await brandService.merge(req.params.id, payload, req.user);
    if (!result) return res.status(404).send({ error: 'Brand not found' });
    res.status(200).send({ data: result });
  } catch (e) {
    console.error('[BrandController.merge]', e);
    sendError(res, e, 'Failed to merge brand');
  }
};

