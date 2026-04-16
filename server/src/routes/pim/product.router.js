'use strict';

const productRouter = require('express').Router();
const controller = require('../../controllers/pim/product.controller');
const { requireMember } = require('../../middleware/requireMember');
const authorize = require('../../middleware/authorize');
const validateBody = require('../../middleware/validateBody');
const validateQuery = require('../../middleware/validateQuery');
const productSchema = require('../../schemas/productSchema');

productRouter.get(
  '/',
  requireMember,
  authorize('product:read'),
  validateQuery(productSchema.listQuery),
  controller.list
);

productRouter.post(
  '/',
  requireMember,
  authorize('product:create'),
  validateBody(productSchema.create),
  controller.create
);

productRouter.get('/:id', requireMember, authorize('product:read'), controller.get);

productRouter.put(
  '/:id',
  requireMember,
  authorize('product:update'),
  validateBody(productSchema.update),
  controller.update
);

productRouter.patch(
  '/:id/description',
  requireMember,
  authorize('product:update'),
  validateBody(productSchema.updateDescription),
  controller.updateDescription
);

productRouter.get('/:id/prices', requireMember, authorize('product:read'), controller.listPrices);

productRouter.post(
  '/:id/prices',
  requireMember,
  authorize('product:update'),
  validateBody(productSchema.createPrice),
  controller.createPrice
);

productRouter.put(
  '/:id/prices/:priceId',
  requireMember,
  authorize('product:update'),
  validateBody(productSchema.updatePrice),
  controller.updatePrice
);

productRouter.delete(
  '/:id/prices/:priceId',
  requireMember,
  authorize('product:update'),
  controller.removePrice
);

productRouter.get(
  '/:id/specifications',
  requireMember,
  authorize('product:read'),
  controller.listSpecifications
);

productRouter.post(
  '/:id/specifications',
  requireMember,
  authorize('product:update'),
  validateBody(productSchema.createSpecification),
  controller.createSpecification
);

productRouter.put(
  '/:id/specifications/:specificationId',
  requireMember,
  authorize('product:update'),
  validateBody(productSchema.updateSpecification),
  controller.updateSpecification
);

productRouter.delete(
  '/:id/specifications/:specificationId',
  requireMember,
  authorize('product:update'),
  controller.removeSpecification
);

productRouter.get(
  '/:id/movements',
  requireMember,
  authorize('product:read'),
  validateQuery(productSchema.movementListQuery),
  controller.listMovements
);

productRouter.post('/:id/publish', requireMember, authorize('product:update'), controller.publish);
productRouter.post('/:id/archive', requireMember, authorize('product:update'), controller.archive);
productRouter.post('/:id/duplicate', requireMember, authorize('product:create'), controller.duplicate);
productRouter.post('/:id/variant-matrix', requireMember, authorize('product:update'), controller.variantMatrix);
productRouter.put('/:id/attributes', requireMember, authorize('product:update'), controller.upsertAttrs);

module.exports = productRouter;
