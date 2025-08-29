
// stockMoveRouter.js (generated)
const stockMoveRouter = require('express').Router();
const controller = require('../../controllers/wms/stockMove.controller');

stockMoveRouter.get('/', controller.list);
stockMoveRouter.get('/:id', controller.getById);
stockMoveRouter.post('/', controller.create);
stockMoveRouter.put('/:id', controller.update);
stockMoveRouter.delete('/:id', controller.remove);

module.exports = stockMoveRouter;
