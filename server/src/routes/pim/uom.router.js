
// uomRouter.js (generated)
const uomRouter = require('express').Router();
const controller = require('../../controllers/pim/uom.controller');
uomRouter.get('/', controller.list); 
uomRouter.get('/:id', controller.getById); 
uomRouter.post('/', controller.create); 
uomRouter.put('/:id', controller.update); 
uomRouter.delete('/:id', controller.remove);
module.exports = uomRouter;
