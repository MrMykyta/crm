'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/reports.controller');
const acl = require('./acl');

router.get('/stock-valuation', acl.reportsRead, controller.getStockValuation);
router.get('/stock-turnover', acl.reportsRead, controller.getStockTurnover);
router.get('/stock-as-of', acl.reportsRead, controller.getStockAsOf);
router.get('/inventory-ledger', acl.reportsRead, controller.getInventoryLedger);

module.exports = router;
