
// pickTaskRouter.js (generated)
const pickTaskRouter = require('express').Router();
const controller = require('../../controllers/wms/pickTask.controller');

pickTaskRouter.get('/', controller.list);
pickTaskRouter.get('/:id', controller.getById);
pickTaskRouter.post('/', controller.create);
pickTaskRouter.put('/:id', controller.update);
pickTaskRouter.delete('/:id', controller.remove);

module.exports = pickTaskRouter;
