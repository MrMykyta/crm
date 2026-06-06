'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/adjustment.controller');

router.get('/', controller.list);
router.get('/:id/stock-moves', controller.listStockMoves);
router.get('/:id/print', controller.getPrint);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.post('/:id/post', controller.post);

module.exports = router;
