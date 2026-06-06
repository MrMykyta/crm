'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/reports.controller');

router.get('/stock-valuation', controller.getStockValuation);
router.get('/stock-turnover', controller.getStockTurnover);
router.get('/stock-as-of', controller.getStockAsOf);
router.get('/inventory-ledger', controller.getInventoryLedger);

module.exports = router;
