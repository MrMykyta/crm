
// channelCategoryMapRouter.js (generated)
const channelCategoryMapRouter = require('express').Router();
const controller = require('../../controllers/pim/channelCategoryMap.controller');
channelCategoryMapRouter.get('/', controller.list); 
channelCategoryMapRouter.get('/:id', controller.getById); 
channelCategoryMapRouter.post('/', controller.create); 
channelCategoryMapRouter.put('/:id', controller.update); 
channelCategoryMapRouter.delete('/:id', controller.remove);
module.exports = channelCategoryMapRouter;
