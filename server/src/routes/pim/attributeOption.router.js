
// attributeOptionRouter.js (generated)
const attributeOptionRouter = require('express').Router();
const controller = require('../../controllers/pim/attributeOption.controller');
attributeOptionRouter.get('/', controller.list); 
attributeOptionRouter.get('/:id', controller.getById); 
attributeOptionRouter.post('/', controller.create); 
attributeOptionRouter.put('/:id', controller.update); 
attributeOptionRouter.delete('/:id', controller.remove);
module.exports = attributeOptionRouter;
