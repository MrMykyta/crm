
// reservationRouter.js (generated)
const reservationRouter = require('express').Router();
const controller = require('../../controllers/wms/reservation.controller');

reservationRouter.get('/', controller.list);
reservationRouter.get('/:id', controller.getById);
reservationRouter.post('/', controller.create);
reservationRouter.put('/:id', controller.update);
reservationRouter.delete('/:id', controller.remove);

module.exports = reservationRouter;
