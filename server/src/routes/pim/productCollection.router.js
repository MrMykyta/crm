
// productCollectionRouter.js (generated)
const productCollectionRouter = require('express').Router();
const controller = require('../../controllers/pim/productCollection.controller');
productCollectionRouter.get('/', controller.list); 
productCollectionRouter.get('/:id', controller.getById); 
productCollectionRouter.post('/', controller.create); 
productCollectionRouter.put('/:id', controller.update); 
productCollectionRouter.delete('/:id', controller.remove);
module.exports = productCollectionRouter;
