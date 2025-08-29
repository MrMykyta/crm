
// attributeRouter.js (generated)
const attributeRouter = require('express').Router();
const controller = require('../../controllers/pim/attribute.controller');
attributeRouter.get('/', controller.list); 
attributeRouter.get('/:id', controller.getById); 
attributeRouter.post('/', controller.create); 
attributeRouter.put('/:id', controller.update); 
attributeRouter.delete('/:id', controller.remove);
module.exports = attributeRouter;
