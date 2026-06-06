'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/shipment.controller');

router.get('/', controller.list);
router.get('/item/:itemId/stock-moves', controller.listItemStockMoves);
router.get('/:id/stock-moves', controller.listStockMoves);
router.get('/:id/print', controller.getPrint);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.post('/item/:itemId/ship', controller.shipItem);

module.exports = router;
