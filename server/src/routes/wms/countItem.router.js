
// countItemRouter.js (generated)
const countItemRouter = require('express').Router();
const controller = require('../../controllers/wms/countItem.controller');

countItemRouter.get('/', controller.list);
countItemRouter.get('/:id', controller.getById);
countItemRouter.post('/', controller.create);
countItemRouter.put('/:id', controller.update);
countItemRouter.delete('/:id', controller.remove);

module.exports = countItemRouter;
