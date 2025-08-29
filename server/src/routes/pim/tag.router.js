
// tagRouter.js (generated)
const tagRouter = require('express').Router();
const controller = require('../../controllers/pim/tag.controller');
tagRouter.get('/', controller.list); 
tagRouter.get('/:id', controller.getById); 
tagRouter.post('/', controller.create); 
tagRouter.put('/:id', controller.update); 
tagRouter.delete('/:id', controller.remove);
module.exports = tagRouter;
