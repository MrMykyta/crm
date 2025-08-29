
// collectionRouter.js (generated)
const collectionRouter = require('express').Router();
const controller = require('../../controllers/pim/collection.controller');
collectionRouter.get('/', controller.list); 
collectionRouter.get('/:id', controller.getById); 
collectionRouter.post('/', controller.create); 
collectionRouter.put('/:id', controller.update); 
collectionRouter.delete('/:id', controller.remove);
module.exports = collectionRouter;
