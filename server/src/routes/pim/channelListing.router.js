
// channelListingRouter.js (generated)
const channelListingRouter = require('express').Router();
const controller = require('../../controllers/pim/channelListing.controller');
channelListingRouter.get('/', controller.list); 
channelListingRouter.get('/:id', controller.getById); 
channelListingRouter.post('/', controller.create); 
channelListingRouter.put('/:id', controller.update); 
channelListingRouter.delete('/:id', controller.remove);
module.exports = channelListingRouter;
