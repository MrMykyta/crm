'use strict';

const svc = require('../../services/pim/productService');

// Формирует унифицированный HTTP-ответ с ошибкой.
function sendError(res, e, fallback = 'Request failed') {
  const status = Number(e?.statusCode || e?.status || 400);
  const httpStatus = status >= 400 && status <= 599 ? status : 400;
  return res.status(httpStatus).send({ error: e?.message || fallback });
}

// Возвращает список сущностей с учётом фильтров и пагинации.
module.exports.list = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const query = req.validatedQuery || req.query;
    const { rows, count, page, limit } = await svc.list({
      query,
      companyId,
    });
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[ProductController.list]', e);
    sendError(res, e, 'Failed to list products');
  }
};

// Возвращает одну сущность по её идентификатору.
module.exports.get = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.getById(companyId, req.params.id);
    if (!r) return res.status(404).send({ error: 'Product not found' });
    res.status(200).send({ data: r });
  } catch (e) {
    console.error('[ProductController.get]', e);
    sendError(res, e, 'Failed to get product');
  }
};

// Создаёт новую сущность и возвращает результат создания.
module.exports.create = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.create({ companyId, payload: req.body || {} });
    res.status(201).send({ data: r });
  } catch (e) {
    console.error('[ProductController.create]', e);
    sendError(res, e, 'Failed to create product');
  }
};

// Обновляет существующую сущность по идентификатору.
module.exports.update = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.update({
      companyId,
      id: req.params.id,
      payload: req.body || {},
    });
    res.status(200).send({ data: r });
  } catch (e) {
    console.error('[ProductController.update]', e);
    sendError(res, e, 'Failed to update product');
  }
};

// Обновляет только описание сущности.
module.exports.updateDescription = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.update({
      companyId,
      id: req.params.id,
      payload: { description: req.body?.description ?? '' },
    });
    res.status(200).send({ data: r });
  } catch (e) {
    console.error('[ProductController.updateDescription]', e);
    sendError(res, e, 'Failed to update product description');
  }
};

// Переводит сущность в опубликованное состояние.
module.exports.publish = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    await svc.publish(companyId, req.params.id);
    res.status(200).send({ ok: true });
  } catch (e) {
    console.error('[ProductController.publish]', e);
    sendError(res, e, 'Failed to publish product');
  }
};

// Переводит сущность в архивное состояние.
module.exports.archive = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    await svc.archive(companyId, req.params.id);
    res.status(200).send({ ok: true });
  } catch (e) {
    console.error('[ProductController.archive]', e);
    sendError(res, e, 'Failed to archive product');
  }
};

// Создаёт копию сущности.
module.exports.duplicate = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.duplicate(companyId, req.params.id, req.body || {});
    if (!r) return res.status(404).send({ error: 'Product not found' });
    res.status(201).send({ data: r });
  } catch (e) {
    console.error('[ProductController.duplicate]', e);
    sendError(res, e, 'Failed to duplicate product');
  }
};

// Генерирует матрицу вариантов товара по наборам атрибутов.
module.exports.variantMatrix = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const rows = await svc.variantMatrix(
      companyId,
      req.params.id,
      req.body?.attrs || [],
      req.body?.opts || {}
    );
    if (!rows) return res.status(404).send({ error: 'Product not found' });
    res.status(201).send({ data: { created: rows.length, rows } });
  } catch (e) {
    console.error('[ProductController.variantMatrix]', e);
    sendError(res, e, 'Failed to build variants');
  }
};

// Обновляет или создаёт значения атрибутов товара.
module.exports.upsertAttrs = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.upsertAttrs(companyId, req.params.id, req.body?.values || []);
    if (!r) return res.status(404).send({ error: 'Product not found' });
    res.status(200).send({ data: r });
  } catch (e) {
    console.error('[ProductController.upsertAttrs]', e);
    sendError(res, e, 'Failed to update attributes');
  }
};

// Возвращает список цен для выбранного товара.
module.exports.listPrices = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.listPrices({
      companyId,
      productId: req.params.id,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ProductController.listPrices]', e);
    sendError(res, e, 'Failed to list product prices');
  }
};

// Создаёт новую цену для выбранного товара.
module.exports.createPrice = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.createPrice({
      companyId,
      productId: req.params.id,
      payload: req.body || {},
    });
    res.status(201).send({ data });
  } catch (e) {
    console.error('[ProductController.createPrice]', e);
    sendError(res, e, 'Failed to create product price');
  }
};

// Обновляет существующую цену товара.
module.exports.updatePrice = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.updatePrice({
      companyId,
      productId: req.params.id,
      priceId: req.params.priceId,
      payload: req.body || {},
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ProductController.updatePrice]', e);
    sendError(res, e, 'Failed to update product price');
  }
};

// Удаляет цену товара по идентификатору.
module.exports.removePrice = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await svc.removePrice({
      companyId,
      productId: req.params.id,
      priceId: req.params.priceId,
    });
    if (!ok) return res.status(404).send({ error: 'Price not found' });
    res.status(204).send();
  } catch (e) {
    console.error('[ProductController.removePrice]', e);
    sendError(res, e, 'Failed to remove product price');
  }
};

// Возвращает список характеристик товара.
module.exports.listSpecifications = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.listSpecifications({
      companyId,
      productId: req.params.id,
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ProductController.listSpecifications]', e);
    sendError(res, e, 'Failed to list product specifications');
  }
};

// Создаёт новую характеристику товара.
module.exports.createSpecification = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.createSpecification({
      companyId,
      productId: req.params.id,
      payload: req.body || {},
    });
    res.status(201).send({ data });
  } catch (e) {
    console.error('[ProductController.createSpecification]', e);
    sendError(res, e, 'Failed to create product specification');
  }
};

// Обновляет характеристику товара.
module.exports.updateSpecification = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const data = await svc.updateSpecification({
      companyId,
      productId: req.params.id,
      specificationId: req.params.specificationId,
      payload: req.body || {},
    });
    res.status(200).send({ data });
  } catch (e) {
    console.error('[ProductController.updateSpecification]', e);
    sendError(res, e, 'Failed to update product specification');
  }
};

// Удаляет характеристику товара.
module.exports.removeSpecification = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const ok = await svc.removeSpecification({
      companyId,
      productId: req.params.id,
      specificationId: req.params.specificationId,
    });
    if (!ok) return res.status(404).send({ error: 'Specification not found' });
    res.status(204).send();
  } catch (e) {
    console.error('[ProductController.removeSpecification]', e);
    sendError(res, e, 'Failed to remove product specification');
  }
};

// Возвращает историю движений товара.
module.exports.listMovements = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const query = req.validatedQuery || req.query;
    const { rows, count, page, limit } = await svc.listMovements({
      companyId,
      productId: req.params.id,
      query,
    });
    res.status(200).send({ data: rows, meta: { count, page, limit } });
  } catch (e) {
    console.error('[ProductController.listMovements]', e);
    sendError(res, e, 'Failed to list product movements');
  }
};


