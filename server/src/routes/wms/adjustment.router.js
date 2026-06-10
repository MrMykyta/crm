'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/adjustment.controller');
const acl = require('./acl');

router.get('/', acl.read, controller.list);
router.get('/:id/stock-moves', acl.inventoryRead, controller.listStockMoves);
router.get('/:id/print', acl.read, controller.getPrint);
router.get('/:id', acl.read, controller.getById);
router.post('/', acl.documentCreate, controller.create);
router.post('/:id/post', acl.documentPost, controller.post);

module.exports = router;
