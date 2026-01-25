
// product.controller.js (generated)
const svc = require('../../services/pim/productService');

module.exports.get = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.getById(companyId, req.params.id);
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (e) {
    next(e);
  }
};

module.exports.publish = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await svc.publish(companyId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

module.exports.archive = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    await svc.archive(companyId, req.params.id);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

module.exports.duplicate = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.duplicate(companyId, req.params.id, req.body || {});
    if (!r) return res.sendStatus(404);
    res.status(201).json(r);
  } catch (e) {
    next(e);
  }
};

module.exports.variantMatrix = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const rows = await svc.variantMatrix(
      companyId,
      req.params.id,
      req.body.attrs || [],
      req.body.opts || {}
    );
    if (!rows) return res.sendStatus(404);
    res.status(201).json({ created: rows.length, rows });
  } catch (e) {
    next(e);
  }
};

module.exports.upsertAttrs = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const r = await svc.upsertAttrs(companyId, req.params.id, req.body.values || []);
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (e) {
    next(e);
  }
};
