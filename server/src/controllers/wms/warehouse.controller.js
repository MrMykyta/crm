'use strict';

const AppError = require('../../errors/AppError');
const asyncHandler = require('../../middleware/asyncHandler');
const warehouseService = require('../../services/wms/warehouseService');

module.exports.list = asyncHandler(async (req, res) => {
  const { rows, count, page, limit } = await warehouseService.list({
    query: req.query,
    user: req.user,
  });

  return res.status(200).json({ data: rows, meta: { count, page, limit } });
});

module.exports.getById = asyncHandler(async (req, res) => {
  const item = await warehouseService.getById(req.params.id);
  if (!item) {
    throw new AppError(404, 'Warehouse not found');
  }

  return res.status(200).json(item);
});

module.exports.create = asyncHandler(async (req, res) => {
  const payload = { ...req.body };
  if (req.user?.companyId && !payload.companyId) {
    payload.companyId = req.user.companyId;
  }

  const row = await warehouseService.create(payload);
  return res.status(201).json(row);
});

module.exports.update = asyncHandler(async (req, res) => {
  const row = await warehouseService.update(req.params.id, req.body);
  if (!row) {
    throw new AppError(404, 'Warehouse not found');
  }

  return res.status(200).json(row);
});

module.exports.remove = asyncHandler(async (req, res) => {
  const deleted = await warehouseService.remove(req.params.id);
  if (!deleted) {
    throw new AppError(404, 'Warehouse not found');
  }

  return res.status(200).json({ deleted });
});
