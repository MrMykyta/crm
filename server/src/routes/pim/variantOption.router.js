
// variantOptionRouter.js (generated)
const variantOptionRouter = require('express').Router();
const controller = require('../../controllers/pim/variantOption.controller');
variantOptionRouter.get('/', controller.list); 
variantOptionRouter.get('/:id', controller.getById); 
variantOptionRouter.post('/', controller.create); 
variantOptionRouter.put('/:id', controller.update); 
variantOptionRouter.delete('/:id', controller.remove);
module.exports = variantOptionRouter;
