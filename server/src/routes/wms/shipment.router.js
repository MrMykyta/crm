'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/shipment.controller');
const acl = require('./acl');

router.get('/', acl.read, controller.list);
router.get('/item/:itemId/stock-moves', acl.inventoryRead, controller.listItemStockMoves);
router.get('/:id/stock-moves', acl.inventoryRead, controller.listStockMoves);
router.get('/:id/print', acl.read, controller.getPrint);
router.get('/:id', acl.read, controller.getById);
router.post('/', acl.documentCreate, controller.create);
router.post('/item/:itemId/ship', acl.documentPost, controller.shipItem);

module.exports = router;
