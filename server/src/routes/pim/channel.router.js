
// channelRouter.js (generated)
const channelRouter = require('express').Router();
const controller = require('../../controllers/pim/channel.controller');
channelRouter.get('/', controller.list); 
channelRouter.get('/:id', controller.getById); 
channelRouter.post('/', controller.create); 
channelRouter.put('/:id', controller.update); 
channelRouter.delete('/:id', controller.remove);
module.exports = channelRouter;
