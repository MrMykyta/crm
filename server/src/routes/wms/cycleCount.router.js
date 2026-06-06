'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/cycleCount.controller');

router.get('/', controller.list);
router.get('/:id/print', controller.getPrint);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.post('/:id/items', controller.addItems);
router.post('/:id/reconcile', controller.reconcile);

module.exports = router;
