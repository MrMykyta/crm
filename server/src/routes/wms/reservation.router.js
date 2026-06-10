
// reservationRouter.js (generated)
const reservationRouter = require('express').Router();
const controller = require('../../controllers/wms/reservation.controller');
const acl = require('./acl');

reservationRouter.get('/', acl.reservationManage, controller.list);
reservationRouter.get('/:id', acl.reservationManage, controller.getById);
reservationRouter.post('/', acl.reservationManage, controller.create);
reservationRouter.put('/:id', acl.reservationManage, controller.update);
reservationRouter.delete('/:id', acl.reservationManage, controller.remove);

module.exports = reservationRouter;
