
// brandRouter.js (generated)
const brandRouter = require('express').Router();
const controller = require('../../controllers/pim/brand.controller');
brandRouter.get('/', controller.list); 
brandRouter.get('/:id', controller.getById); 
brandRouter.post('/', controller.create); 
brandRouter.put('/:id', controller.update); 
brandRouter.delete('/:id', controller.remove);
module.exports = brandRouter;
