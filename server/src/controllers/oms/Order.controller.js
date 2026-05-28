const orderService = require('../../services/oms/orderService');

function normalizeOrderPayload(payload = {}) {
  const normalized = { ...payload };

  if (normalized.counterpartyId && !normalized.customerId) {
    normalized.customerId = normalized.counterpartyId;
  }
  if (normalized.currency && !normalized.currencyCode) {
    normalized.currencyCode = normalized.currency;
  }

  delete normalized.counterpartyId;
  delete normalized.currency;
  return normalized;
}

function normalizeListQuery(query = {}) {
  const normalized = { ...query };

  if (Array.isArray(normalized.status)) {
    normalized.status = normalized.status[0];
  }
  if (Array.isArray(normalized.paymentStatus)) {
    normalized.paymentStatus = normalized.paymentStatus[0];
  }
  if (normalized.counterpartyId && !normalized.customerId) {
    normalized.customerId = normalized.counterpartyId;
  }

  return normalized;
}

module.exports.list = async (req, res, next) => {
  try {
    const data = await orderService.list(normalizeListQuery(req.query || {}), req.user);
    const items = Array.isArray(data?.items) ? data.items : (Array.isArray(data?.rows) ? data.rows : []);
    res.status(200).json({
      ...data,
      items,
    });
  } catch (error) {
    next(error);
  }
};

module.exports.getById = async (req, res, next) => {
  try {
    const data = await orderService.get(req.params.id, req.user);
    if (!data) {
      return res.status(404).json({ message: 'Order not found' });
    }
    return res.status(200).json(data);
  } catch (error) {
    return next(error);
  }
};

module.exports.create = async (req, res, next) => {
  try {
    const data = await orderService.create(normalizeOrderPayload(req.body || {}), req.user);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.update = async (req, res, next) => {
  try {
    const data = await orderService.update(req.params.id, normalizeOrderPayload(req.body || {}), req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.remove = async (req, res, next) => {
  try {
    const data = await orderService.remove(req.params.id, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.saveItems = async (req, res, next) => {
  try {
    const data = await orderService.update(req.params.id, { items: req.body?.items || [] }, req.user);
    res.status(200).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.fromOffer = async (req, res, next) => {
  try {
    const payload = normalizeOrderPayload(req.body || {});
    const data = await orderService.fromOffer(req.params.id, payload, req.user);
    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};

module.exports.meta = async (_req, res, _next) => {
  res.status(200).json({
    statuses: ['draft', 'new', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled', 'returned'],
    paymentStatuses: ['pending', 'paid', 'refunded', 'partially_refunded'],
    fulfillmentStatuses: ['unfulfilled', 'partial', 'fulfilled'],
    discountTypes: ['none', 'fixed', 'percent'],
  });
};

// Backward compatibility with previous controller method names
module.exports.get = module.exports.getById;
