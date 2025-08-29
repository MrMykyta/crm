
// productRouter.js (generated)
const productRouter = require('express').Router();
const controller = require('../../controllers/pim/product.controller');
productRouter.get('/:id', controller.get);
productRouter.post('/:id/publish', controller.publish);
productRouter.post('/:id/archive', controller.archive);
productRouter.post('/:id/duplicate', controller.duplicate);
productRouter.post('/:id/variant-matrix', controller.variantMatrix);
productRouter.put('/:id/attributes', controller.upsertAttrs);
module.exports = productRouter;
