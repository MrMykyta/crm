'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/cycleCount.controller');
const acl = require('./acl');

router.get('/', acl.read, controller.list);
router.get('/:id/print', acl.read, controller.getPrint);
router.get('/:id', acl.read, controller.getById);
router.post('/', acl.inventoryCount, controller.create);
router.post('/:id/items', acl.inventoryCount, controller.addItems);
router.post('/:id/reconcile', acl.documentPost, controller.reconcile);

module.exports = router;
