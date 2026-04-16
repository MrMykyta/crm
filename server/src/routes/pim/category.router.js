'use strict';

const categoryRouter = require('express').Router();
const controller = require('../../controllers/pim/category.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const categorySchema = require('../../schemas/categorySchema');

categoryRouter.get(
  '/',
  requireMember,
  authorize('product:read'),
  validateQuery(categorySchema.listQuery),
  controller.list
);

categoryRouter.get('/:id', requireMember, authorize('product:read'), controller.getById);
categoryRouter.get('/:id/usage', requireMember, authorize('product:read'), controller.usage);

categoryRouter.post(
  '/',
  requireMember,
  authorize('product:update'),
  validateBody(categorySchema.create),
  controller.create
);

categoryRouter.put(
  '/:id',
  requireMember,
  authorize('product:update'),
  validateBody(categorySchema.update),
  controller.update
);

categoryRouter.post(
  '/:id/merge',
  requireMember,
  authorize('product:update'),
  validateBody(categorySchema.merge),
  controller.merge
);

categoryRouter.delete(
  '/:id',
  requireMember,
  authorize('product:update'),
  validateBody(categorySchema.remove),
  controller.remove
);

module.exports = categoryRouter;
