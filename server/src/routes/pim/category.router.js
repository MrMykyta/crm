
// categoryRouter.js (generated)
const categoryRouter = require('express').Router();
const controller = require('../../controllers/pim/category.controller');
categoryRouter.get('/', controller.list); 
categoryRouter.get('/:id', controller.getById); 
categoryRouter.post('/', controller.create); 
categoryRouter.put('/:id', controller.update); 
categoryRouter.delete('/:id', controller.remove);
module.exports = categoryRouter;
