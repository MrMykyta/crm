// ProductSupplier.controller.js (generated, hardened for PIM-4A)
const productSupplierService = require('../../services/pim/productSupplierService');

function sendError(res, e, fallback = 'Request failed') {
  const status = Number(e?.statusCode || e?.status || 400);
  const httpStatus = status >= 400 && status <= 599 ? status : 400;
  return res.status(httpStatus).send({ error: e?.message || fallback, code: e?.code });
}

module.exports.list = async (req, res) => {
  try {
    const r = await productSupplierService.list({ query: req.query, user: req.user });
    res.json({ data: r.rows, meta: { count: r.count, page: r.page, limit: r.limit } });
  } catch (e) {
    sendError(res, e, 'Failed to list product suppliers');
  }
};

module.exports.getById = async (req, res) => {
  try {
    const r = await productSupplierService.getById(req.params.id, { companyId: req.user?.companyId });
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (e) {
    sendError(res, e, 'Failed to get product supplier');
  }
};

module.exports.create = async (req, res) => {
  try {
    const p = { ...req.body };
    if (req.user?.companyId) p.companyId = req.user.companyId;
    const r = await productSupplierService.create(p);
    res.status(201).json(r);
  } catch (e) {
    sendError(res, e, 'Failed to create product supplier');
  }
};

module.exports.update = async (req, res) => {
  try {
    const r = await productSupplierService.update(req.params.id, req.body, { companyId: req.user?.companyId });
    if (!r) return res.sendStatus(404);
    res.json(r);
  } catch (e) {
    sendError(res, e, 'Failed to update product supplier');
  }
};

module.exports.remove = async (req, res) => {
  try {
    const n = await productSupplierService.remove(req.params.id, { companyId: req.user?.companyId });
    if (!n) return res.sendStatus(404);
    res.json({ deleted: n });
  } catch (e) {
    sendError(res, e, 'Failed to delete product supplier');
  }
};
