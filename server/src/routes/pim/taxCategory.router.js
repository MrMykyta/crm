
// taxCategoryRouter.js (generated)
const taxCategoryRouter = require('express').Router();
const controller = require('../../controllers/pim/taxCategory.controller');
taxCategoryRouter.get('/', controller.list); 
taxCategoryRouter.get('/:id', controller.getById); 
taxCategoryRouter.post('/', controller.create); 
taxCategoryRouter.put('/:id', controller.update); 
taxCategoryRouter.delete('/:id', controller.remove);
module.exports = taxCategoryRouter;
