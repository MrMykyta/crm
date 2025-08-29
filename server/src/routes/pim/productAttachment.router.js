
// productAttachmentRouter.js (generated)
const productAttachmentRouter = require('express').Router();
const controller = require('../../controllers/pim/productAttachment.controller');
productAttachmentRouter.get('/', controller.list); 
productAttachmentRouter.get('/:id', controller.getById); 
productAttachmentRouter.post('/', controller.create); 
productAttachmentRouter.put('/:id', controller.update); 
productAttachmentRouter.delete('/:id', controller.remove);
module.exports = productAttachmentRouter;
