
// packagingUnitRouter.js (generated)
const packagingUnitRouter = require('express').Router();
const controller = require('../../controllers/pim/packagingUnit.controller');
packagingUnitRouter.get('/', controller.list); 
packagingUnitRouter.get('/:id', controller.getById); 
packagingUnitRouter.post('/', controller.create); 
packagingUnitRouter.put('/:id', controller.update); 
packagingUnitRouter.delete('/:id', controller.remove);
module.exports = packagingUnitRouter;
