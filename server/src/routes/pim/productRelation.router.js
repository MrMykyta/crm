
// productRelationRouter.js (generated)
const productRelationRouter = require('express').Router();
const controller = require('../../controllers/pim/productRelation.controller');
productRelationRouter.get('/', controller.list); 
productRelationRouter.get('/:id', controller.getById); 
productRelationRouter.post('/', controller.create); 
productRelationRouter.put('/:id', controller.update); 
productRelationRouter.delete('/:id', controller.remove);
module.exports = productRelationRouter;
