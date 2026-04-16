'use strict';

const brandRouter = require('express').Router();
const controller = require('../../controllers/pim/brand.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const brandSchema = require('../../schemas/brandSchema');

brandRouter.get(
  '/',
  requireMember,
  authorize('product:read'),
  validateQuery(brandSchema.listQuery),
  controller.list
);

brandRouter.get('/:id', requireMember, authorize('product:read'), controller.getById);
brandRouter.get('/:id/usage', requireMember, authorize('product:read'), controller.usage);

brandRouter.post(
  '/',
  requireMember,
  authorize('product:update'),
  validateBody(brandSchema.create),
  controller.create
);

brandRouter.put(
  '/:id',
  requireMember,
  authorize('product:update'),
  validateBody(brandSchema.update),
  controller.update
);

brandRouter.post(
  '/:id/merge',
  requireMember,
  authorize('product:update'),
  validateBody(brandSchema.merge),
  controller.merge
);

brandRouter.delete(
  '/:id',
  requireMember,
  authorize('product:update'),
  validateBody(brandSchema.remove),
  controller.remove
);

module.exports = brandRouter;
