
// lotRouter.js (generated)
const lotRouter = require('express').Router();
const controller = require('../../controllers/wms/lot.controller');

lotRouter.get('/', controller.list);
lotRouter.get('/:id', controller.getById);
lotRouter.post('/', controller.create);
lotRouter.put('/:id', controller.update);
lotRouter.delete('/:id', controller.remove);

module.exports = lotRouter;
