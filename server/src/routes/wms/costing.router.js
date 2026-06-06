'use strict';

const router = require('express').Router();
const controller = require('../../controllers/wms/costing.controller');

router.get('/opening-balance/status', controller.getOpeningBalanceStatus);
router.post('/opening-balance/dry-run', controller.dryRunOpeningBalance);
router.post('/opening-balance/initialize', controller.initializeOpeningBalance);

module.exports = router;
